import { Request, Response } from 'express';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { db } from '../config/database.js';
import { demoMode } from '../config/runtime.js';
import { issueVerificationProof } from '../services/verificationProof.js';

const emailValid = (value: unknown): value is string => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
const code = () => crypto.randomInt(100000, 1000000).toString();
const expires = () => new Date(Date.now() + 15 * 60 * 1000).toISOString();
async function deliverEmail(email: string, value: string) {
  if (demoMode) return;
  if (!process.env.SMTP_URL || !process.env.MAIL_FROM) throw new Error('O envio de e-mail ainda não foi configurado pelo administrador.');
  await nodemailer.createTransport(process.env.SMTP_URL).sendMail({ from: process.env.MAIL_FROM, to: email, subject: 'Seu código de acesso · Comunhão', text: `Seu código é ${value}. Ele expira em 15 minutos. Se não foi você, ignore esta mensagem.` });
}
const fail = (res: Response, error: unknown) => res.status(503).json({ error: error instanceof Error && error.message.includes('configurado') ? error.message : 'Não foi possível entregar o código. Tente novamente mais tarde.' });

export async function requestCode(req: Request, res: Response) {
  if (!emailValid(req.body.email)) return res.status(400).json({ error: 'Informe um e-mail válido.' });
  const email = req.body.email.trim().toLowerCase(); const value = code(); const until = expires();
  try {
    await deliverEmail(email, value);
    db.prepare('INSERT INTO email_verifications (email,code,expires_at,verified,created_at) VALUES (?,?,?,0,?) ON CONFLICT(email) DO UPDATE SET code=excluded.code, expires_at=excluded.expires_at, verified=0, created_at=excluded.created_at').run(email, value, until, new Date().toISOString());
    return res.json({ message: demoMode ? 'Código de demonstração gerado.' : 'Confira seu e-mail.', expires_at: until, ...(demoMode ? { dev_code: value } : {}) });
  } catch (error) { return fail(res,error); }
}
export function verifyCode(req: Request, res: Response) {
  if (!emailValid(req.body.email) || typeof req.body.code !== 'string') return res.status(400).json({ error: 'Informe e-mail e código.' });
  const email = req.body.email.trim().toLowerCase();
  const record = db.prepare('SELECT * FROM email_verifications WHERE email = ?').get(email) as any;
  if (!record || record.expires_at < new Date().toISOString() || record.code !== req.body.code.trim()) return res.status(400).json({ error: 'Código inválido ou expirado.' });
  db.prepare('UPDATE email_verifications SET verified = 1 WHERE email = ?').run(email);
  return res.json({ valid: true, message: 'E-mail confirmado.', verificationToken: issueVerificationProof('registration-email', email, record.code, record.expires_at) });
}
export async function forgotPassword(req: Request, res: Response) {
  if (!emailValid(req.body.email)) return res.status(400).json({ error: 'Informe um e-mail válido.' });
  const email = req.body.email.trim().toLowerCase();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as any;
  const message = 'Se este e-mail estiver cadastrado, você receberá um código de recuperação.';
  if (!user) return res.json({ message });
  const value = code();
  try {
    await deliverEmail(email, value);
    db.prepare('UPDATE users SET verification_code = ?, verification_code_expires_at = ? WHERE id = ?').run(value, expires(), user.id);
    return res.json({ message, ...(demoMode ? { dev_code: value } : {}) });
  } catch (error) { return fail(res,error); }
}
export async function sendParentalConsent(req: Request, res: Response) {
  const { parentPhone, childName } = req.body;
  if (typeof parentPhone !== 'string' || typeof childName !== 'string' || !childName.trim()) return res.status(400).json({ error: 'Informe nome e telefone do responsável.' });
  const phone = parentPhone.replace(/\D/g, '');
  if (phone.length < 10 || phone.length > 13) return res.status(400).json({ error: 'Telefone inválido. Inclua o DDD.' });
  const value = code(); const until = expires();
  try {
    if (!demoMode) {
      if (!process.env.CONSENT_WEBHOOK_URL) throw new Error('O envio ao responsável ainda não foi configurado pelo administrador.');
      const response = await fetch(process.env.CONSENT_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(process.env.CONSENT_WEBHOOK_TOKEN ? { Authorization: 'Bearer ' + process.env.CONSENT_WEBHOOK_TOKEN } : {}) }, body: JSON.stringify({ phone, childName: childName.trim(), code: value, expires_at: until }), signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Falha na entrega');
    }
    db.prepare('INSERT INTO parental_consents (parent_phone,code,child_name,verified,expires_at,created_at) VALUES (?,?,?,0,?,?) ON CONFLICT(parent_phone) DO UPDATE SET code=excluded.code,child_name=excluded.child_name,verified=0,expires_at=excluded.expires_at').run(phone, value, childName.trim(), until, new Date().toISOString());
    return res.json({ message: demoMode ? 'Código de demonstração gerado.' : 'Código enviado diretamente ao responsável.', ...(demoMode ? { dev_code: value } : {}) });
  } catch (error) { return fail(res,error); }
}
export function verifyParentalConsent(req: Request, res: Response) {
  if (typeof req.body.parentPhone !== 'string' || typeof req.body.code !== 'string') return res.status(400).json({ error: 'Informe telefone e código.' });
  const phone = req.body.parentPhone.replace(/\D/g, '');
  const record = db.prepare('SELECT * FROM parental_consents WHERE parent_phone = ?').get(phone) as any;
  if (!record || record.code !== req.body.code.trim() || record.expires_at < new Date().toISOString()) return res.status(400).json({ error: 'Autorização inválida ou expirada.' });
  db.prepare('UPDATE parental_consents SET verified = 1 WHERE parent_phone = ?').run(phone);
  return res.json({ valid: true, message: 'Autorização confirmada.', consentToken: issueVerificationProof('parental-consent', phone, record.code, record.expires_at, record.child_name) });
}
