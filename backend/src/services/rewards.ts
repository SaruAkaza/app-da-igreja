import crypto from 'node:crypto';
import { db } from '../config/database.js';
import { localDay } from '../config/runtime.js';

// A emissão usa uma transação síncrona: duas requisições não emitem o mesmo prêmio.
export function issueCoupons(userId: string, churchId: string) {
  return db.transaction(() => {
    const today = localDay();
    const rewards = db.prepare(`
      SELECT r.*, g.title as group_title 
      FROM rewards r 
      JOIN quarters q ON q.id = r.quarter_id
      JOIN users u ON u.id = ? AND u.church_id = r.church_id
      LEFT JOIN groups g ON g.id = r.group_id
      WHERE r.church_id = ? 
        AND q.is_active = 1 
        AND q.start_date <= ? 
        AND q.end_date >= ?
        AND (r.reward_type IS NULL OR r.reward_type = 'points')
        AND (r.group_id IS NULL OR r.group_id IN (SELECT group_id FROM group_members WHERE user_id = ?))
        AND r.points_required <= u.total_points
        AND NOT EXISTS (SELECT 1 FROM user_coupons c WHERE c.reward_id = r.id AND c.user_id = u.id)
    `).all(userId, churchId, today, today, userId) as any[];

    return rewards.map(reward => {
      const code = 'CUPOM-' + reward.tier.toUpperCase().slice(0, 3) + '-' + crypto.randomBytes(8).toString('hex').toUpperCase();
      const id = 'cp-' + crypto.randomUUID();
      db.prepare(`
        INSERT INTO user_coupons (id, church_id, user_id, reward_id, coupon_code, qr_code_data, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
      `).run(id, churchId, userId, reward.id, code, code, new Date().toISOString());

      return { 
        id, 
        coupon_code: code, 
        reward_title: reward.title, 
        tier: reward.tier, 
        partner_name: reward.partner_name,
        group_id: reward.group_id,
        group_title: reward.group_title
      };
    });
  })();
}

export interface CycleMathStats {
  startDate: string;
  endDate: string;
  totalDays: number;
  daysRemaining: number;
  daysElapsed: number;
  isExpired: boolean;
  maxTheoreticalPoints: number;
  suggestedTargets: {
    bronze: number;
    silver: number;
    gold: number;
  };
}

export function calculateCycleMath(startDate?: string | null, endDate?: string | null): CycleMathStats {
  const todayStr = localDay();
  const start = startDate ? new Date(startDate + 'T00:00:00') : new Date(todayStr + 'T00:00:00');
  
  // Se não houver data fim, define padrão de 90 dias (trimestre / 3 meses)
  const defaultEnd = new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate + 'T23:59:59') : defaultEnd;
  const today = new Date(todayStr + 'T12:00:00');

  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const daysRemaining = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  const daysElapsed = Math.max(0, Math.min(totalDays, Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))));
  const isExpired = today.getTime() > end.getTime();

  // 50 pts devocional + 10 pts bônus diário = 60 pts/dia
  const maxTheoreticalPoints = totalDays * 60;
  const suggestedTargets = {
    bronze: Math.round(maxTheoreticalPoints * 0.3), // ~30% assiduidade
    silver: Math.round(maxTheoreticalPoints * 0.6), // ~60% assiduidade
    gold: Math.round(maxTheoreticalPoints * 0.85)   // ~85% assiduidade
  };

  return {
    startDate: startDate || start.toISOString().slice(0, 10),
    endDate: endDate || end.toISOString().slice(0, 10),
    totalDays,
    daysRemaining,
    daysElapsed,
    isExpired,
    maxTheoreticalPoints,
    suggestedTargets
  };
}

export function closeGroupCycleAndAwardPodium(groupId: string, churchId: string, closedByUserId?: string) {
  return db.transaction(() => {
    const group = db.prepare("SELECT * FROM groups WHERE id = ? AND church_id = ?").get(groupId, churchId) as any;
    if (!group) throw new Error("Grupo não encontrado na congregação.");
    if (group.cycle_status === 'completed') throw new Error('Este ciclo já foi encerrado.');

    const now = new Date().toISOString();
    db.prepare("UPDATE groups SET cycle_status = 'completed', cycle_closed_at = ? WHERE id = ?").run(now, groupId);

    // Buscar prêmios de pódio cadastrados especificamente para este grupo
    const podiumRewards = db.prepare(`
      SELECT * FROM rewards 
      WHERE church_id = ? AND group_id = ? AND reward_type = 'podium' 
      ORDER BY podium_position ASC
    `).all(churchId, groupId) as any[];

    // Membros do grupo classificados por pontuação
    const members = db.prepare(`
      SELECT u.id, u.name, u.total_points, u.avatar_url
      FROM group_members gm
      JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = ?
      ORDER BY u.total_points DESC, gm.joined_at ASC
      LIMIT 3
    `).all(groupId) as any[];

    const awarded: any[] = [];

    // Emitir cupons para as posições de 1 a 3
    for (const reward of podiumRewards) {
      const pos = reward.podium_position;
      if (pos >= 1 && pos <= 3 && members[pos - 1]) {
        const winner = members[pos - 1];
        const existing = db.prepare("SELECT id FROM user_coupons WHERE reward_id = ? AND user_id = ?").get(reward.id, winner.id);
        if (!existing) {
          const tierAbbr = (reward.tier || 'ESP').toUpperCase().slice(0, 3);
          const code = `CUPOM-PODIO-${pos}-${tierAbbr}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
          const couponId = 'cp-' + crypto.randomUUID();
          
          db.prepare(`
            INSERT INTO user_coupons (id, church_id, user_id, reward_id, coupon_code, qr_code_data, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
          `).run(couponId, churchId, winner.id, reward.id, code, code, now);

          db.prepare(`
            INSERT INTO point_history (id, church_id, user_id, amount, reason, created_at)
            VALUES (?, ?, ?, 0, ?, ?)
          `).run('ph-' + crypto.randomUUID(), churchId, winner.id, `🏆 ${pos}º Lugar no Pódio da Célula "${group.title}" (${reward.title})`, now);

          awarded.push({
            position: pos,
            winner_id: winner.id,
            winner_name: winner.name,
            reward_id: reward.id,
            reward_title: reward.title,
            tier: reward.tier,
            coupon_code: code
          });
        }
      }
    }

    return {
      groupId,
      groupTitle: group.title,
      cycleStatus: 'completed',
      closedAt: now,
      closedBy: closedByUserId || 'system',
      podiumWinners: members.map((m, idx) => ({ position: idx + 1, userId: m.id, name: m.name, points: m.total_points })),
      awardedCoupons: awarded
    };
  })();
}
