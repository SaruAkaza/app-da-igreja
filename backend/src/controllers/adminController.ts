import { issueCoupons } from '../services/rewards.js';
import { localDay, previousDay } from '../config/runtime.js';
import { Request, Response } from 'express';
import { groupScoreSql } from '../services/groupAccess.js';
import crypto from 'crypto';
import { db } from '../config/database.js';

export const getDashboardStats = (req: Request, res: Response) => {
  try {
    const churchId = req.user?.church_id;

    const church = db.prepare('SELECT * FROM churches WHERE id = ?').get(churchId) as any;
    const totalMembers = db.prepare('SELECT COUNT(*) as count FROM users WHERE church_id = ?').get(churchId) as { count: number };
    const totalDevotionals = db.prepare('SELECT COUNT(*) as count FROM devotionals WHERE church_id = ?').get(churchId) as { count: number };
    const totalGroups = db.prepare('SELECT COUNT(*) as count FROM groups WHERE church_id = ?').get(churchId) as { count: number };
    const pointsSum = db.prepare('SELECT SUM(total_points) as sum FROM users WHERE church_id = ?').get(churchId) as { sum: number };
    const activeCoupons = db.prepare("SELECT COUNT(*) as count FROM user_coupons WHERE church_id = ? AND status = 'active'").get(churchId) as { count: number };
    const usedCoupons = db.prepare("SELECT COUNT(*) as count FROM user_coupons WHERE church_id = ? AND status = 'used'").get(churchId) as { count: number };

    const today = localDay();
    const todayDevotionals = db.prepare('SELECT COUNT(*) as count FROM devotionals WHERE church_id = ? AND devotional_date = ?').get(churchId, today) as { count: number };

    // Devocionais para moderação/auditoria da igreja
    const recentDevotionals = db.prepare(`
      SELECT 
        d.id,
        d.image_url,
        d.passage_or_chapter,
        d.notes,
        d.points_awarded,
        d.devotional_date,
        d.created_at,
        u.name AS user_name,
        u.email AS user_email,
        g.title AS group_title,
        (SELECT pastoral_guidance FROM leader_feedbacks lf WHERE lf.devotional_id = d.id LIMIT 1) AS existing_feedback
      FROM devotionals d
      INNER JOIN users u ON u.id = d.user_id
      INNER JOIN groups g ON g.id = d.group_id
      WHERE d.church_id = ?
      ORDER BY d.created_at DESC
      LIMIT 15
    `).all(churchId);

    // Top sequências ativas da igreja
    const topStreaks = db.prepare(`
      SELECT id, name, avatar_url, current_streak, total_points
      FROM users
      WHERE church_id = ?
      ORDER BY current_streak DESC, total_points DESC
      LIMIT 5
    `).all(churchId);

    // Engajamento dos Grupos
    const groupEngagement = db.prepare(`
      SELECT 
        g.id,
        g.title,
        g.category,
        u.name AS leader_name,
        COUNT(DISTINCT gm.user_id) AS members_count,
        (SELECT COUNT(DISTINCT dd.user_id) FROM devotionals dd WHERE dd.group_id = g.id AND dd.devotional_date = ?) AS today_members,
        COUNT(DISTINCT d.id) AS devotionals_count
      FROM groups g
      LEFT JOIN users u ON u.id = g.leader_id
      LEFT JOIN group_members gm ON gm.group_id = g.id
      LEFT JOIN devotionals d ON d.group_id = g.id
      WHERE g.church_id = ?
      GROUP BY g.id
      ORDER BY devotionals_count DESC
    `).all(today, churchId);

    // Gincana Ativa se houver
    const activeChallenge = db.prepare(`
      SELECT icc.*, cp.total_points_earned
      FROM inter_church_challenges icc
      INNER JOIN challenge_participants cp ON cp.challenge_id = icc.id
      WHERE cp.church_id = ? AND icc.status = 'active'
      LIMIT 1
    `).get(churchId);

    const activity = Array.from({ length: 7 }, (_, index) => {
      const day = localDay(new Date(Date.now() - (6 - index) * 86400000));
      const record = db.prepare('SELECT COUNT(*) as count FROM devotionals WHERE church_id = ? AND devotional_date = ?').get(churchId, day) as any;
      return { day, count: record.count };
    });
    return res.json({
      activity,
      church,
      summary: {
        pending_feedbacks: (db.prepare('SELECT COUNT(*) as n FROM devotionals d WHERE church_id = ? AND NOT EXISTS (SELECT 1 FROM leader_feedbacks lf WHERE lf.devotional_id = d.id)').get(churchId) as any).n,
        today_participants: (db.prepare('SELECT COUNT(DISTINCT user_id) as n FROM devotionals WHERE church_id = ? AND devotional_date = ?').get(churchId, today) as any).n,
        total_members: totalMembers.count,
        total_devotionals: totalDevotionals.count,
        today_devotionals: todayDevotionals.count,
        total_groups: totalGroups.count,
        total_points_distributed: pointsSum.sum || 0,
        active_coupons: activeCoupons.count,
        used_coupons: usedCoupons.count,
      },
      recent_devotionals: (recentDevotionals as any[]).map(d => ({ ...d, image_url: d.image_url.startsWith('/uploads/') ? '/api/devotionals/' + d.id + '/photo' : d.image_url })),
      top_streaks: topStreaks,
      group_engagement: groupEngagement,
      active_challenge: activeChallenge,
    });
  } catch (err: any) {
    console.error('Erro em getDashboardStats:', err);
    return res.status(500).json({ error: 'Erro ao carregar estatísticas do painel.' });
  }
};

