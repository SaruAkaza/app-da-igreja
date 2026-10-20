import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
export const backendRoot = fileURLToPath(new URL('../../', import.meta.url));
export const dataDir = path.resolve(process.env.DATA_DIR || path.join(backendRoot, 'data'));
export const uploadsDir = path.join(dataDir, 'uploads', 'devotionals');
export const demoMode = process.env.DEMO_MODE === 'true';
export const production = process.env.NODE_ENV === 'production';
if (production && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) throw new Error('Defina JWT_SECRET com pelo menos 32 caracteres em produção.');
if (production && demoMode) throw new Error('DEMO_MODE não pode ser habilitado em produção.');
export const jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');
export const appTimezone = process.env.APP_TIMEZONE || 'America/Sao_Paulo';
export function localDay(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: appTimezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const value = (type: string) => parts.find(p => p.type === type)!.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
export function previousDay(day = localDay()): string {
  return new Date(new Date(`${day}T12:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10);
}
