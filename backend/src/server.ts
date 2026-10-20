import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDatabase } from './config/database.js';
import { runSeed } from './config/seed.js';

import authRoutes from './routes/authRoutes.js';
import groupRoutes from './routes/groupRoutes.js';
import devotionalRoutes from './routes/devotionalRoutes.js';
import gamificationRoutes from './routes/gamificationRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Inicializa banco de dados e sementes padrão
initDatabase();
await runSeed();

// Middlewares essenciais
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Arquivos estáticos de upload (fotos das folhas)
const uploadsPath = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// Painel Administrativo Web
const adminPublicPath = path.resolve(__dirname, '../public/admin');
if (!fs.existsSync(adminPublicPath)) {
  fs.mkdirSync(adminPublicPath, { recursive: true });
}
app.use('/admin', express.static(adminPublicPath));

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/devotionals', devotionalRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/admin', adminRoutes);

// Healthcheck
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'online',
    appName: 'App Devocional da Igreja - API',
    time: new Date().toISOString(),
  });
});

// Redirecionamento da raiz para o painel admin
app.get('/', (_req, res) => {
  res.redirect('/admin');
});

// Tratamento de erro 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint não encontrado.' });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`✝️  App Devocional da Igreja - Servidor Ativo!`);
  console.log(`🚀 API:        http://localhost:${PORT}/api/health`);
  console.log(`🖥️  Admin Web:  http://localhost:${PORT}/admin`);
  console.log(`====================================================`);
});