export const listMembers = (req: Request, res: Response) => {
  try {
    const churchId = req.user?.church_id;

    const members = db.prepare(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.current_streak,
        u.highest_streak,
        u.total_points,
        u.last_devotional_date,
        u.created_at,
        (SELECT COUNT(*) FROM devotionals d WHERE d.user_id = u.id) AS devotionals_count,
        (SELECT COUNT(*) FROM user_coupons uc WHERE uc.user_id = u.id) AS coupons_count,
        (SELECT COUNT(*) FROM leader_feedbacks lf WHERE lf.member_id = u.id) AS feedbacks_received_count
      FROM users u
      WHERE u.church_id = ?
      ORDER BY u.total_points DESC, u.name ASC
    `).all(churchId);

    return res.json(members);
  } catch (err: any) {
    console.error('Erro em listMembers:', err);
    return res.status(500).json({ error: 'Erro ao listar membros.' });
  }
};

export const awardBonusPoints = (req: Request, res: Response) => {
  try {
    const churchId = req.user?.church_id;
    const { userId, amount, reason } = req.body;

    if (!userId || !Number.isSafeInteger(Number(amount)) || Number(amount) <= 0 || Number(amount) > 1000 || typeof reason !== 'string' || reason.trim().length < 3 || reason.length > 300) {
      return res.status(400).json({ error: 'Informe o ID do membro e uma quantidade válida de pontos (> 0).' });
    }

    const user = db.prepare('SELECT id, name, total_points FROM users WHERE id = ? AND church_id = ?').get(userId, churchId) as any;
    if (!user) {
      return res.status(404).json({ error: 'Membro não encontrado nesta congregação.' });
    }

    const bonusAmount = Number(amount);
    const newTotal = user.total_points + bonusAmount;
    const now = new Date().toISOString();

    db.transaction(() => {
    db.prepare('UPDATE users SET total_points = ? WHERE id = ?').run(newTotal, userId);

    db.prepare(`
      INSERT INTO point_history (id, church_id, user_id, amount, reason, reference_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(`ph-${crypto.randomUUID()}`, churchId, userId, bonusAmount, reason || 'Bônus Pastoral de Reconhecimento', req.user?.id, now);
    })();
    issueCoupons(userId, churchId!);

    return res.json({
      message: `Sucesso! ${bonusAmount} pontos atribuídos a ${user.name}.`,
      user: {
        id: user.id,
        name: user.name,
        total_points: newTotal,
      },
    });
  } catch (err: any) {
    console.error('Erro em awardBonusPoints:', err);
    return res.status(500).json({ error: 'Erro ao atribuir bônus pastoral.' });
  }
};

