import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { jwtSecret } from '../config/runtime.js';

type Purpose = 'registration-email' | 'parental-consent';
const digest = (code: string) => crypto.createHmac('sha256', jwtSecret).update(code).digest('hex');

export function issueVerificationProof(purpose: Purpose, subject: string, code: string, expiresAt: string, childName?: string) {
  return jwt.sign({ purpose, subject, codeDigest: digest(code), ...(childName ? { childName: childName.trim().toLowerCase() } : {}) }, jwtSecret, {
    algorithm: 'HS256', expiresIn: Math.max(1, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000)),
  });
}

export function validVerificationProof(token: unknown, purpose: Purpose, subject: string, record: any, childName?: string): boolean {
  if (typeof token !== 'string' || !record || !record.verified || record.expires_at <= new Date().toISOString()) return false;
  try {
    const proof = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
    return proof.purpose === purpose && proof.subject === subject && proof.codeDigest === digest(record.code)
      && (!childName || (proof.childName === childName.trim().toLowerCase() && record.child_name.trim().toLowerCase() === childName.trim().toLowerCase()));
  } catch { return false; }
}
