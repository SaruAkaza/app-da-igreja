import http from 'http';
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

async function startAndTest() {
  // Verificar se o servidor já está rodando
  let alreadyRunning = false;
  try {
    const res = await fetch('http://127.0.0.1:3000/api/health');
    if (res.status === 200) {
      alreadyRunning = true;
    }
  } catch (e) {
    alreadyRunning = false;
  }

  let server: any = null;

  if (!alreadyRunning) {
    const app = express();
    initDatabase();
    await runSeed();

    app.use(cors());
    app.use(express.json({ limit: '20mb' }));
    app.use(express.urlencoded({ extended: true, limit: '20mb' }));

    const uploadsPath = path.resolve(__dirname, '../uploads');
    if (!fs.existsSync(uploadsPath)) {
      fs.mkdirSync(uploadsPath, { recursive: true });
    }
    app.use('/uploads', express.static(uploadsPath));

    app.use('/api/auth', authRoutes);
    app.use('/api/groups', groupRoutes);
    app.use('/api/devotionals', devotionalRoutes);
    app.use('/api/gamification', gamificationRoutes);
    app.use('/api/admin', adminRoutes);

    app.get('/api/health', (_req, res) => {
      res.json({
        status: 'online',
        appName: 'App Devocional da Igreja - API',
        time: new Date().toISOString(),
      });
    });

    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(3000, '127.0.0.1', resolve));
    console.log('🚀 Servidor de Teste iniciado na porta 3000');
  } else {
    console.log('⚡ Conectando ao Servidor Dev já em execução na porta 3000...');
  }

  try {
    const { runTests } = await import('./test.js');
    await runTests();
  } finally {
    if (server) {
      server.close();
      console.log('🛑 Servidor de Teste finalizado.');
    }
  }
}

startAndTest().catch((err) => {
  console.error('Falha geral no teste:', err);
  process.exit(1);
});