export const deleteDevotional = (req: Request, res: Response) => {
  try {
    const churchId = req.user?.church_id;
    const { id } = req.params;
    const { deductPoints } = req.query;

    const devotional = db.prepare('SELECT * FROM devotionals WHERE id = ? AND church_id = ?').get(id, churchId) as any;
    if (!devotional) {
      return res.status(404).json({ error: 'Devocional não encontrado.' });
    }

    db.transaction(() => {
      if (deductPoints === 'true') {
        db.prepare('UPDATE users SET total_points = MAX(0, total_points - ?) WHERE id = ?').run(devotional.points_awarded, devotional.user_id);
        db.prepare('INSERT INTO point_history (id, church_id, user_id, amount, reason, reference_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run('ph-' + crypto.randomUUID(), churchId, devotional.user_id, -devotional.points_awarded, 'Correção por exclusão de devocional', id, new Date().toISOString());
      }
      db.prepare('DELETE FROM devotionals WHERE id = ?').run(id);
      db.prepare(`UPDATE user_coupons SET status = 'expired' WHERE user_id = ? AND church_id = ? AND status = 'active'
        AND reward_id IN (SELECT r.id FROM rewards r WHERE r.church_id = ? AND r.reward_type = 'points'
          AND r.points_required > CASE WHEN r.group_id IS NULL THEN (SELECT total_points FROM users WHERE id = ?) ELSE ${groupScoreSql('?', 'r.group_id')} END)`)
        .run(devotional.user_id, churchId, churchId, devotional.user_id, devotional.user_id);
      const dates = db.prepare('SELECT DISTINCT devotional_date FROM devotionals WHERE user_id = ? ORDER BY devotional_date DESC').all(devotional.user_id) as { devotional_date: string }[];
      let streak = 0; let cursor = dates[0]?.devotional_date;
      for (const item of dates) { if (item.devotional_date !== cursor) break; streak++; cursor = previousDay(cursor); }
      db.prepare('UPDATE users SET current_streak = ?, last_devotional_date = ? WHERE id = ?').run(streak, dates[0]?.devotional_date || null, devotional.user_id);
    })();

    return res.json({ message: 'Devocional excluído com sucesso.' });
  } catch (err: any) {
    console.error('Erro em deleteDevotional:', err);
    return res.status(500).json({ error: 'Erro ao excluir devocional.' });
  }
};

export const updateUserRole = (req: Request, res: Response) => {
  try {
    const churchId = req.user?.church_id;
    const { userId, role } = req.body;

    if (!['member', 'leader', 'church_admin'].includes(role)) {
      return res.status(400).json({ error: 'Cargo inválido. Escolha: member, leader ou church_admin.' });
    }

    const target = db.prepare('SELECT role FROM users WHERE id = ? AND church_id = ?').get(userId, churchId) as any;
    if (!target) return res.status(404).json({ error: 'Membro não encontrado.' });
    if (target.role === 'church_admin' && role !== 'church_admin' && (db.prepare("SELECT COUNT(*) as n FROM users WHERE church_id = ? AND role = 'church_admin'").get(churchId) as any).n <= 1) return res.status(409).json({ error: 'Mantenha pelo menos um administrador nesta igreja.' });
    db.prepare('UPDATE users SET role = ? WHERE id = ? AND church_id = ?').run(role, userId, churchId);
    if (role === 'member') db.prepare('UPDATE groups SET leader_id = NULL WHERE leader_id = ? AND church_id = ?').run(userId, churchId);
    return res.json({ message: `Cargo do usuário atualizado para ${role} com sucesso.` });
  } catch (err: any) {
    console.error('Erro em updateUserRole:', err);
    return res.status(500).json({ error: 'Erro ao atualizar cargo.' });
  }
};

export const getChurchDetails = (req: Request, res: Response) => {
  try {
    const churchId = req.user?.church_id;
    if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada.' });
    const church = db.prepare('SELECT * FROM churches WHERE id = ?').get(churchId) as any;
    if (!church) return res.status(404).json({ error: 'Igreja não encontrada.' });
    const membersCount = (db.prepare('SELECT COUNT(*) as n FROM users WHERE church_id = ?').get(churchId) as any).n;
    const groupsCount = (db.prepare('SELECT COUNT(*) as n FROM groups WHERE church_id = ?').get(churchId) as any).n;
    return res.json({
      ...church,
      members_count: membersCount,
      groups_count: groupsCount,
    });
  } catch (err: any) {
    console.error('Erro em getChurchDetails:', err);
    return res.status(500).json({ error: 'Erro ao carregar dados da igreja.' });
  }
};

export const updateChurchDetails = (req: Request, res: Response) => {
  try {
    const churchId = req.user?.church_id;
    if (!churchId) return res.status(404).json({ error: 'Igreja não encontrada.' });

    const {
      name,
      slug_code,
      denomination,
      cnpj,
      phone,
      address_full,
      city,
      state,
      logo_url,
    } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 3 || name.length > 150) {
      return res.status(400).json({ error: 'O nome da congregação é obrigatório (mínimo 3 caracteres).' });
    }

    let cleanSlug = (slug_code ? String(slug_code).trim().toUpperCase() : '').replace(/[^A-Z0-9_-]/g, '');
    if (!cleanSlug || cleanSlug.length < 3 || cleanSlug.length > 30) {
      return res.status(400).json({ error: 'O código de convite da igreja deve ter entre 3 e 30 caracteres alfanuméricos.' });
    }

    const existing = db.prepare('SELECT id FROM churches WHERE slug_code = ? AND id != ?').get(cleanSlug, churchId);
    if (existing) {
      return res.status(409).json({ error: 'Este código de convite já está sendo utilizado por outra congregação.' });
    }

    db.prepare(`
      UPDATE churches SET
        name = ?,
        slug_code = ?,
        denomination = ?,
        cnpj = ?,
        phone = ?,
        address_full = ?,
        city = ?,
        state = ?,
        logo_url = ?
      WHERE id = ?
    `).run(
      name.trim(),
      cleanSlug,
      denomination ? denomination.trim() : null,
      cnpj ? cnpj.trim() : null,
      phone ? phone.trim() : null,
      address_full ? address_full.trim() : null,
      city ? city.trim() : null,
      state ? state.trim().toUpperCase().slice(0, 2) : null,
      logo_url ? logo_url.trim() : null,
      churchId
    );

    const updated = db.prepare('SELECT * FROM churches WHERE id = ?').get(churchId);
    return res.json({
      message: 'Dados da congregação atualizados com sucesso!',
      church: updated,
    });
  } catch (err: any) {
    console.error('Erro em updateChurchDetails:', err);
    return res.status(500).json({ error: 'Erro ao atualizar congregação.' });
  }
};

