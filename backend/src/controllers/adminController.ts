import { Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../config/database.js';

export const getDashboardStats = (req: Request, res: Response) => {
  try {
    const totalMembers = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    const totalDevotionals = db.prepare('SELECT COUNT(*) as count FROM devotionals').get() as { count: number };
    const totalGroups = db.prepare('SELECT COUNT(*) as count FROM groups').get() as { count: number };
    const pointsSum = db.prepare('SELECT SUM(total_points) as sum FROM users').get() as { sum: number };
    const activeCoupons = db.prepare("SELECT COUNT(*) as count FROM user_coupons WHERE status = 'active'").get() as { count: number };
    const usedCoupons = db.prepare("SELECT COUNT(*) as count FROM user_coupons WHERE status = 'used'").get() as { count: number };

    // Devocionais de hoje
    const today = new Date().toISOString().slice(0, 10);
    const todayDevotionals = db.prepare('SELECT COUNT(*) as count FROM devotionals WHERE devotional_date = ?').get(today) as { count: number };

    // Últimos devocionais para moderação/auditoria
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
        g.title AS group_title
      FROM devotionals d
      INNER JOIN users u ON u.id = d.user_id
      INNER JOIN groups g ON g.id = d.group_id
      ORDER BY d.created_at DESC
      LIMIT 15
    `).all();

    // Top 5 sequências ativas (fogo do hábito)
    const topStreaks = db.prepare(`
      SELECT id, name, avatar_url, current_streak, total_points
      FROM users
      ORDER BY current_streak DESC, total_points DESC
      LIMIT 5
    `).all();

    // Ranking de Grupos com maior engajamento
    const groupEngagement = db.prepare(`
      SELECT 
        g.id,
        g.title,
        g.category,
        COUNT(DISTINCT gm.user_id) AS members_count,
        COUNT(d.id) AS devotionals_count
      FROM groups g
      LEFT JOIN group_members gm ON gm.group_id = g.id
      LEFT JOIN devotionals d ON d.group_id = g.id
      GROUP BY g.id
      ORDER BY devotionals_count DESC
    `).all();

    return res.json({
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
    });
  } catch (err: any) {
    console.error('Erro em getDashboardStats:', err);
    return res.status(500).json({ error: 'Erro ao carregar estatísticas do painel.' });
  }
};

export const listMembers = (req: Request, res: Response) => {
  try {
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
        (SELECT COUNT(*) FROM user_coupons uc WHERE uc.user_id = u.id) AS coupons_count
      FROM users u
      ORDER BY u.total_points DESC, u.name ASC
    `).all();

    return res.json(members);
  } catch (err: any) {
    console.error('Erro em listMembers:', err);
    return res.status(500).json({ error: 'Erro ao listar membros.' });
  }
};

export const awardBonusPoints = (req: Request, res: Response) => {
  try {
    const { userId, amount, reason } = req.body;

    if (!userId || !amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Informe o ID do membro e uma quantidade válida de pontos (> 0).' });
    }

    const user = db.prepare('SELECT id, name, total_points FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      return res.status(404).json({ error: 'Membro não encontrado.' });
    }

    const bonusAmount = Number(amount);
    const newTotal = user.total_points + bonusAmount;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE users SET total_points = ? WHERE id = ?
    `).run(newTotal, userId);

    db.prepare(`
      INSERT INTO point_history (id, user_id, amount, reason, reference_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(`ph-${crypto.randomUUID()}`, userId, bonusAmount, reason || 'Bônus Administrativo / Destaque', null, now);

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
    return res.status(500).json({ error: 'Erro ao atribuir pontos de bônus.' });
  }
};

export const deleteDevotional = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { deductPoints } = req.query;

    const devotional = db.prepare('SELECT * FROM devotionals WHERE id = ?').get(id) as any;
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

    return res.json({ message: 'Devocional moderado/excluído com sucesso.' });
  } catch (err: any) {
    console.error('Erro em deleteDevotional:', err);
    return res.status(500).json({ error: 'Erro ao excluir devocional.' });
  }
};

export const updateUserRole = (req: Request, res: Response) => {
  try {
    const { userId, role } = req.body;
    if (!['member', 'leader', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Cargo inválido. Escolha: member, leader ou admin.' });
    }

    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
    return res.json({ message: `Cargo do usuário atualizado para ${role} com sucesso.` });
  } catch (err: any) {
    console.error('Erro em updateUserRole:', err);
    return res.status(500).json({ error: 'Erro ao atualizar cargo.' });
  }
};
