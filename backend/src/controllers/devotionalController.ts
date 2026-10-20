import { Request, Response } from 'express';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { db } from '../config/database.js';

export const createDevotional = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado.' });
    }

    const { groupId, passageOrChapter, notes } = req.body;
    let imageUrl = '';

    if (req.file) {
      // Arquivo enviado via upload multipart
      imageUrl = `/uploads/devotionals/${req.file.filename}`;
    } else if (req.body.imageUrl) {
      imageUrl = req.body.imageUrl;
    } else {
      return res.status(400).json({ error: 'É obrigatório anexar a foto da sua folha de devocional manuscrita.' });
    }

    if (!groupId) {
      return res.status(400).json({ error: 'Identificador do grupo é obrigatório.' });
    }

    // Verificar se o usuário participa do grupo
    const membership = db.prepare('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, userId);
    if (!membership) {
      // Ingressar automaticamente se for o grupo padrão
      db.prepare(`
        INSERT INTO group_members (id, group_id, user_id, joined_at)
        VALUES (?, ?, ?, ?)
      `).run(`gm-${crypto.randomUUID()}`, groupId, userId, new Date().toISOString());
    }

    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    // Verificar se já postou neste grupo hoje
    const alreadyPostedInGroup = db.prepare(`
      SELECT id FROM devotionals 
      WHERE group_id = ? AND user_id = ? AND devotional_date = ?
    `).get(groupId, userId, today);

    if (alreadyPostedInGroup) {
      return res.status(400).json({
        error: 'Você já registrou seu devocional de hoje neste grupo! Descanse na Palavra e volte amanhã.',
      });
    }

    // Buscar dados atuais do usuário
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;

    let newStreak = user.current_streak;
    let streakBonus = 0;

    // Se o usuário ainda não fez devocional hoje em nenhum grupo
    if (user.last_devotional_date !== today) {
      if (user.last_devotional_date === yesterday) {
        newStreak = user.current_streak + 1;
      } else {
        newStreak = 1; // Primeiro dia ou reinício de sequência
      }
      // Bônus de streak: 10 pontos por dia consecutivo (limitado a +100 por dia)
      streakBonus = Math.min(newStreak * 10, 100);
    }

    const highestStreak = Math.max(user.highest_streak, newStreak);
    const basePoints = 50; // Pontos pelo envio autêntico da folha
    const totalPointsAwarded = basePoints + streakBonus;
    const newTotalPoints = user.total_points + totalPointsAwarded;

    const devotionalId = `dev-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    // Iniciar transação no SQLite para garantir consistência
    const insertTransaction = db.transaction(() => {
      // 1. Criar Devocional
      db.prepare(`
        INSERT INTO devotionals (id, group_id, user_id, image_url, passage_or_chapter, notes, points_awarded, devotional_date, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        devotionalId,
        groupId,
        userId,
        imageUrl,
        passageOrChapter || '',
        notes || '',
        totalPointsAwarded,
        today,
        now
      );

      // 2. Atualizar Usuário
      db.prepare(`
        UPDATE users 
        SET total_points = ?, current_streak = ?, highest_streak = ?, last_devotional_date = ?
        WHERE id = ?
      `).run(newTotalPoints, newStreak, highestStreak, today, userId);

      // 3. Registrar Histórico de Pontos
      db.prepare(`
        INSERT INTO point_history (id, user_id, amount, reason, reference_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(`ph-${crypto.randomUUID()}`, userId, basePoints, 'devotional_post', devotionalId, now);

      if (streakBonus > 0) {
        db.prepare(`
          INSERT INTO point_history (id, user_id, amount, reason, reference_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(`ph-${crypto.randomUUID()}`, userId, streakBonus, 'streak_bonus', devotionalId, now);
      }
    });

    insertTransaction();

    // 4. Verificar se o novo total de pontos desbloqueia novos cupons no trimestre ativo
    const unlockedCoupons: any[] = [];
    const activeQuarter = db.prepare('SELECT id, title FROM quarters WHERE is_active = 1 LIMIT 1').get() as any;

    if (activeQuarter) {
      const eligibleRewards = db.prepare(`
        SELECT r.* FROM rewards r
        WHERE r.quarter_id = ? AND r.points_required <= ?
        AND NOT EXISTS (
          SELECT 1 FROM user_coupons uc WHERE uc.reward_id = r.id AND uc.user_id = ?
        )
      `).all(activeQuarter.id, newTotalPoints, userId) as any[];

      for (const reward of eligibleRewards) {
        const couponId = `cp-${crypto.randomUUID()}`;
        const tierPrefix = reward.tier.toUpperCase().slice(0, 3);
        const code = `CUPOM-${tierPrefix}-${Math.floor(100000 + Math.random() * 900000)}`;
        const qrData = await QRCode.toDataURL(code);

        db.prepare(`
          INSERT INTO user_coupons (id, user_id, reward_id, coupon_code, qr_code_data, status, created_at)
          VALUES (?, ?, ?, ?, ?, 'active', ?)
        `).run(couponId, userId, reward.id, code, qrData, now);

        unlockedCoupons.push({
          id: couponId,
          coupon_code: code,
          qr_code_data: qrData,
          reward_title: reward.title,
          tier: reward.tier,
          partner_name: reward.partner_name,
        });
      }
    }

    return res.status(201).json({
      message: 'Devocional publicado com sucesso! Parabéns pela fidelidade!',
      devotional: {
        id: devotionalId,
        group_id: groupId,
        user_id: userId,
        image_url: imageUrl,
        passage_or_chapter: passageOrChapter,
        notes,
        points_awarded: totalPointsAwarded,
        devotional_date: today,
        created_at: now,
      },
      points_earned: {
        base: basePoints,
        streak_bonus: streakBonus,
        total: totalPointsAwarded,
      },
      user_stats: {
        current_streak: newStreak,
        highest_streak: highestStreak,
        total_points: newTotalPoints,
      },
      unlocked_coupons: unlockedCoupons,
    });
  } catch (err: any) {
    console.error('Erro ao postar devocional:', err);
    return res.status(500).json({ error: 'Erro interno ao publicar devocional.' });
  }
};

