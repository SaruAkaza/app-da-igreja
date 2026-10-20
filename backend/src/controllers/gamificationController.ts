import { issueCoupons } from '../services/rewards.js';
import { localDay, previousDay } from '../config/runtime.js';
import { Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../config/database.js';

export const getRanking = (req: Request, res: Response) => {
  try {
    const churchId = req.user?.church_id;
    const { groupId } = req.query;

    let query = '';
    let params: any[] = [];

    if (groupId) {
      query = `
        SELECT 
          u.id,
          u.name,
          u.avatar_url,
          u.role,
          u.current_streak,
          u.highest_streak,
          u.total_points,
          COUNT(d.id) AS devotionals_count
        FROM users u
        INNER JOIN group_members gm ON gm.user_id = u.id
        LEFT JOIN devotionals d ON d.user_id = u.id AND d.group_id = gm.group_id
        WHERE gm.group_id = ? AND u.church_id = ?
        GROUP BY u.id
        ORDER BY u.total_points DESC, u.current_streak DESC, u.name ASC
        LIMIT 50
      `;
      params.push(groupId, churchId);
    } else {
      query = `
        SELECT 
          u.id,
          u.name,
          u.avatar_url,
          u.role,
          u.current_streak,
          u.highest_streak,
          u.total_points,
          COUNT(d.id) AS devotionals_count
        FROM users u
        LEFT JOIN devotionals d ON d.user_id = u.id
        WHERE u.church_id = ?
        GROUP BY u.id
        ORDER BY u.total_points DESC, u.current_streak DESC, u.name ASC
        LIMIT 50
      `;
      params.push(churchId);
    }

    const ranking = db.prepare(query).all(...params);

    const rankingWithRanks = ranking.map((member: any, index: number) => ({
      position: index + 1,
      ...member,
      is_top3: index < 3,
      badge: index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : null,
    }));

    return res.json(rankingWithRanks);
  } catch (err: any) {
    console.error('Erro em getRanking:', err);
    return res.status(500).json({ error: 'Erro ao carregar o ranking.' });
  }
};

/**
 * COMPETIÇÃO SAUDÁVEL INTERNA: Ranking de Grupos / Células da Mesma Igreja
 * Mede a pontuação total, média por membro e constância diária para um nivelamento justo
 */
export const getGroupsRanking = (req: Request, res: Response) => {
  try {
    const churchId = req.user?.church_id;

    const groupsStats = db.prepare(`
      SELECT 
        g.id,
        g.title,
        g.category,
        g.book_or_theme,
        g.invite_code,
        g.cover_image,
        g.cycle_start_date,
        g.cycle_end_date,
        g.cycle_status,
        g.cycle_closed_at,
        u.name AS leader_name,
        COUNT(DISTINCT gm.user_id) AS total_members,
        COUNT(DISTINCT d.id) AS total_devotionals,
        COALESCE((SELECT SUM(dp.points_awarded) FROM devotionals dp WHERE dp.group_id = g.id), 0) AS total_group_points,
        COALESCE(AVG(mem.current_streak), 0) AS avg_streak
      FROM groups g
      LEFT JOIN users u ON u.id = g.leader_id
      LEFT JOIN group_members gm ON gm.group_id = g.id
      LEFT JOIN users mem ON mem.id = gm.user_id
      LEFT JOIN devotionals d ON d.group_id = g.id
      WHERE g.church_id = ?
      GROUP BY g.id
      ORDER BY total_group_points DESC, avg_streak DESC
    `).all(churchId) as any[];

    const rankedGroups = groupsStats.map((grp, index) => {
      const avgPointsPerMember = grp.total_members > 0 ? Math.round(grp.total_group_points / grp.total_members) : 0;
      return {
        position: index + 1,
        ...grp,
        avg_streak: Math.round(grp.avg_streak * 10) / 10,
        avg_points_per_member: avgPointsPerMember,
        badge: index === 0 ? '🏆 1º Lugar' : index === 1 ? '🥈 2º Lugar' : index === 2 ? '🥉 3º Lugar' : null,
      };
    });

    return res.json(rankedGroups);
  } catch (err: any) {
    console.error('Erro em getGroupsRanking:', err);
    return res.status(500).json({ error: 'Erro ao carregar ranking de grupos.' });
  }
};

export const getRewards = (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const churchId = req.user?.church_id;

    const user = db.prepare('SELECT total_points FROM users WHERE id = ?').get(userId) as any;
    const userPoints = user ? user.total_points : 0;
    issueCoupons(userId!, churchId!);

    const quarter = db.prepare('SELECT * FROM quarters WHERE church_id = ? AND is_active = 1 AND start_date <= ? AND end_date >= ? LIMIT 1').get(churchId, localDay(), localDay()) as any;
    if (!quarter) {
      return res.json({ quarter: null, rewards: [] });
    }

    const rewards = db.prepare(`
      SELECT 
        r.*,
        g.title AS group_title,
        CASE 
          WHEN r.group_id IS NULL THEN 1 
          ELSE EXISTS(SELECT 1 FROM group_members gm WHERE gm.group_id = r.group_id AND gm.user_id = ?)
        END AS is_member_of_group,
        EXISTS(SELECT 1 FROM user_coupons uc WHERE uc.reward_id = r.id AND uc.user_id = ?) AS already_claimed,
        (SELECT uc.status FROM user_coupons uc WHERE uc.reward_id = r.id AND uc.user_id = ? LIMIT 1) AS coupon_status,
        (SELECT uc.coupon_code FROM user_coupons uc WHERE uc.reward_id = r.id AND uc.user_id = ? LIMIT 1) AS coupon_code
      FROM rewards r
      LEFT JOIN groups g ON g.id = r.group_id
      WHERE r.quarter_id = ? AND r.church_id = ?
      ORDER BY 
        CASE WHEN r.group_id IS NOT NULL THEN 0 ELSE 1 END,
        r.reward_type ASC,
        r.podium_position ASC,
        r.points_required ASC
    `).all(userId, userId, userId, userId, quarter.id, churchId) as any[];

    const rewardsWithProgress = rewards.map((rew) => {
      const isPodium = rew.reward_type === 'podium';
      const progressPercent = isPodium 
        ? (rew.already_claimed ? 100 : 0)
        : Math.min(100, Math.round((userPoints / Math.max(1, rew.points_required)) * 100));
      const unlocked = isPodium ? !!rew.already_claimed : (userPoints >= rew.points_required && !!rew.is_member_of_group);

      return {
        ...rew,
        user_points: userPoints,
        progress_percent: progressPercent,
        unlocked,
        points_remaining: isPodium ? 0 : Math.max(0, rew.points_required - userPoints),
      };
    });

    return res.json({
      quarter,
      user_points: userPoints,
      rewards: rewardsWithProgress,
    });
  } catch (err: any) {
    console.error('Erro em getRewards:', err);
    return res.status(500).json({ error: 'Erro ao carregar catálogo de recompensas.' });
  }
};

