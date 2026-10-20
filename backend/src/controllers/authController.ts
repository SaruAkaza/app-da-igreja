import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../config/database.js';
import { generateToken, UserRole } from '../middleware/auth.js';

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, churchCode } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios (nome, email e senha).' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      return res.status(409).json({ error: 'Este e-mail já está cadastrado. Tente fazer login.' });
    }

    // Identificar a Igreja através do código ou usar a igreja padrão (Videira)
    let church: any = null;
    if (churchCode) {
      church = db.prepare('SELECT * FROM churches WHERE UPPER(slug_code) = UPPER(?)').get(churchCode.trim());
      if (!church) {
        return res.status(404).json({ error: 'Igreja não encontrada com o código fornecido.' });
      }
    } else {
      church = db.prepare('SELECT * FROM churches ORDER BY created_at ASC LIMIT 1').get();
    }

    if (!church) {
      return res.status(500).json({ error: 'Nenhuma igreja cadastrada no sistema.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = `usr-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const insertUser = db.prepare(`
      INSERT INTO users (id, church_id, name, email, password_hash, role, current_streak, highest_streak, total_points, avatar_url, created_at)
      VALUES (?, ?, ?, ?, ?, 'member', 0, 0, 0, ?, ?)
    `);

    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2563eb&color=fff&size=200`;
    insertUser.run(userId, church.id, name.trim(), cleanEmail, passwordHash, defaultAvatar, now);

    // Ingressar automaticamente no primeiro grupo de estudo da igreja
    const firstGroup = db.prepare('SELECT id FROM groups WHERE church_id = ? ORDER BY created_at ASC LIMIT 1').get(church.id) as { id: string } | undefined;
    if (firstGroup) {
      db.prepare(`
        INSERT INTO group_members (id, group_id, user_id, joined_at)
        VALUES (?, ?, ?, ?)
      `).run(`gm-${crypto.randomUUID()}`, firstGroup.id, userId, now);
    }

    const userPayload = {
      id: userId,
      church_id: church.id,
      name: name.trim(),
      email: cleanEmail,
      role: 'member' as UserRole,
    };
    const token = generateToken(userPayload);

    return res.status(201).json({
      message: 'Cadastro realizado com sucesso!',
      token,
      user: {
        id: userId,
        church_id: church.id,
        church_name: church.name,
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

export const registerChurch = async (req: Request, res: Response) => {
  try {
    const { churchName, city, state, denomination, pastorName, email, password } = req.body;

    if (!churchName || !pastorName || !email || !password) {
      return res.status(400).json({ error: 'Nome da igreja, nome do pastor, e-mail e senha são obrigatórios.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      return res.status(409).json({ error: 'Este e-mail já está cadastrado no sistema.' });
    }

    const churchId = `chu-${crypto.randomUUID()}`;
    // Gerar código amigável para convite de membros (ex: VIDEIRA26)
    const cleanSlug = (churchName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8) + '26').toUpperCase();

    const now = new Date().toISOString();
    const logoUrl = 'https://images.unsplash.com/photo-1548625361-19598285a815?w=200';

    // Iniciar transação para criar igreja + pastor + trimestre inicial
    const createTransaction = db.transaction(() => {
      db.prepare(`
        INSERT INTO churches (id, name, slug_code, city, state, denomination, logo_url, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(churchId, churchName.trim(), cleanSlug, city || '', state || '', denomination || '', logoUrl, now);

      const userId = `usr-${crypto.randomUUID()}`;
      const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(pastorName)}&background=1e40af&color=fff&size=200`;

      // Senha em hash síncrono para a transação
      const passwordHash = bcrypt.hashSync(password, 10);

      db.prepare(`
        INSERT INTO users (id, church_id, name, email, password_hash, role, current_streak, highest_streak, total_points, avatar_url, created_at)
        VALUES (?, ?, ?, ?, ?, 'church_admin', 0, 0, 0, ?, ?)
      `).run(userId, churchId, pastorName.trim(), cleanEmail, passwordHash, defaultAvatar, now);

      // Criar trimestre inicial
      const quarterId = `qtr-${crypto.randomUUID()}`;
      db.prepare(`
        INSERT INTO quarters (id, church_id, title, start_date, end_date, is_active, created_at)
        VALUES (?, ?, '1º Trimestre - O Hábito da Palavra', '2026-01-01', '2026-03-31', 1, ?)
      `).run(quarterId, churchId, now);

      return { userId, churchId, cleanSlug };
    });

    const result = createTransaction();

    const userPayload = {
      id: result.userId,
      church_id: result.churchId,
      name: pastorName.trim(),
      email: cleanEmail,
      role: 'church_admin' as UserRole,
    };
    const token = generateToken(userPayload);

    return res.status(201).json({
      message: 'Igreja e perfil pastoral cadastrados com sucesso!',
      token,
      church: {
        id: result.churchId,
        name: churchName.trim(),
        slug_code: result.cleanSlug,
      },
      user: {
        id: result.userId,
        name: pastorName.trim(),
        email: cleanEmail,
        role: 'church_admin',
      },
    });
  } catch (err: any) {
    console.error('Erro ao cadastrar igreja:', err);
    return res.status(500).json({ error: 'Erro interno ao cadastrar igreja.' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Informe e-mail e senha.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.prepare(`
      SELECT u.*, c.name AS church_name, c.slug_code AS church_code, c.logo_url AS church_logo
      FROM users u
      INNER JOIN churches c ON c.id = u.church_id
      WHERE u.email = ?
    `).get(cleanEmail) as any;

    if (!user) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    // Verificar quebra de streak
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    let streak = user.current_streak;
    if (user.last_devotional_date && user.last_devotional_date < yesterday) {
      streak = 0;
      db.prepare('UPDATE users SET current_streak = 0 WHERE id = ?').run(user.id);
    }

    const token = generateToken({
      id: user.id,
      church_id: user.church_id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

    return res.json({
      message: 'Login realizado com sucesso!',
      token,
      user: {
        id: user.id,
        church_id: user.church_id,
        church_name: user.church_name,
        church_code: user.church_code,
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
    const user = db.prepare(`
      SELECT 
        u.id, u.church_id, u.name, u.email, u.role, u.current_streak, u.highest_streak, 
        u.last_devotional_date, u.total_points, u.avatar_url, u.created_at,
        c.name AS church_name, c.slug_code AS church_code, c.logo_url AS church_logo
      FROM users u
      INNER JOIN churches c ON c.id = u.church_id
      WHERE u.id = ?
    `).get(userId) as any;

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const today = new Date().toISOString().slice(0, 10);
    const completedToday = user.last_devotional_date === today;

    // Resumo de cupons ativos
    const activeCouponsCount = db.prepare("SELECT COUNT(*) as count FROM user_coupons WHERE user_id = ? AND status = 'active'").get(userId) as { count: number };
    const totalDevotionalsCount = db.prepare('SELECT COUNT(*) as count FROM devotionals WHERE user_id = ?').get(userId) as { count: number };
    
    // Contagem de orientações pastorais não lidas / recebidas
    const feedbacksCount = db.prepare('SELECT COUNT(*) as count FROM leader_feedbacks WHERE member_id = ?').get(userId) as { count: number };

    return res.json({
      ...user,
      completed_today: completedToday,
      active_coupons_count: activeCouponsCount.count,
      total_devotionals_count: totalDevotionalsCount.count,
      feedbacks_count: feedbacksCount.count,
    });
  } catch (err: any) {
    console.error('Erro em getMe:', err);
    return res.status(500).json({ error: 'Erro ao buscar perfil.' });
  }
};
