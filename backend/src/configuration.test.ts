import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workerMode = process.env.COMUNHAO_CONFIGURATION_WORKER;

async function runServicesWorker() {
  const { db, initDatabase } = await import('./config/database.js');
  const { createApp } = await import('./app.js');
  initDatabase();
  const email = 'configuracao@comunhao.example';
  db.prepare('INSERT INTO users (id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?)')
    .run('configuration-user', 'Configuração', email, 'unused-no-login', 'member', new Date().toISOString());
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}/api`;
  let checks = 0;
  async function request(route: string, body?: object) {
    const response = await fetch(base + route, {
      method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json() as any };
  }
  function check(label: string, assertion: () => void) { assertion(); checks++; console.log('✓ ' + label); }
  try {
    let result = await request('/health');
    check('API fora de demonstração informa demo_mode=false', () => {
      assert.equal(result.status, 200); assert.equal(result.data.demo_mode, false);
    });
    result = await request('/auth/request-code', { email });
    check('Sem SMTP, cadastro informa indisponibilidade sem expor código', () => {
      assert.equal(result.status, 503); assert.equal(Object.hasOwn(result.data, 'dev_code'), false);
      assert.match(result.data.error, /configurado/);
    });
    result = await request('/auth/parental-consent/send', { parentPhone: '11999998888', childName: 'Menor Teste' });
    check('Sem provedor parental, autorização informa indisponibilidade sem código', () => {
      assert.equal(result.status, 503); assert.equal(Object.hasOwn(result.data, 'dev_code'), false);
      assert.match(result.data.error, /configurado/);
    });
    result = await request('/auth/forgot-password', { email });
    check('Recuperação sem SMTP retorna 503 e não divulga código', () => {
      assert.equal(result.status, 503); assert.equal(Object.hasOwn(result.data, 'dev_code'), false);
    });
    result = await request('/auth/forgot-password', { email: 'nao-cadastrado@comunhao.example' });
    check('Recuperação de e-mail inexistente mantém resposta genérica sem código', () => {
      assert.equal(result.status, 200); assert.match(result.data.message, /Se este e-mail estiver cadastrado/);
      assert.equal(Object.hasOwn(result.data, 'dev_code'), false);
    });
    check('Falhas de entrega não gravam códigos pendentes', () => {
      assert.equal(db.prepare('SELECT email FROM email_verifications').get(), undefined);
      assert.equal(db.prepare('SELECT parent_phone FROM parental_consents').get(), undefined);
      assert.equal((db.prepare('SELECT verification_code FROM users WHERE email = ?').get(email) as any).verification_code, null);
    });
    console.log(`${checks} verificações de configuração dos serviços passaram.`);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    db.close();
  }
}

export function runConfigurationTests() {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'comunhao-configuration-'));
  const cli = fileURLToPath(new URL('../node_modules/tsx/dist/cli.mjs', import.meta.url));
  const worker = fileURLToPath(import.meta.url);
  // Valores vazios impedem que dotenv restaure configurações de entrega locais.
  // Nenhum serviço de mensagens é contatado e nenhum segredo é lido ou impresso.
  const env = {
    ...process.env, DATA_DIR: testDir, DEMO_MODE: 'false', NODE_ENV: 'test',
    JWT_SECRET: 'chave-exclusiva-dos-testes-de-configuracao-2026',
    SMTP_URL: '', MAIL_FROM: '', CONSENT_WEBHOOK_URL: '', CONSENT_WEBHOOK_TOKEN: '',
  };
  function run(mode: string, overrides: NodeJS.ProcessEnv = {}) {
    return spawnSync(process.execPath, [cli, worker], {
      env: { ...env, ...overrides, COMUNHAO_CONFIGURATION_WORKER: mode }, encoding: 'utf8', timeout: 20000,
    });
  }
  try {
    const services = run('services');
    assert.ifError(services.error);
    assert.equal(services.status, 0, services.stderr || services.stdout);
    process.stdout.write(services.stdout);
    for (const guard of [
      { label: 'Produção recusa demonstração', env: { NODE_ENV: 'production', DEMO_MODE: 'true' }, expected: /DEMO_MODE não pode ser habilitado em produção/ },
      { label: 'Produção recusa chave JWT fraca', env: { NODE_ENV: 'production', JWT_SECRET: 'fraca' }, expected: /JWT_SECRET com pelo menos 32 caracteres/ },
      { label: 'Produção recusa ausência de chave JWT', env: { NODE_ENV: 'production', JWT_SECRET: '' }, expected: /JWT_SECRET com pelo menos 32 caracteres/ },
    ]) {
      const rejected = run('runtime', guard.env);
      assert.ifError(rejected.error);
      assert.notEqual(rejected.status, 0);
      assert.match(rejected.stderr, guard.expected);
      console.log('✓ ' + guard.label);
    }
    console.log('9 verificações de configuração passaram em processos isolados.');
  } finally {
    if (path.dirname(testDir) === path.resolve(os.tmpdir()) && path.basename(testDir).startsWith('comunhao-configuration-')) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  }
}

if (workerMode === 'services') await runServicesWorker();
if (workerMode === 'runtime') await import('./config/runtime.js');
