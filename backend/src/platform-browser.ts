import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';

async function worker() {
  const { db, initDatabase } = await import('./config/database.js');
  const { createApp } = await import('./app.js');
  const { platformFixture, testPhoto } = await import('./testing/platformFixture.js');
  initDatabase();
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  try {
    const { runJourneyChecks } = await import(new URL('../../scripts/browser/journey.mjs', import.meta.url).href);
    await runJourneyChecks({ base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, fixture: (label: string) => platformFixture(db, label), photo: testPhoto });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    db.close();
  }
}
if (process.env.COMUNHAO_JOURNEY_WORKER === 'true') await worker();
else {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'comunhao-journey-'));
  try {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../node_modules/tsx/dist/cli.mjs', import.meta.url)), fileURLToPath(import.meta.url)], {
      env: { ...process.env, DATA_DIR: dataDir, NODE_ENV: 'test', DEMO_MODE: 'false', JWT_SECRET: 'somente-testes-isolados-jornada-comunhao-2026', SMTP_URL: '', MAIL_FROM: '', CONSENT_WEBHOOK_URL: '', CONSENT_WEBHOOK_TOKEN: '', COMUNHAO_JOURNEY_WORKER: 'true' },
      timeout: 300000, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
    });
    if (result.stdout) process.stdout.write(result.stdout);
    assert.ifError(result.error); assert.equal(result.status, 0, result.stderr || 'Falha na jornada pelo navegador.');
  } finally {
    if (path.dirname(dataDir) === path.resolve(os.tmpdir()) && path.basename(dataDir).startsWith('comunhao-journey-')) fs.rmSync(dataDir, { recursive: true, force: true });
  }
}
