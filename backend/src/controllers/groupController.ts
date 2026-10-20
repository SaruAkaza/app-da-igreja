import { Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../config/database.js';

export const listGroups = (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const churchId = req.user?.church_id;
    const today = new Date().toISOString().slice(0, 10);

    const groups = db.prepare(`
      SELECT 
        g.*,
        u.name AS leader_name,
        u.avatar_url AS leader_avatar,
        (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS member_count,
        (SELECT COUNT(*) FROM devotionals d WHERE d.group_id = g.id) AS devotional_count,
        EXISTS(SELECT 1 FROM group_members gm WHERE gm.group_id = g.id AND gm.user_id = ?) AS is_member,
        EXISTS(SELECT 1 FROM devotionals d WHERE d.group_id = g.id AND d.user_id = ? AND d.devotional_date = ?) AS posted_today
      FROM groups g
      LEFT JOIN users u ON u.id = g.leader_id
      WHERE g.church_id = ?
      ORDER BY g.created_at ASC
    `).all(userId, userId, today, churchId);

    return res.json(groups);
  } catch (err: any) {
    console.error('Erro ao listar grupos:', err);
    return res.status(500).json({ error: 'Erro ao listar grupos.' });
  }
};

export const myGroups = (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const churchId = req.user?.church_id;
    const today = new Date().toISOString().slice(0, 10);

    const groups = db.prepare(`
      SELECT 
        g.*,
        u.name AS leader_name,
        (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS member_count,
        (SELECT COUNT(*) FROM devotionals d WHERE d.group_id = g.id) AS devotional_count,
        EXISTS(SELECT 1 FROM devotionals d WHERE d.group_id = g.id AND d.user_id = ? AND d.devotional_date = ?) AS posted_today
      FROM groups g
      INNER JOIN group_members gm ON gm.group_id = g.id
      LEFT JOIN users u ON u.id = g.leader_id
      WHERE gm.user_id = ? AND g.church_id = ?
      ORDER BY g.title ASC
    `).all(userId, today, userId, churchId);

    return res.json(groups);
  } catch (err: any) {
    console.error('Erro ao buscar meus grupos:', err);
    return res.status(500).json({ error: 'Erro ao buscar grupos do usuário.' });
  }
};

export const getGroupDetails = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const churchId = req.user?.church_id;
    const today = new Date().toISOString().slice(0, 10);

    const group = db.prepare(`
      SELECT 
        g.*,
        u.name AS leader_name,
        u.avatar_url AS leader_avatar,
        (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS member_count,
        (SELECT COUNT(*) FROM devotionals d WHERE d.group_id = g.id) AS devotional_count,
        EXISTS(SELECT 1 FROM group_members gm WHERE gm.group_id = g.id AND gm.user_id = ?) AS is_member,
        EXISTS(SELECT 1 FROM devotionals d WHERE d.group_id = g.id AND d.user_id = ? AND d.devotional_date = ?) AS posted_today
      FROM groups g
      LEFT JOIN users u ON u.id = g.leader_id
      WHERE g.id = ? AND g.church_id = ?
    `).get(userId, userId, today, id, churchId) as any;

    if (!group) {
      return res.status(404).json({ error: 'Grupo não encontrado.' });
    }

    // Membros do grupo com indicador de quem já fez devocional hoje
    const members = db.prepare(`
      SELECT 
        u.id,
        u.name,
        u.role,
        u.avatar_url,
        u.current_streak,
        u.total_points,
        gm.joined_at,
        EXISTS(SELECT 1 FROM devotionals d WHERE d.group_id = ? AND d.user_id = u.id AND d.devotional_date = ?) AS did_devotional_today
      FROM users u
      INNER JOIN group_members gm ON gm.user_id = u.id
      WHERE gm.group_id = ? AND u.church_id = ?
      ORDER BY did_devotional_today DESC, u.current_streak DESC, u.name ASC
    `).all(id, today, id, churchId);

    return res.json({
      ...group,
      members,
    });
  } catch (err: any) {
    console.error('Erro em getGroupDetails:', err);
    return res.status(500).json({ error: 'Erro ao buscar detalhes do grupo.' });
  }
};

