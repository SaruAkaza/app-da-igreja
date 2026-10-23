import { localDay, previousDay } from '../config/runtime.js';
import { Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../config/database.js';
import { calculateCycleMath, closeGroupCycleAndAwardPodium } from '../services/rewards.js';
import { accessibleGroup, managesGroup, groupScoreSql } from '../services/groupAccess.js';

const validDay = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const validCycleDates = (start: unknown, end: unknown) => (!start || validDay(start)) && (!end || validDay(end)) && (!start || !end || String(end) >= String(start));

export const listGroups = (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const churchId = req.user?.church_id;
    const today = localDay();

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

    return res.json((groups as any[]).map(g => ({ ...g, invite_code: g.is_member || managesGroup(req.user!, g) ? g.invite_code : null })));
  } catch (err: any) {
    console.error('Erro ao listar grupos:', err);
    return res.status(500).json({ error: 'Erro ao listar grupos.' });
  }
};

export const myGroups = (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const churchId = req.user?.church_id;
    const today = localDay();

    const groups = db.prepare(`
      SELECT 
        g.*,
        u.name AS leader_name,
        (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS member_count,
        (SELECT COUNT(*) FROM devotionals d WHERE d.group_id = g.id) AS devotional_count,
        EXISTS(SELECT 1 FROM devotionals d WHERE d.group_id = g.id AND d.user_id = ? AND d.devotional_date = ?) AS posted_today
      FROM groups g
      LEFT JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ?
      LEFT JOIN users u ON u.id = g.leader_id
      WHERE (gm.user_id = ? OR (g.leader_id = ? AND ? = 'leader')) AND g.church_id = ?
      ORDER BY g.title ASC
    `).all(userId, today, userId, userId, userId, req.user!.role, churchId);

    return res.json((groups as any[]).map(g => {
      const manage = managesGroup(req.user!, g);
      const counts = db.prepare(`SELECT COUNT(*) FILTER (WHERE answer IS NULL) AS open_questions,
        COUNT(*) FILTER (WHERE author_id = ? AND answer IS NOT NULL AND answer_read_at IS NULL) AS unread_answers
        FROM group_questions WHERE group_id = ? AND church_id = ? AND (author_id = ? OR ?)`)
        .get(userId, g.id, churchId, userId, manage ? 1 : 0) as any;
      const score = db.prepare(`SELECT ${groupScoreSql('?', 'g.id')} AS points FROM groups g WHERE g.id = ?`).get(userId, g.id) as any;
      const member = db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(g.id, userId);
      return { ...g, ...counts, group_points: score.points, can_manage: manage, is_member: !!member };
    }));
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
    const today = localDay();

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

    if (!accessibleGroup(id, req.user!)) return res.status(403).json({ error: 'Entre neste grupo para acompanhar seus participantes.' });

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
      can_manage: managesGroup(req.user!, group),
      can_manage_rewards: req.user!.role === 'church_admin',
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

    if ((!inviteCode && !groupId) || (inviteCode !== undefined && typeof inviteCode !== 'string') || (groupId !== undefined && typeof groupId !== 'string')) return res.status(400).json({ error: 'Informe um código de convite válido.' });
    if (!churchId && !inviteCode) return res.status(403).json({ error: 'Use um código de convite para entrar na sua igreja.' });

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
    if (churchId && churchId !== targetGroup.church_id) return res.status(403).json({ error: 'Este grupo pertence a outra igreja.' });
    if (!churchId) {
      churchId = targetGroup.church_id;
    }

    const existing = db.prepare('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?').get(targetGroup.id, userId);
    if (existing) {
      return res.status(400).json({ error: 'Você já faz parte deste grupo!', group: targetGroup });
    }

    const memberId = `gm-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    db.transaction(() => {
      if (!req.user!.church_id) db.prepare("UPDATE users SET church_id = ?, role = 'member' WHERE id = ?").run(churchId, userId);
      db.prepare('INSERT INTO group_members (id, group_id, user_id, joined_at) VALUES (?, ?, ?, ?)').run(memberId, targetGroup.id, userId, now);
    })();

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

    const group = db.prepare('SELECT leader_id FROM groups WHERE id = ? AND church_id = ?').get(id, req.user!.church_id) as any;
    if (!group) return res.status(404).json({ error: 'Grupo não encontrado.' });
    if (group.leader_id === userId) return res.status(409).json({ error: 'Defina outro líder responsável antes de sair deste grupo.' });

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
    const { title, description, category, book_or_theme, cover_image, invite_code, leaderId, cycle_start_date, cycle_end_date, cycleStartDate, cycleEndDate } = req.body;

    if (!title || !category || !book_or_theme) {
      return res.status(400).json({ error: 'Título, categoria (biblia/livro) e tema são obrigatórios.' });
    }

    if (!['biblia', 'livro'].includes(category)) return res.status(400).json({ error: 'Categoria inválida.' });
    if (!churchId) return res.status(400).json({ error: 'Vincule-se a uma igreja primeiro.' });
    const selectedLeader = leaderId || req.user?.id;
    const leaderUser = db.prepare("SELECT id FROM users WHERE id = ? AND church_id = ? AND role IN ('leader','church_admin')").get(selectedLeader, churchId);
    if (!leaderUser || (req.user?.role === 'leader' && selectedLeader !== req.user.id)) return res.status(403).json({ error: 'Escolha um líder autorizado desta igreja.' });
    const cleanCode = (invite_code || title.substring(0, 4) + Math.floor(1000 + Math.random() * 9000)).toUpperCase().replace(/\s+/g, '');
    const existing = db.prepare('SELECT id FROM groups WHERE invite_code = ?').get(cleanCode);
    if (existing) {
      return res.status(409).json({ error: 'Já existe um grupo com este código de convite.' });
    }

    const startVal = cycle_start_date || cycleStartDate || null;
    const endVal = cycle_end_date || cycleEndDate || null;
    if (!validCycleDates(startVal, endVal)) return res.status(400).json({ error: 'Informe datas válidas para o ciclo, com término igual ou posterior ao início.' });

    const groupId = `grp-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const cover = cover_image || 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600';
    const leader = leaderId || req.user?.id;

    db.prepare(`
      INSERT INTO groups (id, church_id, leader_id, title, description, category, book_or_theme, cover_image, invite_code, cycle_start_date, cycle_end_date, cycle_status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `).run(groupId, churchId, leader, title.trim(), description || '', category, book_or_theme.trim(), cover, cleanCode, startVal, endVal, now);

    // O criador e o líder escolhido entram automaticamente no grupo.
    for (const memberId of new Set([req.user?.id, leader].filter(Boolean))) {
      db.prepare(`
        INSERT INTO group_members (id, group_id, user_id, joined_at)
        VALUES (?, ?, ?, ?)
      `).run(`gm-${crypto.randomUUID()}`, groupId, memberId, now);
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
        cycle_start_date: startVal,
        cycle_end_date: endVal,
        cycle_status: 'active',
      },
    });
  } catch (err: any) {
    console.error('Erro ao criar grupo:', err);
    return res.status(500).json({ error: 'Erro ao criar grupo.' });
  }
};

