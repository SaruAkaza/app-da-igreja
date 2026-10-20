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
initDatabase();
await runSeed();
const server = createApp().listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const address = server.address() as { port: number };
try {
  const { runTests } = await import('./test.js');
  await runTests(`http://127.0.0.1:${address.port}`, db);
} finally {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  db.close();
  // Caminho temporário criado por este processo e validado antes da remoção recursiva.
  if (path.dirname(testDir) === path.resolve(os.tmpdir()) && path.basename(testDir).startsWith('comunhao-test-')) fs.rmSync(testDir, { recursive: true, force: true });
}
