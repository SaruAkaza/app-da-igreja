import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../config/database.js';
import { generateToken } from '../middleware/auth.js';

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios (nome, email e senha).' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      return res.status(409).json({ error: 'Este e-mail já está cadastrado. Tente fazer login.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = `usr-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const insertUser = db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, current_streak, highest_streak, total_points, avatar_url, created_at)
      VALUES (?, ?, ?, ?, 'member', 0, 0, 0, ?, ?)
    `);

    // Avatar padrão
    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2563eb&color=fff&size=200`;
    insertUser.run(userId, name.trim(), cleanEmail, passwordHash, defaultAvatar, now);

    // Ingressar automaticamente no grupo padrão "Devocional no Livro de Tiago" se existir
    const defaultGroup = db.prepare("SELECT id FROM groups WHERE invite_code = 'TIAGO26' LIMIT 1").get() as { id: string } | undefined;
    if (defaultGroup) {
      db.prepare(`
        INSERT INTO group_members (id, group_id, user_id, joined_at)
        VALUES (?, ?, ?, ?)
      `).run(`gm-${crypto.randomUUID()}`, defaultGroup.id, userId, now);
    }

    const userPayload = { id: userId, name: name.trim(), email: cleanEmail, role: 'member' as const };
    const token = generateToken(userPayload);

    return res.status(201).json({
      message: 'Cadastro realizado com sucesso!',
      token,
      user: {
        id: userId,
        name: name.trim(),
        email: cleanEmail,
        role: 'member',
        current_streak: 0,
        total_points: 0,
        avatar_url: defaultAvatar,
      },
    });
  } catch (err: any) {
    console.error('Erro no registro:', err);
    return res.status(500).json({ error: 'Erro interno ao realizar cadastro.' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Informe e-mail e senha.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail) as any;

    if (!user) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    // Verificar se a sequência foi quebrada (se não postou ontem nem hoje)
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    let streak = user.current_streak;
    if (user.last_devotional_date && user.last_devotional_date < yesterday) {
      // Perdeu o streak, resetar para 0
      streak = 0;
      db.prepare('UPDATE users SET current_streak = 0 WHERE id = ?').run(user.id);
    }

    const token = generateToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

    return res.json({
      message: 'Login realizado com sucesso!',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        current_streak: streak,
        highest_streak: user.highest_streak,
        total_points: user.total_points,
        avatar_url: user.avatar_url,
      },
    });
  } catch (err: any) {
    console.error('Erro no login:', err);
    return res.status(500).json({ error: 'Erro interno ao realizar login.' });
  }
};

export const getMe = (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const user = db.prepare('SELECT id, name, email, role, current_streak, highest_streak, last_devotional_date, total_points, avatar_url, created_at FROM users WHERE id = ?').get(userId) as any;

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    // Checar se hoje já fez devocional
    const today = new Date().toISOString().slice(0, 10);
    const completedToday = user.last_devotional_date === today;

    // Resumo de cupons ativos
    const activeCouponsCount = db.prepare("SELECT COUNT(*) as count FROM user_coupons WHERE user_id = ? AND status = 'active'").get(userId) as { count: number };

    // Total de devocionais postados
    const totalDevotionalsCount = db.prepare('SELECT COUNT(*) as count FROM devotionals WHERE user_id = ?').get(userId) as { count: number };

    return res.json({
      ...user,
      completed_today: completedToday,
      active_coupons_count: activeCouponsCount.count,
      total_devotionals_count: totalDevotionalsCount.count,
    });
  } catch (err: any) {
    console.error('Erro em getMe:', err);
    return res.status(500).json({ error: 'Erro ao buscar perfil.' });
  }
};