export const updateGroup = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const churchId = req.user?.church_id;
    const userRole = req.user?.role;
    const userId = req.user?.id;

    const group = db.prepare('SELECT * FROM groups WHERE id = ? AND church_id = ?').get(id, churchId) as any;
    if (!group) return res.status(404).json({ error: 'Grupo não encontrado.' });

    const isLeader = group.leader_id === userId;
    const isAdmin = ['church_admin', 'super_admin'].includes(userRole || '');
    if (!isLeader && !isAdmin) {
      return res.status(403).json({ error: 'Você não tem permissão para editar este grupo.' });
    }

    const { title, description, category, book_or_theme, cover_image, leader_id, cycle_start_date, cycle_end_date, cycleStartDate, cycleEndDate, cycle_status, cycleStatus } = req.body;

    if (!title || !category || !book_or_theme) {
      return res.status(400).json({ error: 'Título, categoria e livro/tema são obrigatórios.' });
    }
    if (!['biblia', 'livro'].includes(category)) {
      return res.status(400).json({ error: 'Categoria inválida. Escolha biblia ou livro.' });
    }

    let newLeaderId = group.leader_id;
    if (isAdmin && leader_id !== undefined) {
      if (leader_id) {
        const leaderUser = db.prepare("SELECT id FROM users WHERE id = ? AND church_id = ? AND role IN ('leader', 'church_admin')").get(leader_id, churchId);
        if (!leaderUser) return res.status(400).json({ error: 'Líder inválido ou não autorizado nesta igreja.' });
        newLeaderId = leader_id;
      } else {
        newLeaderId = null;
      }
    }

    const newStart = cycle_start_date !== undefined ? cycle_start_date : (cycleStartDate !== undefined ? cycleStartDate : group.cycle_start_date);
    const newEnd = cycle_end_date !== undefined ? cycle_end_date : (cycleEndDate !== undefined ? cycleEndDate : group.cycle_end_date);
    const newStatus = cycle_status !== undefined ? cycle_status : (cycleStatus !== undefined ? cycleStatus : (group.cycle_status || 'active'));
    if (!validCycleDates(newStart, newEnd)) return res.status(400).json({ error: 'Informe datas válidas para o ciclo, com término igual ou posterior ao início.' });
    if (!['active', 'completed'].includes(newStatus)) return res.status(400).json({ error: 'Situação do ciclo inválida.' });
    if (newStatus !== (group.cycle_status || 'active')) return res.status(400).json({ error: 'Use a ação de encerrar ciclo para concluir o grupo. Um ciclo encerrado não pode ser reaberto.' });

    db.prepare(`
      UPDATE groups SET
        title = ?,
        description = ?,
        category = ?,
        book_or_theme = ?,
        cover_image = ?,
        leader_id = ?,
        cycle_start_date = ?,
        cycle_end_date = ?,
        cycle_status = ?
      WHERE id = ? AND church_id = ?
    `).run(
      title.trim(),
      description !== undefined ? description : group.description,
      category,
      book_or_theme.trim(),
      cover_image || group.cover_image,
      newLeaderId,
      newStart,
      newEnd,
      newStatus,
      id,
      churchId
    );

    // Se houver novo líder, garantir que ele esteja inscrito no grupo
    if (newLeaderId) {
      const isMember = db.prepare('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?').get(id, newLeaderId);
      if (!isMember) {
        db.prepare('INSERT INTO group_members (id, group_id, user_id, joined_at) VALUES (?, ?, ?, ?)').run(`gm-${crypto.randomUUID()}`, id, newLeaderId, new Date().toISOString());
      }
    }

    const updated = db.prepare('SELECT * FROM groups WHERE id = ?').get(id);
    return res.json({
      message: 'Grupo atualizado com sucesso!',
      group: updated,
    });
  } catch (err: any) {
    console.error('Erro ao atualizar grupo:', err);
    return res.status(500).json({ error: 'Erro ao atualizar grupo.' });
  }
};