export const unlinkMember = (req: Request, res: Response) => {
  try {
    const churchId = req.user?.church_id;
    const { userId } = req.params;

    if (!userId) return res.status(400).json({ error: 'ID do membro não informado.' });
    if (userId === req.user?.id) return res.status(400).json({ error: 'Você não pode desvincular seu próprio usuário administrador.' });

    const target = db.prepare('SELECT id, name, role FROM users WHERE id = ? AND church_id = ?').get(userId, churchId) as any;
    if (!target) return res.status(404).json({ error: 'Membro não encontrado nesta igreja.' });

    if (target.role === 'church_admin') {
      const adminCount = (db.prepare("SELECT COUNT(*) as n FROM users WHERE church_id = ? AND role = 'church_admin'").get(churchId) as any).n;
      if (adminCount <= 1) return res.status(409).json({ error: 'Mantenha pelo menos um administrador na igreja.' });
    }

    db.transaction(() => {
      db.prepare('UPDATE groups SET leader_id = NULL WHERE leader_id = ? AND church_id = ?').run(userId, churchId);
      db.prepare(`
        DELETE FROM group_members 
        WHERE user_id = ? AND group_id IN (SELECT id FROM groups WHERE church_id = ?)
      `).run(userId, churchId);
      db.prepare("UPDATE users SET church_id = NULL, role = 'member', total_points = 0, current_streak = 0, highest_streak = 0, last_devotional_date = NULL WHERE id = ?").run(userId);
      db.prepare("UPDATE user_coupons SET status = 'expired' WHERE user_id = ? AND church_id = ? AND status = 'active'").run(userId, churchId);
    })();

    return res.json({ message: `${target.name} foi desvinculado(a) da congregação com sucesso.` });
  } catch (err: any) {
    console.error('Erro em unlinkMember:', err);
    return res.status(500).json({ error: 'Erro ao desvincular membro.' });
  }
};