export const getMyCoupons = (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const churchId = req.user?.church_id;

    issueCoupons(userId!, churchId!);
    const coupons = db.prepare(`
      SELECT 
        uc.id,
        uc.coupon_code,
        uc.qr_code_data,
        CASE WHEN uc.status = 'active' AND (q.end_date < '${localDay()}' OR q.is_active = 0) THEN 'expired' ELSE uc.status END AS status,
        uc.redeemed_at,
        uc.created_at,
        r.title AS reward_title,
        r.description AS reward_description,
        r.tier,
        r.points_required,
        r.partner_name,
        r.group_id,
        r.reward_type,
        r.podium_position,
        g.title AS group_title,
        q.title AS quarter_title
      FROM user_coupons uc
      INNER JOIN rewards r ON r.id = uc.reward_id
      INNER JOIN quarters q ON q.id = r.quarter_id
      LEFT JOIN groups g ON g.id = r.group_id
      WHERE uc.user_id = ? AND uc.church_id = ?
      ORDER BY 
        CASE uc.status WHEN 'active' THEN 1 ELSE 2 END,
        uc.created_at DESC
    `).all(userId, churchId);

    return res.json(coupons);
  } catch (err: any) {
    console.error('Erro em getMyCoupons:', err);
    return res.status(500).json({ error: 'Erro ao carregar cupons.' });
  }
};

