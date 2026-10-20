import { Request, Response } from 'express';
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

    const today = new Date().toISOString().slice(0, 10);
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
        COUNT(d.id) AS devotionals_count
      FROM groups g
      LEFT JOIN users u ON u.id = g.leader_id
      LEFT JOIN group_members gm ON gm.group_id = g.id
      LEFT JOIN devotionals d ON d.group_id = g.id
      WHERE g.church_id = ?
      GROUP BY g.id
      ORDER BY devotionals_count DESC
    `).all(churchId);

    // Gincana Ativa se houver
    const activeChallenge = db.prepare(`
      SELECT icc.*, cp.total_points_earned
      FROM inter_church_challenges icc
      INNER JOIN challenge_participants cp ON cp.challenge_id = icc.id
      WHERE cp.church_id = ? AND icc.status = 'active'
      LIMIT 1
    `).get(churchId);

    return res.json({
      church,
      summary: {
        total_members: totalMembers.count,
        total_devotionals: totalDevotionals.count,
        today_devotionals: todayDevotionals.count,
        total_groups: totalGroups.count,
        total_points_distributed: pointsSum.sum || 0,
        active_coupons: activeCoupons.count,
        used_coupons: usedCoupons.count,
      },
      recent_devotionals: recentDevotionals,
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

    if (!userId || !amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Informe o ID do membro e uma quantidade válida de pontos (> 0).' });
    }

    const user = db.prepare('SELECT id, name, total_points FROM users WHERE id = ? AND church_id = ?').get(userId, churchId) as any;
    if (!user) {
      return res.status(404).json({ error: 'Membro não encontrado nesta congregação.' });
    }

    const bonusAmount = Number(amount);
    const newTotal = user.total_points + bonusAmount;
    const now = new Date().toISOString();

    db.prepare('UPDATE users SET total_points = ? WHERE id = ?').run(newTotal, userId);

    db.prepare(`
      INSERT INTO point_history (id, church_id, user_id, amount, reason, reference_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(`ph-${crypto.randomUUID()}`, churchId, userId, bonusAmount, reason || 'Bônus Pastoral de Reconhecimento', null, now);

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

    if (deductPoints === 'true') {
      db.prepare(`
        UPDATE users 
        SET total_points = MAX(0, total_points - ?) 
        WHERE id = ?
      `).run(devotional.points_awarded, devotional.user_id);
    }

    db.prepare('DELETE FROM devotionals WHERE id = ?').run(id);

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

    db.prepare('UPDATE users SET role = ? WHERE id = ? AND church_id = ?').run(role, userId, churchId);
    return res.json({ message: `Cargo do usuário atualizado para ${role} com sucesso.` });
  } catch (err: any) {
    console.error('Erro em updateUserRole:', err);
    return res.status(500).json({ error: 'Erro ao atualizar cargo.' });
  }
};