export const joinGroup = (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    let churchId = req.user?.church_id;
    const { groupId, inviteCode } = req.body;

    let targetGroup: any;

    if (inviteCode) {
      if (churchId) {
        targetGroup = db.prepare('SELECT * FROM groups WHERE UPPER(invite_code) = UPPER(?) AND church_id = ?').get(inviteCode.trim(), churchId);
      }
      if (!targetGroup) {
        targetGroup = db.prepare('SELECT * FROM groups WHERE UPPER(invite_code) = UPPER(?)').get(inviteCode.trim());
      }
    } else if (groupId) {
      targetGroup = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId);
    }

    if (!targetGroup) {
      return res.status(404).json({ error: 'Grupo não encontrado com o código fornecido.' });
    }

    // Se o usuário ainda não tiver igreja vinculada, vincula à igreja deste grupo
    if (!churchId || churchId !== targetGroup.church_id) {
      db.prepare('UPDATE users SET church_id = ? WHERE id = ?').run(targetGroup.church_id, userId);
      churchId = targetGroup.church_id;
    }

    const existing = db.prepare('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?').get(targetGroup.id, userId);
    if (existing) {
      return res.status(400).json({ error: 'Você já faz parte deste grupo!', group: targetGroup });
    }

    const memberId = `gm-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO group_members (id, group_id, user_id, joined_at)
      VALUES (?, ?, ?, ?)
    `).run(memberId, targetGroup.id, userId, now);

    return res.status(201).json({
      message: `Bem-vindo(a) ao grupo "${targetGroup.title}"!`,
      group: targetGroup,
    });
  } catch (err: any) {
    console.error('Erro ao entrar no grupo:', err);
    return res.status(500).json({ error: 'Erro ao entrar no grupo.' });
  }
};

export const leaveGroup = (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const result = db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(id, userId);
    if (result.changes === 0) {
      return res.status(400).json({ error: 'Você não participa deste grupo.' });
    }

    return res.json({ message: 'Você saiu do grupo.' });
  } catch (err: any) {
    console.error('Erro ao sair do grupo:', err);
    return res.status(500).json({ error: 'Erro ao sair do grupo.' });
  }
};

export const createGroup = (req: Request, res: Response) => {
  try {
    const churchId = req.user?.church_id;
    const { title, description, category, book_or_theme, cover_image, invite_code, leaderId } = req.body;

    if (!title || !category || !book_or_theme) {
      return res.status(400).json({ error: 'Título, categoria (biblia/livro) e tema são obrigatórios.' });
    }

    const cleanCode = (invite_code || title.substring(0, 4) + Math.floor(1000 + Math.random() * 9000)).toUpperCase().replace(/\s+/g, '');
    const existing = db.prepare('SELECT id FROM groups WHERE invite_code = ?').get(cleanCode);
    if (existing) {
      return res.status(409).json({ error: 'Já existe um grupo com este código de convite.' });
    }

    const groupId = `grp-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const cover = cover_image || 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600';
    const leader = leaderId || req.user?.id;

    db.prepare(`
      INSERT INTO groups (id, church_id, leader_id, title, description, category, book_or_theme, cover_image, invite_code, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(groupId, churchId, leader, title.trim(), description || '', category, book_or_theme.trim(), cover, cleanCode, now);

    // O criador/líder entra automaticamente no grupo
    if (req.user?.id) {
      db.prepare(`
        INSERT INTO group_members (id, group_id, user_id, joined_at)
        VALUES (?, ?, ?, ?)
      `).run(`gm-${crypto.randomUUID()}`, groupId, req.user.id, now);
    }

    return res.status(201).json({
      message: 'Grupo criado com sucesso!',
      group: {
        id: groupId,
        church_id: churchId,
        leader_id: leader,
        title,
        description,
        category,
        book_or_theme,
        cover_image: cover,
        invite_code: cleanCode,
      },
    });
  } catch (err: any) {
    console.error('Erro ao criar grupo:', err);
    return res.status(500).json({ error: 'Erro ao criar grupo.' });
  }
};