export const deleteGroup = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const churchId = req.user?.church_id;
    const userRole = req.user?.role;

    if (!['church_admin', 'super_admin'].includes(userRole || '')) {
      return res.status(403).json({ error: 'Apenas administradores podem excluir grupos.' });
    }

    const group = db.prepare('SELECT * FROM groups WHERE id = ? AND church_id = ?').get(id, churchId) as any;
    if (!group) return res.status(404).json({ error: 'Grupo não encontrado.' });

    if (db.prepare('SELECT id FROM rewards WHERE group_id = ? AND church_id = ? LIMIT 1').get(id, churchId)) return res.status(409).json({ error: 'Revise ou remova os prêmios vinculados antes de excluir este grupo.' });

    db.transaction(() => {
      // Limpar reações e feedbacks dos devocionais deste grupo
      db.prepare('DELETE FROM reactions WHERE devotional_id IN (SELECT id FROM devotionals WHERE group_id = ?)').run(id);
      db.prepare('DELETE FROM leader_feedbacks WHERE group_id = ?').run(id);
      db.prepare('DELETE FROM devotionals WHERE group_id = ?').run(id);
      db.prepare('DELETE FROM group_members WHERE group_id = ?').run(id);
      db.prepare('DELETE FROM groups WHERE id = ? AND church_id = ?').run(id, churchId);
    })();

    return res.json({ message: `O grupo "${group.title}" foi excluído com sucesso.` });
  } catch (err: any) {
    console.error('Erro ao excluir grupo:', err);
    return res.status(500).json({ error: 'Erro ao excluir grupo.' });
  }
};