export const validateAndRedeemCoupon = (req: Request, res: Response) => {
  try {
    const leaderId = req.user?.id;
    const churchId = req.user?.church_id;
    const { couponCode } = req.body;

    if (!couponCode) {
      return res.status(400).json({ error: 'Informe o código do cupom ou leia o QR Code.' });
    }

    const cleanCode = couponCode.trim().toUpperCase();

    const coupon = db.prepare(`
      SELECT 
        uc.*,
        u.name AS member_name,
        u.email AS member_email,
        r.title AS reward_title,
        r.tier,
        r.partner_name
      FROM user_coupons uc
      INNER JOIN users u ON u.id = uc.user_id
      INNER JOIN rewards r ON r.id = uc.reward_id
      WHERE uc.coupon_code = ? AND uc.church_id = ?
    `).get(cleanCode, churchId) as any;

    if (!coupon) {
      return res.status(404).json({ error: 'Cupom inválido ou não pertencente a esta igreja.' });
    }

    const period = db.prepare('SELECT q.end_date, q.is_active FROM rewards r JOIN quarters q ON q.id = r.quarter_id WHERE r.id = ?').get(coupon.reward_id) as any;
    if (coupon.status === 'expired' || !period?.is_active || period.end_date < localDay()) return res.status(400).json({ error: 'Este cupom está expirado.' });
    if (coupon.status === 'used') {
      return res.status(400).json({
        error: `Este cupom já foi resgatado em ${coupon.redeemed_at}.`,
        coupon,
      });
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE user_coupons
      SET status = 'used', redeemed_at = ?, redeemed_by_leader_id = ?
      WHERE id = ? AND status = 'active'
    `).run(now, leaderId, coupon.id);

    return res.json({
      message: '✅ Cupom validado e resgatado com sucesso!',
      redeemed_at: now,
      coupon: {
        ...coupon,
        status: 'used',
        redeemed_at: now,
      },
    });
  } catch (err: any) {
    console.error('Erro em validateAndRedeemCoupon:', err);
    return res.status(500).json({ error: 'Erro ao validar cupom.' });
  }
};

/**
 * GINCANA AMISTOSA INTER-IGREJAS (Por Convite Pastoral)
 */
export const getActiveChallenge = (req: Request, res: Response) => {
  try {
    const churchId = req.user?.church_id;

    // Buscar desafio em que a igreja participa
    const participant = db.prepare(`
      SELECT cp.*, icc.title, icc.description, icc.start_date, icc.end_date, icc.invite_code, icc.status, icc.id AS challenge_id
      FROM challenge_participants cp
      INNER JOIN inter_church_challenges icc ON icc.id = cp.challenge_id
      WHERE cp.church_id = ? AND icc.status = 'active'
      LIMIT 1
    `).get(churchId) as any;

    if (!participant) {
      return res.json({ active_challenge: null, leaderboard: [] });
    }

    // Leaderboard com todas as igrejas participantes
    const leaderboard = db.prepare(`
      SELECT 
        c.id AS church_id,
        c.name AS church_name,
        c.logo_url AS church_logo,
        c.city,
        c.state,
        cp.total_points_earned,
        cp.active_members_count,
        cp.joined_at
      FROM challenge_participants cp
      INNER JOIN churches c ON c.id = cp.church_id
      WHERE cp.challenge_id = ?
      ORDER BY cp.total_points_earned DESC
    `).all(participant.challenge_id) as any[];

    const rankedLeaderboard = leaderboard.map((item, idx) => ({
      position: idx + 1,
      ...item,
      badge: idx === 0 ? '👑 Líder' : idx === 1 ? '🥈 2º Lugar' : '🥉 3º Lugar',
    }));

    return res.json({
      active_challenge: participant,
      leaderboard: rankedLeaderboard,
    });
  } catch (err: any) {
    console.error('Erro em getActiveChallenge:', err);
    return res.status(500).json({ error: 'Erro ao carregar desafio inter-igrejas.' });
  }
};

export const createInterChurchChallenge = (req: Request, res: Response) => {
  try {
    const churchId = req.user?.church_id;
    const { title, description, startDate, endDate } = req.body;

    if (!title || !startDate || !endDate) {
      return res.status(400).json({ error: 'Título, data inicial e final são obrigatórios.' });
    }

    const challengeId = `chal-${crypto.randomUUID()}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < startDate || title.trim().length < 3) return res.status(400).json({ error: 'Confira o título e as datas da jornada.' });
    const cleanCode = 'JORNADA-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO inter_church_challenges (id, title, description, created_by_church_id, invite_code, start_date, end_date, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `).run(challengeId, title.trim(), description || '', churchId, cleanCode, startDate, endDate, now);

    // Igreja criadora entra automaticamente
    db.prepare(`
      INSERT INTO challenge_participants (id, challenge_id, church_id, total_points_earned, active_members_count, joined_at)
      VALUES (?, ?, ?, 0, 1, ?)
    `).run(`cp-part-${crypto.randomUUID()}`, challengeId, churchId, now);

    return res.status(201).json({
      message: 'Gincana criada com sucesso! Envie o código para o pastor da igreja parceira.',
      challenge: {
        id: challengeId,
        title,
        invite_code: cleanCode,
        start_date: startDate,
        end_date: endDate,
      },
    });
  } catch (err: any) {
    console.error('Erro ao criar gincana:', err);
    return res.status(500).json({ error: 'Erro ao criar desafio inter-igrejas.' });
  }
};

export const joinInterChurchChallenge = (req: Request, res: Response) => {
  try {
    const churchId = req.user?.church_id;
    const { inviteCode } = req.body;

    if (!inviteCode) {
      return res.status(400).json({ error: 'Código de convite da gincana é obrigatório.' });
    }

    const challenge = db.prepare('SELECT * FROM inter_church_challenges WHERE UPPER(invite_code) = UPPER(?) AND status = \'active\'').get(inviteCode.trim()) as any;
    if (!challenge) {
      return res.status(404).json({ error: 'Desafio não encontrado ou já finalizado.' });
    }

    const existing = db.prepare('SELECT id FROM challenge_participants WHERE challenge_id = ? AND church_id = ?').get(challenge.id, churchId);
    if (existing) {
      return res.status(400).json({ error: 'Sua igreja já está participando desta gincana!' });
    }

    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO challenge_participants (id, challenge_id, church_id, total_points_earned, active_members_count, joined_at)
      VALUES (?, ?, ?, 0, 1, ?)
    `).run(`cp-part-${crypto.randomUUID()}`, challenge.id, churchId, now);

    return res.status(201).json({
      message: `Sua igreja entrou com sucesso no desafio "${challenge.title}"! Que Deus abençoe a comunhão.`,
      challenge,
    });
  } catch (err: any) {
    console.error('Erro ao entrar na gincana:', err);
    return res.status(500).json({ error: 'Erro ao entrar na gincana.' });
  }
};
