import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'chave-secreta-igreja-devocional-2026';

export type UserRole = 'member' | 'leader' | 'church_admin' | 'super_admin';

export interface AuthUser {
  id: string;
  church_id: string;
  email: string;
  name: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      church_id: user.church_id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acesso não autorizado. Faça login primeiro.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Sessão expirada ou token inválido. Faça login novamente.' });
    }
    req.user = decoded as AuthUser;
    next();
  });
}

export function requireRole(...allowedRoles: Array<UserRole | 'admin'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }
    // Mapeia legado 'admin' para 'church_admin' se necessário
    const userRole = req.user.role === 'church_admin' ? 'church_admin' : req.user.role;
    const isAllowed = allowedRoles.some((r) => r === userRole || (r === 'admin' && userRole === 'church_admin'));

    if (!isAllowed) {
      return res.status(403).json({
        error: `Acesso restrito para ${allowedRoles.join(' ou ')}. Seu cargo atual é: ${req.user.role}.`,
      });
    }
    next();
  };
}