export const listGroupMembers = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const churchId = req.user?.church_id;

    const group = db.prepare('SELECT * FROM groups WHERE id = ? AND church_id = ?').get(id, churchId) as any;
    if (!group) return res.status(404).json({ error: 'Grupo não encontrado.' });
    if (!accessibleGroup(id, req.user!)) return res.status(403).json({ error: 'Você não participa deste grupo.' });
    const manage = managesGroup(req.user!, group);

    const members = db.prepare(`
      SELECT 
        u.id,
        u.name,
        ${manage ? 'u.email' : 'NULL AS email'},
        u.role,
        u.avatar_url,
        u.current_streak,
        u.total_points,
        gm.joined_at,
        (u.id = ?) AS is_leader
      FROM group_members gm
      INNER JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = ? AND u.church_id = ?
      ORDER BY is_leader DESC, u.name ASC
    `).all(group.leader_id, id, churchId);

    return res.json({
      group: {
        id: group.id,
        title: group.title,
        leader_id: group.leader_id,
        invite_code: group.invite_code,
      },
      members,
    });
  } catch (err: any) {
    console.error('Erro ao listar membros do grupo:', err);
    return res.status(500).json({ error: 'Erro ao listar membros do grupo.' });
  }
};

export const addGroupMember = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    const churchId = req.user?.church_id;
    const userRole = req.user?.role;

    if (!['leader', 'church_admin', 'super_admin'].includes(userRole || '')) {
      return res.status(403).json({ error: 'Permissão negada.' });
    }

    if (!userId) return res.status(400).json({ error: 'ID do membro é obrigatório.' });

    const group = db.prepare('SELECT * FROM groups WHERE id = ? AND church_id = ?').get(id, churchId) as any;
    if (!group) return res.status(404).json({ error: 'Grupo não encontrado.' });

    if (userRole === 'leader' && group.leader_id !== req.user?.id) return res.status(403).json({ error: 'Somente o líder responsável pode adicionar membros a este grupo.' });

    const targetUser = db.prepare('SELECT id, name FROM users WHERE id = ? AND church_id = ?').get(userId, churchId) as any;
    if (!targetUser) return res.status(404).json({ error: 'Membro não encontrado nesta congregação.' });

    const existing = db.prepare('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?').get(id, userId);
    if (existing) return res.status(409).json({ error: 'Este membro já participa deste grupo.' });

    db.prepare('INSERT INTO group_members (id, group_id, user_id, joined_at) VALUES (?, ?, ?, ?)').run(
      `gm-${crypto.randomUUID()}`,
      id,
      userId,
      new Date().toISOString()
    );

    return res.status(201).json({ message: `${targetUser.name} foi adicionado(a) ao grupo.` });
  } catch (err: any) {
    console.error('Erro ao adicionar membro ao grupo:', err);
    return res.status(500).json({ error: 'Erro ao adicionar membro ao grupo.' });
  }
};