export const getFeed = (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { groupId, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT 
        d.*,
        u.name AS user_name,
        u.avatar_url AS user_avatar,
        u.role AS user_role,
        u.current_streak AS user_streak,
        g.title AS group_title,
        (SELECT COUNT(*) FROM reactions r WHERE r.devotional_id = d.id AND r.reaction_type = 'amen') AS amen_count,
        (SELECT COUNT(*) FROM reactions r WHERE r.devotional_id = d.id AND r.reaction_type = 'glory') AS glory_count,
        (SELECT COUNT(*) FROM reactions r WHERE r.devotional_id = d.id AND r.reaction_type = 'heart') AS heart_count,
        EXISTS(SELECT 1 FROM reactions r WHERE r.devotional_id = d.id AND r.user_id = ? AND r.reaction_type = 'amen') AS reacted_amen,
        EXISTS(SELECT 1 FROM reactions r WHERE r.devotional_id = d.id AND r.user_id = ? AND r.reaction_type = 'glory') AS reacted_glory,
        EXISTS(SELECT 1 FROM reactions r WHERE r.devotional_id = d.id AND r.user_id = ? AND r.reaction_type = 'heart') AS reacted_heart
      FROM devotionals d
      INNER JOIN users u ON u.id = d.user_id
      INNER JOIN groups g ON g.id = d.group_id
    `;

    const params: any[] = [userId, userId, userId];

    if (groupId) {
      query += ` WHERE d.group_id = ? `;
      params.push(groupId);
    } else {
      // Se não especificou grupo, traz o feed dos grupos em que o usuário participa
      query += ` WHERE d.group_id IN (SELECT group_id FROM group_members WHERE user_id = ?) `;
      params.push(userId);
    }

    query += ` ORDER BY d.created_at DESC LIMIT ? OFFSET ? `;
    params.push(Number(limit), offset);

    const posts = db.prepare(query).all(...params);

    return res.json(posts);
  } catch (err: any) {
    console.error('Erro ao buscar feed:', err);
    return res.status(500).json({ error: 'Erro ao buscar publicações do feed.' });
  }
};

export const toggleReaction = (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { devotionalId } = req.params;
    const { reactionType } = req.body; // 'amen', 'glory', 'heart'

    if (!['amen', 'glory', 'heart'].includes(reactionType)) {
      return res.status(400).json({ error: "Tipo de reação inválido. Use 'amen', 'glory' ou 'heart'." });
    }

    const existing = db.prepare('SELECT id FROM reactions WHERE devotional_id = ? AND user_id = ? AND reaction_type = ?').get(devotionalId, userId, reactionType) as any;

    if (existing) {
      db.prepare('DELETE FROM reactions WHERE id = ?').run(existing.id);
      return res.json({ message: 'Reação removida.', active: false, reactionType });
    } else {
      const reactionId = `reac-${crypto.randomUUID()}`;
      db.prepare(`
        INSERT INTO reactions (id, devotional_id, user_id, reaction_type, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(reactionId, devotionalId, userId, reactionType, new Date().toISOString());
      return res.json({ message: 'Reação adicionada!', active: true, reactionType });
    }
  } catch (err: any) {
    console.error('Erro em toggleReaction:', err);
    return res.status(500).json({ error: 'Erro ao processar reação.' });
  }
};
