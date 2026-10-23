import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import type { AddressInfo } from 'node:net';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { startTestMailbox } from './testing/mailbox.js';

async function worker() {
  const certificate = path.join(process.env.DATA_DIR!, 'localhost.pem');
  const key = path.join(process.env.DATA_DIR!, 'localhost-key.pem');
  const generated = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', certificate, '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { encoding: 'utf8' });
  assert.equal(generated.status, 0, 'OpenSSL é necessário para simular o HTTPS do GitHub Pages.');
  const ssl = { key: fs.readFileSync(key), cert: fs.readFileSync(certificate) };
  const output = fileURLToPath(new URL('../../mobile/dist-pages/', import.meta.url));
  assert.ok(fs.existsSync(path.join(output, '.nojekyll')), 'Execute npm run build:pages antes do teste.');
  const staticApp = express();
  staticApp.use('/app-da-igreja', express.static(output));
  staticApp.use((_req, res) => res.status(404).sendFile(path.join(output, '404.html')));
  const frontend = https.createServer(ssl, staticApp).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => frontend.once('listening', resolve));
  const appOrigin = `https://127.0.0.1:${(frontend.address() as AddressInfo).port}`;
  process.env.CORS_ORIGINS = appOrigin;
  const mailbox = await startTestMailbox();
  process.env.SMTP_URL = mailbox.url;
  process.env.MAIL_FROM = 'Teste Pages <noreply@comunhao.example>';
  const { db, initDatabase } = await import('./config/database.js');
  const { createApp } = await import('./app.js');
  const { platformFixture, testPhoto } = await import('./testing/platformFixture.js');
  initDatabase();
  const backend = https.createServer(ssl, createApp()).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => backend.once('listening', resolve));
  try {
    const { runPagesChecks } = await import(new URL('../../scripts/browser/pages.mjs', import.meta.url).href);
    await runPagesChecks({ appBase: appOrigin + '/app-da-igreja', apiBase: `https://127.0.0.1:${(backend.address() as AddressInfo).port}`, fixture: (label: string) => platformFixture(db, label), photo: testPhoto, mailbox });
  } finally {
    for (const server of [frontend, backend]) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
    await mailbox.close();
    db.close();
  }
}
if (process.env.COMUNHAO_PAGES_WORKER === 'true') await worker();
else {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'comunhao-pages-'));
  try {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../node_modules/tsx/dist/cli.mjs', import.meta.url)), fileURLToPath(import.meta.url)], {
      env: { ...process.env, DATA_DIR: dataDir, NODE_ENV: 'test', DEMO_MODE: 'false', JWT_SECRET: 'somente-testes-isolados-github-pages-2026', SMTP_URL: '', MAIL_FROM: '', CONSENT_WEBHOOK_URL: '', CONSENT_WEBHOOK_TOKEN: '', COMUNHAO_PAGES_WORKER: 'true' },
      timeout: 300000, stdio: 'inherit',
    });
    assert.ifError(result.error); assert.equal(result.status, 0, 'Falha ao simular GitHub Pages.');
  } finally { fs.rmSync(dataDir, { recursive: true, force: true }); }
}
