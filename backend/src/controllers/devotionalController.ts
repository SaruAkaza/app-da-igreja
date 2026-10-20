import fs from 'node:fs';
import path from 'node:path';
import { uploadsDir } from '../config/runtime.js';
import { imageExtension } from '../middleware/upload.js';
import { issueCoupons } from '../services/rewards.js';
import { localDay, previousDay } from '../config/runtime.js';
import { Request, Response } from 'express';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { db } from '../config/database.js';

export const createDevotional = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const churchId = req.user?.church_id;

    if (!userId || !churchId) {
      return res.status(401).json({ error: 'Usuário não autenticado.' });
    }

    const { groupId, passageOrChapter, notes } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Anexe a foto da sua anotação.' });
    const extension = imageExtension(req.file.buffer);
    if (!extension) return res.status(400).json({ error: 'O arquivo não contém uma imagem JPEG, PNG ou WebP válida.' });
    const group = db.prepare('SELECT id FROM groups WHERE id = ? AND church_id = ?').get(groupId || '', churchId);
    if (!group) return res.status(404).json({ error: 'Grupo não encontrado nesta igreja.' });
    const membership = db.prepare('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, userId);
    if (!membership) return res.status(403).json({ error: 'Entre no grupo antes de enviar sua anotação.' });
    if (typeof passageOrChapter !== 'string' || !passageOrChapter.trim() || passageOrChapter.length > 200 || (notes && (typeof notes !== 'string' || notes.length > 5000))) return res.status(400).json({ error: 'Informe a passagem (até 200 caracteres) e uma reflexão com até 5.000 caracteres.' });
    const filename = crypto.randomUUID() + extension;
    const imageUrl = '/uploads/devotionals/' + filename;
    const today = localDay();
    const yesterday = previousDay();

    // Limite de 1 envio pontuado por grupo por dia
    const alreadyPostedInGroup = db.prepare(`
      SELECT id FROM devotionals 
      WHERE group_id = ? AND user_id = ? AND devotional_date = ?
    `).get(groupId, userId, today);

    if (alreadyPostedInGroup) {
      return res.status(409).json({
        error: 'Você já registrou seu devocional de hoje neste grupo! Descanse na Palavra e volte amanhã.',
      });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;

    let newStreak = user.current_streak;
    let streakBonus = 0;

    if (user.last_devotional_date !== today) {
      if (user.last_devotional_date === yesterday) {
        newStreak = user.current_streak + 1;
      } else {
        newStreak = 1;
      }
      streakBonus = Math.min(newStreak * 10, 100);
    }

    const highestStreak = Math.max(user.highest_streak, newStreak);
    const basePoints = 50;
    const totalPointsAwarded = basePoints + streakBonus;
    const newTotalPoints = user.total_points + totalPointsAwarded;

    const devotionalId = `dev-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const insertTransaction = db.transaction(() => {
      // 1. Criar Devocional
      db.prepare(`
        INSERT INTO devotionals (id, church_id, group_id, user_id, image_url, passage_or_chapter, notes, points_awarded, devotional_date, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        devotionalId,
        churchId,
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

      // 3. Histórico de Pontos
      db.prepare(`
        INSERT INTO point_history (id, church_id, user_id, amount, reason, reference_id, created_at)
        VALUES (?, ?, ?, ?, 'devotional_post', ?, ?)
      `).run(`ph-${crypto.randomUUID()}`, churchId, userId, basePoints, devotionalId, now);

      if (streakBonus > 0) {
        db.prepare(`
          INSERT INTO point_history (id, church_id, user_id, amount, reason, reference_id, created_at)
          VALUES (?, ?, ?, ?, 'streak_bonus', ?, ?)
        `).run(`ph-${crypto.randomUUID()}`, churchId, userId, streakBonus, devotionalId, now);
      }

      // 4. Se a igreja participa de uma Gincana Inter-Igrejas ativa, pontua a congregação no desafio!
      const activeChallenge = db.prepare(`
        SELECT cp.id, cp.total_points_earned 
        FROM challenge_participants cp
        INNER JOIN inter_church_challenges icc ON icc.id = cp.challenge_id
        WHERE cp.church_id = ? AND icc.status = 'active' AND icc.start_date <= ? AND icc.end_date >= ?
        LIMIT 1
      `).get(churchId, today, today) as any;

      if (activeChallenge) {
        db.prepare(`
          UPDATE challenge_participants
          SET total_points_earned = total_points_earned + ?
          WHERE id = ?
        `).run(totalPointsAwarded, activeChallenge.id);
      }
    });

    fs.mkdirSync(uploadsDir, { recursive: true });
    const photoPath = path.join(uploadsDir, filename);
    fs.writeFileSync(photoPath, req.file.buffer);
    try { insertTransaction(); } catch (error) { fs.unlinkSync(photoPath); throw error; }

    const unlockedCoupons = issueCoupons(userId, churchId);

    return res.status(201).json({
      message: 'Devocional registrado! Sua anotação foi entregue ao seu líder para discipulado com total sigilo.',
      devotional: {
        id: devotionalId,
        group_id: groupId,
        user_id: userId,
        passage_or_chapter: passageOrChapter,
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

/**
 * FEED COM PRIVACIDADE RIGOROSA:
 * - O feed da congregação celebra a fidelidade comunitária.
 * - Para membros em geral: a foto e a anotação pessoal NÃO SÃO ENVIADAS (são null).
 * - Apenas o próprio autor, o líder responsável pelo grupo ou o pastor geral têm acesso à foto e anotação.
 */
export const getFeed = (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const churchId = req.user?.church_id;
    const userRole = req.user?.role;
    const { groupId, page = 1, limit = 20 } = req.query;
    const pageNumber = Number(page); const pageSize = Number(limit);
    if (!Number.isInteger(pageNumber) || pageNumber < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) return res.status(400).json({ error: 'Paginação inválida: página >= 1, limite entre 1 e 100.' });
    const offset = (pageNumber - 1) * pageSize;
    if (groupId && !db.prepare('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, userId) && !['church_admin','super_admin'].includes(userRole || '')) return res.status(403).json({ error: 'Entre neste grupo para acompanhar as publicações.' });

    let query = `
      SELECT 
        d.id,
        d.group_id,
        d.user_id,
        d.image_url,
        d.passage_or_chapter,
        d.notes,
        d.points_awarded,
        d.devotional_date,
        d.created_at,
        u.name AS user_name,
        u.avatar_url AS user_avatar,
        u.role AS user_role,
        u.current_streak AS user_streak,
        g.title AS group_title,
        g.leader_id AS group_leader_id,
        (SELECT COUNT(*) FROM reactions r WHERE r.devotional_id = d.id AND r.reaction_type = 'amen') AS amen_count,
        (SELECT COUNT(*) FROM reactions r WHERE r.devotional_id = d.id AND r.reaction_type = 'glory') AS glory_count,
        (SELECT COUNT(*) FROM reactions r WHERE r.devotional_id = d.id AND r.reaction_type = 'heart') AS heart_count,
        EXISTS(SELECT 1 FROM reactions r WHERE r.devotional_id = d.id AND r.user_id = ? AND r.reaction_type = 'amen') AS reacted_amen,
        EXISTS(SELECT 1 FROM reactions r WHERE r.devotional_id = d.id AND r.user_id = ? AND r.reaction_type = 'glory') AS reacted_glory,
        EXISTS(SELECT 1 FROM reactions r WHERE r.devotional_id = d.id AND r.user_id = ? AND r.reaction_type = 'heart') AS reacted_heart,
        (SELECT pastoral_guidance FROM leader_feedbacks lf WHERE lf.devotional_id = d.id LIMIT 1) AS leader_feedback
      FROM devotionals d
      INNER JOIN users u ON u.id = d.user_id
      INNER JOIN groups g ON g.id = d.group_id
      WHERE d.church_id = ?
    `;

    const params: any[] = [userId, userId, userId, churchId];

    if (groupId) {
      query += ` AND d.group_id = ? `;
      params.push(groupId);
    } else {
      query += ` AND d.group_id IN (SELECT group_id FROM group_members WHERE user_id = ?) `;
      params.push(userId);
    }

    query += ` ORDER BY d.created_at DESC LIMIT ? OFFSET ? `;
    params.push(Number(limit), offset);

    const posts = db.prepare(query).all(...params) as any[];

    // Sanitização de privacidade por linha
    const safePosts = posts.map((post) => {
      const isAuthor = post.user_id === userId;
      const isGroupLeader = post.group_leader_id === userId;
      const isPastorOrAdmin = userRole === 'church_admin' || userRole === 'super_admin';
      const hasFullAccess = isAuthor || isGroupLeader || isPastorOrAdmin;

      return {
        id: post.id,
        group_id: post.group_id,
        user_id: post.user_id,
        user_name: post.user_name,
        user_avatar: post.user_avatar,
        user_role: post.user_role,
        user_streak: post.user_streak,
        group_title: post.group_title,
        devotional_date: post.devotional_date,
        created_at: post.created_at,
        passage_or_chapter: post.passage_or_chapter,
        points_awarded: post.points_awarded,
        amen_count: post.amen_count,
        glory_count: post.glory_count,
        heart_count: post.heart_count,
        reacted_amen: Boolean(post.reacted_amen),
        reacted_glory: Boolean(post.reacted_glory),
        reacted_heart: Boolean(post.reacted_heart),
        has_feedback: Boolean(post.leader_feedback),
        // Privacidade estrita: só expõe a folha e anotações para quem tem autorização
        image_url: hasFullAccess ? (post.image_url.startsWith('/uploads/') ? '/api/devotionals/' + post.id + '/photo' : post.image_url) : null,
        notes: hasFullAccess ? post.notes : null,
        is_private_protected: !hasFullAccess,
        leader_feedback: isAuthor || isGroupLeader || isPastorOrAdmin ? post.leader_feedback : null,
      };
    });

    return res.json(safePosts);
  } catch (err: any) {
    console.error('Erro ao buscar feed:', err);
    return res.status(500).json({ error: 'Erro ao buscar publicações do feed.' });
  }
};

export const toggleReaction = (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { devotionalId } = req.params;
    const { reactionType } = req.body;

    if (!['amen', 'glory', 'heart'].includes(reactionType)) {
      return res.status(400).json({ error: "Tipo de reação inválido. Use 'amen', 'glory' ou 'heart'." });
    }

    const visible = db.prepare('SELECT d.id FROM devotionals d JOIN group_members gm ON gm.group_id = d.group_id WHERE d.id = ? AND d.church_id = ? AND gm.user_id = ?').get(devotionalId, req.user?.church_id, userId);
    if (!visible) return res.status(404).json({ error: 'Publicação não encontrada nos seus grupos.' });
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

/**
 * DISCIPULADO: O Líder do Grupo busca os devocionais para orientar os membros
 */
export const getLeaderDevotionals = (req: Request, res: Response) => {
  try {
    const leaderId = req.user?.id;
    const churchId = req.user?.church_id;
    const userRole = req.user?.role;

    let query = `
      SELECT 
        d.*,
        u.name AS member_name,
        u.email AS member_email,
        u.avatar_url AS member_avatar,
        u.current_streak AS member_streak,
        g.title AS group_title,
        (SELECT pastoral_guidance FROM leader_feedbacks lf WHERE lf.devotional_id = d.id LIMIT 1) AS existing_feedback,
        (SELECT created_at FROM leader_feedbacks lf WHERE lf.devotional_id = d.id LIMIT 1) AS feedback_date
      FROM devotionals d
      INNER JOIN users u ON u.id = d.user_id
      INNER JOIN groups g ON g.id = d.group_id
      WHERE d.church_id = ?
    `;

    const params: any[] = [churchId];

    // Se for pastor/admin geral da igreja, vê todos. Se for líder de grupo, vê os grupos dele.
    if (userRole !== 'church_admin' && userRole !== 'super_admin') {
      query += ` AND g.leader_id = ? `;
      params.push(leaderId);
    }

    const page = Number(req.query.page || 1);
    if (!Number.isInteger(page) || page < 1) return res.status(400).json({ error: 'Página inválida.' });
    if (req.query.status === 'pending') query += ' AND NOT EXISTS (SELECT 1 FROM leader_feedbacks lf WHERE lf.devotional_id = d.id)';
    if (req.query.status === 'done') query += ' AND EXISTS (SELECT 1 FROM leader_feedbacks lf WHERE lf.devotional_id = d.id)';
    query += ' ORDER BY d.created_at DESC, d.id DESC LIMIT 20 OFFSET ?';
    params.push((page - 1) * 20);

    const devotionals = db.prepare(query).all(...params);
    return res.json((devotionals as any[]).map(d => ({ ...d, image_url: d.image_url.startsWith('/uploads/') ? '/api/devotionals/' + d.id + '/photo' : d.image_url })));
  } catch (err: any) {
    console.error('Erro em getLeaderDevotionals:', err);
    return res.status(500).json({ error: 'Erro ao carregar devocionais para discipulado.' });
  }
};

/**
 * DISCIPULADO: O Líder envia uma orientação pastoral privada / dica exegética
 */
export const submitLeaderFeedback = (req: Request, res: Response) => {
  try {
    const leaderId = req.user?.id;
    const churchId = req.user?.church_id;
    const { devotionalId } = req.params;
    const { pastoralGuidance } = req.body;

    if (!pastoralGuidance || !pastoralGuidance.trim()) {
      return res.status(400).json({ error: 'Escreva a orientação pastoral para o membro.' });
    }

    const devotional = db.prepare('SELECT * FROM devotionals WHERE id = ? AND church_id = ?').get(devotionalId, churchId) as any;
    if (!devotional) {
      return res.status(404).json({ error: 'Devocional não encontrado.' });
    }

    const group = db.prepare('SELECT leader_id FROM groups WHERE id = ?').get(devotional.group_id) as any;
    if (!['church_admin', 'super_admin'].includes(req.user?.role || '') && group.leader_id !== leaderId) return res.status(403).json({ error: 'Somente o líder responsável pode orientar este grupo.' });
    if (pastoralGuidance.length > 5000) return res.status(400).json({ error: 'A orientação deve ter até 5.000 caracteres.' });
    if (db.prepare('SELECT id FROM leader_feedbacks WHERE devotional_id = ?').get(devotionalId)) return res.status(409).json({ error: 'Este devocional já recebeu uma orientação.' });
    const feedbackId = `fb-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO leader_feedbacks (id, church_id, group_id, devotional_id, leader_id, member_id, pastoral_guidance, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(feedbackId, churchId, devotional.group_id, devotional.id, leaderId, devotional.user_id, pastoralGuidance.trim(), now);

    return res.status(201).json({
      message: 'Orientação pastoral enviada com sucesso! O membro receberá sua dica com total sigilo.',
      feedback: {
        id: feedbackId,
        pastoral_guidance: pastoralGuidance.trim(),
        created_at: now,
      },
    });
  } catch (err: any) {
    console.error('Erro em submitLeaderFeedback:', err);
    return res.status(500).json({ error: 'Erro ao enviar orientação pastoral.' });
  }
};

/**
 * DISCIPULADO: O Membro consulta suas orientações pastorais recebidas
 */
export const getMyFeedbacks = (req: Request, res: Response) => {
  try {
    const memberId = req.user?.id;
    const churchId = req.user?.church_id;

    const feedbacks = db.prepare(`
      SELECT 
        lf.id,
        lf.pastoral_guidance,
        lf.created_at AS feedback_date,
        d.passage_or_chapter,
        d.devotional_date,
        d.notes AS my_notes,
        g.title AS group_title,
        u.name AS leader_name,
        u.avatar_url AS leader_avatar
      FROM leader_feedbacks lf
      INNER JOIN devotionals d ON d.id = lf.devotional_id
      INNER JOIN groups g ON g.id = lf.group_id
      INNER JOIN users u ON u.id = lf.leader_id
      WHERE lf.member_id = ? AND lf.church_id = ?
      ORDER BY lf.created_at DESC
    `).all(memberId, churchId);

    return res.json(feedbacks);
  } catch (err: any) {
    console.error('Erro em getMyFeedbacks:', err);
    return res.status(500).json({ error: 'Erro ao buscar orientações pastorais.' });
  }
};
