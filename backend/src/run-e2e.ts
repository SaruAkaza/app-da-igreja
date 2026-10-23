import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
// Configuração antes de importar o banco. Nunca conecta ao servidor ou SQLite em uso.
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'comunhao-test-'));
process.env.DATA_DIR = testDir;
process.env.DEMO_MODE = 'true';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'somente-testes-isolados-comunhao-2026';
const { db, initDatabase } = await import('./config/database.js');
const { runSeed } = await import('./config/seed.js');
const { createApp } = await import('./app.js');
const { runCepTests, cepFixture } = await import('./services/cep.test.js');
const { runConfigurationTests } = await import('./configuration.test.js');
const { runAuthDeliveryTests } = await import('./auth-delivery.test.js');
try {
  runConfigurationTests();
  runAuthDeliveryTests();
  initDatabase();
  await runSeed();
  await runCepTests();
  const { runTests } = await import('./test.js');
  const { runAuthRegression } = await import('./auth-regression.js');
  const { runPlatformRegression } = await import('./platform-regression.js');
  // Cada suíte usa sua própria instância e o limite real de tentativas de autenticação.
  for (const suite of [runTests, runAuthRegression, runPlatformRegression]) {
    const server = createApp({ lookupCep: cepFixture }).listen(0, '127.0.0.1');
    try {
      await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
      const address = server.address() as { port: number };
      await suite(`http://127.0.0.1:${address.port}`, db);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  }
} finally {
  db.close();
  // Caminho temporário criado por este processo e validado antes da remoção recursiva.
  if (path.dirname(testDir) === path.resolve(os.tmpdir()) && path.basename(testDir).startsWith('comunhao-test-')) fs.rmSync(testDir, { recursive: true, force: true });
}
