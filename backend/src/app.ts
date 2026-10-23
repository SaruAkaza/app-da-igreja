import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import { backendRoot, demoMode, production } from './config/runtime.js';
import authRoutes from './routes/authRoutes.js';
import groupRoutes from './routes/groupRoutes.js';
import devotionalRoutes from './routes/devotionalRoutes.js';
import gamificationRoutes from './routes/gamificationRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import questionRoutes from './routes/questionRoutes.js';
import { createCepRoutes } from './routes/cepRoutes.js';
import type { CepLookup } from './services/cepService.js';
import { rateLimit } from './middleware/rateLimit.js';
export function createApp(services: { lookupCep?: CepLookup } = {}) {
  const app = express();
  app.disable('x-powered-by');
  const origins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  app.use(cors({ origin: (origin, cb) => cb(null, !origin || origins.includes(origin) || (!production && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) }));
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });
  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  const authLimit = rateLimit(60);
  app.use('/api/auth', (req, res, next) => req.method === 'GET' ? next() : authLimit(req, res, next));
  const textFields = new Set(['name','lastName','usernameHandle','email','password','confirmPassword','newPassword','churchCode','code','parentPhone','parentConsentCode','parentConsentToken','emailVerificationToken','addressStreet','addressNeighborhood','addressCity','addressState','addressZipcode','avatarUrl','pastorName','churchName','slugCode','slug_code','city','state','denomination','cnpj','phone','addressFull','address_full','logo_url','title','description','category','book_or_theme','cover_image','invite_code','inviteCode','groupId','userId','leaderId','leader_id','role','couponCode','pastoralGuidance','reason','reactionType','startDate','endDate','partnerName','partner_name','tier','cycle_start_date','cycle_end_date','cycleStartDate','cycleEndDate','cycle_status','cycleStatus','group_id','reward_type','rewardType']);
  app.use(express.json({ limit: '64kb' }));
  app.use(express.urlencoded({ extended: false, limit: '64kb' }));
  app.use((req, res, next) => {
    for (const [key, value] of Object.entries(req.body || {})) {
      if ((textFields.has(key) && value !== undefined && typeof value !== 'string') || (value !== null && typeof value === 'object')) return res.status(400).json({ error: `Campo inválido: ${key}.` });
      if (typeof value === 'string' && value.length > 10000) return res.status(400).json({ error: 'Texto excede o limite permitido.' });
    }
    next();
  });
  app.get('/api/health', (_req, res) => res.json({ status: 'online', appName: 'Comunhão · Devocionais', demo_mode: demoMode, time: new Date().toISOString() }));
  app.use('/api/auth', authRoutes);
  app.use('/api/groups', groupRoutes);
  app.use('/api/devotionals', devotionalRoutes);
  app.use('/api/gamification', gamificationRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/questions', questionRoutes);
  app.use('/api/cep', createCepRoutes(services.lookupCep));
  app.use('/admin', express.static(path.join(backendRoot, 'public/admin')));
  const mobileDist = path.resolve(backendRoot, '../mobile/dist');
  if (fs.existsSync(mobileDist)) {
    app.use(express.static(mobileDist));
    app.use('/app', express.static(mobileDist));
    app.get(['/app', '/app/*', '/home', '/explore', '/feed', '/rewards', '/groups', '/connections', '/group', '/leader', '/capture', '/feedbacks', '/register'], (_req, res) => {
      res.sendFile(path.join(mobileDist, 'index.html'));
    });
    app.get('/', (_req, res) => res.sendFile(path.join(mobileDist, 'index.html')));
  } else {
    app.get('/', (_req, res) => res.redirect('/admin/'));
  }
  app.use((_req, res) => res.status(404).json({ error: 'Endereço não encontrado.' }));
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err instanceof multer.MulterError || err.type === 'entity.parse.failed' ? 400 : err.status || 500;
    if (status >= 500) console.error('Falha na requisição:', err.message);
    res.status(status).json({ error: err instanceof multer.MulterError ? 'Arquivo inválido. Envie uma foto com até 10 MB.' : status < 500 ? err.message : 'Não foi possível concluir. Tente novamente.' });
  });
  return app;
}