export const removeGroupMember = (req: Request, res: Response) => {
  try {
    const { id, userId } = req.params;
    const churchId = req.user?.church_id;
    const userRole = req.user?.role;

    if (!['leader', 'church_admin', 'super_admin'].includes(userRole || '')) {
      return res.status(403).json({ error: 'Permissão negada.' });
    }

    const group = db.prepare('SELECT * FROM groups WHERE id = ? AND church_id = ?').get(id, churchId) as any;
    if (!group) return res.status(404).json({ error: 'Grupo não encontrado.' });

    if (userRole === 'leader' && group.leader_id !== req.user?.id) return res.status(403).json({ error: 'Somente o líder responsável pode remover membros deste grupo.' });

    if (group.leader_id === userId) {
      return res.status(400).json({ error: 'Não é possível remover o líder do grupo. Troque a liderança antes de remover.' });
    }

    const result = db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(id, userId);
    if (result.changes === 0) return res.status(404).json({ error: 'Membro não participa deste grupo.' });

    return res.json({ message: 'Membro removido do grupo com sucesso.' });
  } catch (err: any) {
    console.error('Erro ao remover membro do grupo:', err);
    return res.status(500).json({ error: 'Erro ao remover membro do grupo.' });
  }
};

export const getGroupCycleDetails = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const churchId = req.user?.church_id;
    const group = db.prepare('SELECT * FROM groups WHERE id = ? AND church_id = ?').get(id, churchId) as any;
    if (!group) return res.status(404).json({ error: 'Grupo não encontrado.' });
    if (!accessibleGroup(id, req.user!)) return res.status(403).json({ error: 'Você não participa deste grupo.' });

    const cycleMath = calculateCycleMath(group.cycle_start_date, group.cycle_end_date);

    // Top 3 membros do grupo em pontuação (Pódio)
    const podiumMembers = db.prepare(`
      SELECT u.id, u.name, u.avatar_url, ${groupScoreSql('u.id', '?')} AS total_points, gm.joined_at
      FROM group_members gm
      JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = ? AND u.church_id = ?
      ORDER BY total_points DESC, gm.joined_at ASC, u.id ASC
      LIMIT 3
    `).all(id, id, churchId) as any[];

    // Prêmios vinculados a este grupo (por pontos e por pódio)
    const groupRewards = db.prepare(`
      SELECT r.*,
        EXISTS(SELECT 1 FROM user_coupons uc WHERE uc.reward_id = r.id AND uc.user_id = ?) AS already_claimed
      FROM rewards r
      WHERE r.group_id = ? AND r.church_id = ?
      ORDER BY r.reward_type ASC, r.podium_position ASC, r.points_required ASC
    `).all(req.user?.id, id, churchId);

    return res.json({
      group: {
        id: group.id,
        title: group.title,
        description: group.description,
        cycle_start_date: group.cycle_start_date,
        cycle_end_date: group.cycle_end_date,
        cycle_status: group.cycle_status || 'active',
        cycle_closed_at: group.cycle_closed_at,
      },
      cycleMath,
      podiumMembers: podiumMembers.map((m, idx) => ({ position: idx + 1, ...m })),
      groupRewards,
    });
  } catch (err: any) {
    console.error('Erro em getGroupCycleDetails:', err);
    return res.status(500).json({ error: 'Erro ao buscar dados do ciclo do grupo.' });
  }
};

export const closeGroupCycleEndpoint = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const churchId = req.user?.church_id;
    const userRole = req.user?.role;
    const userId = req.user?.id;

    const group = db.prepare('SELECT * FROM groups WHERE id = ? AND church_id = ?').get(id, churchId) as any;
    if (!group) return res.status(404).json({ error: 'Grupo não encontrado.' });

    const isLeader = group.leader_id === userId;
    const isAdmin = ['church_admin', 'super_admin'].includes(userRole || '');
    if (!isLeader && !isAdmin) {
      return res.status(403).json({ error: 'Apenas o líder do grupo ou administradores podem encerrar o ciclo.' });
    }
    if (group.cycle_status === 'completed') return res.status(409).json({ error: 'Este ciclo já foi encerrado.' });

    const result = closeGroupCycleAndAwardPodium(id, churchId!, userId);
    return res.json({
      message: 'Ciclo encerrado com sucesso e prêmios do pódio concedidos aos vencedores!',
      result,
    });
  } catch (err: any) {
    console.error('Erro ao encerrar ciclo do grupo:', err);
    return res.status(500).json({ error: err.message || 'Erro ao encerrar ciclo do grupo.' });
  }
};
