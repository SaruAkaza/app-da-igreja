import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../config/database.js';
import { jwtSecret } from '../config/runtime.js';
export const JWT_SECRET = jwtSecret;
export type UserRole = 'member' | 'leader' | 'church_admin' | 'super_admin';
export interface AuthUser { id: string; church_id: string; email: string; name: string; role: UserRole }
declare global { namespace Express { interface Request { user?: AuthUser } } }
export function generateToken(user: AuthUser): string {
  const record = db.prepare('SELECT session_version FROM users WHERE id = ?').get(user.id) as any;
  return jwt.sign({ id: user.id, version: record?.session_version || 0 }, JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' });
}
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Entre na sua conta para continuar.' });
  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload;
    const user = db.prepare('SELECT id, church_id, email, name, role, session_version FROM users WHERE id = ?').get(decoded.id) as any;
    if (!user || (decoded.version ?? -1) !== user.session_version) throw new Error('Sessão revogada');
    req.user = { ...user, church_id: user.church_id || '' };
    next();
  } catch { return res.status(401).json({ error: 'Sua sessão expirou. Entre novamente.' }); }
}
export function requireRole(...roles: Array<UserRole | 'admin'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
    if (!roles.some(role => role === req.user!.role || (role === 'admin' && req.user!.role === 'church_admin'))) return res.status(403).json({ error: 'Seu perfil não tem permissão para esta ação.' });
    next();
  };
}
