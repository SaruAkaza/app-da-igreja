import { Request, Response } from 'express';
import { db } from '../config/database.js';

export const getRanking = (req: Request, res: Response) => {
  try {
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
        WHERE gm.group_id = ?
        GROUP BY u.id
        ORDER BY u.total_points DESC, u.current_streak DESC, u.name ASC
        LIMIT 50
      `;
      params.push(groupId);
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
        GROUP BY u.id
        ORDER BY u.total_points DESC, u.current_streak DESC, u.name ASC
        LIMIT 50
      `;
    }

    const ranking = db.prepare(query).all(...params);

    // Adiciona posição no ranking
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

export const getRewards = (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const user = db.prepare('SELECT total_points FROM users WHERE id = ?').get(userId) as any;
    const userPoints = user ? user.total_points : 0;

    const quarter = db.prepare('SELECT * FROM quarters WHERE is_active = 1 LIMIT 1').get() as any;
    if (!quarter) {
      return res.json({ quarter: null, rewards: [] });
    }

    const rewards = db.prepare(`
      SELECT 
        r.*,
        EXISTS(SELECT 1 FROM user_coupons uc WHERE uc.reward_id = r.id AND uc.user_id = ?) AS already_claimed,
        (SELECT uc.status FROM user_coupons uc WHERE uc.reward_id = r.id AND uc.user_id = ? LIMIT 1) AS coupon_status,
        (SELECT uc.coupon_code FROM user_coupons uc WHERE uc.reward_id = r.id AND uc.user_id = ? LIMIT 1) AS coupon_code
      FROM rewards r
      WHERE r.quarter_id = ?
      ORDER BY r.points_required ASC
    `).all(userId, userId, userId, quarter.id) as any[];

    const rewardsWithProgress = rewards.map((rew) => {
      const progressPercent = Math.min(100, Math.round((userPoints / rew.points_required) * 100));
      const unlocked = userPoints >= rew.points_required;

      return {
        ...rew,
        user_points: userPoints,
        progress_percent: progressPercent,
        unlocked,
        points_remaining: Math.max(0, rew.points_required - userPoints),
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

    const coupons = db.prepare(`
      SELECT 
        uc.id,
        uc.coupon_code,
        uc.qr_code_data,
        uc.status,
        uc.redeemed_at,
        uc.created_at,
        r.title AS reward_title,
        r.description AS reward_description,
        r.tier,
        r.points_required,
        r.partner_name,
        q.title AS quarter_title
      FROM user_coupons uc
      INNER JOIN rewards r ON r.id = uc.reward_id
      INNER JOIN quarters q ON q.id = r.quarter_id
      WHERE uc.user_id = ?
      ORDER BY 
        CASE uc.status WHEN 'active' THEN 1 ELSE 2 END,
        uc.created_at DESC
    `).all(userId);

    return res.json(coupons);
  } catch (err: any) {
    console.error('Erro em getMyCoupons:', err);
    return res.status(500).json({ error: 'Erro ao carregar cupons.' });
  }
};

export const validateAndRedeemCoupon = (req: Request, res: Response) => {
  try {
    const leaderId = req.user?.id;
    const { couponCode } = req.body;

    if (!couponCode) {
      return res.status(400).json({ error: 'Informe o código do cupom ou leia o QR Code.' });
    }

    const cleanCode = couponCode.trim();

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
      WHERE uc.coupon_code = ?
    `).get(cleanCode) as any;

    if (!coupon) {
      return res.status(404).json({ error: 'Cupom inválido ou não encontrado no sistema.' });
    }

    if (coupon.status === 'used') {
      return res.status(400).json({
        error: `Este cupom já foi resgatado em ${coupon.redeemed_at}.`,
        coupon,
      });
    }

    if (coupon.status === 'expired') {
      return res.status(400).json({ error: 'Este cupom já está expirado.' });
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE user_coupons
      SET status = 'used', redeemed_at = ?, redeemed_by_leader_id = ?
      WHERE id = ?
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
