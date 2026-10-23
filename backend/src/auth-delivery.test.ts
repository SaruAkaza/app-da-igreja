import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import bcrypt from 'bcryptjs';
import { startTestMailbox } from './testing/mailbox.js';

async function runWorker() {
  const mailbox = await startTestMailbox();
  const consents: { phone: string; childName: string; code: string }[] = [];
  const webhook = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => { consents.push(JSON.parse(body)); res.writeHead(200).end('OK'); });
  }).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => webhook.once('listening', resolve));
  process.env.SMTP_URL = mailbox.url;
  process.env.MAIL_FROM = 'Comunhão Teste <noreply@comunhao.example>';
  process.env.CONSENT_WEBHOOK_URL = `http://127.0.0.1:${(webhook.address() as AddressInfo).port}`;
  const { db, initDatabase } = await import('./config/database.js');
  const { createApp } = await import('./app.js');
  initDatabase();
  async function withApp(run: (base: string) => Promise<void>) {
    const server = createApp().listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    try { await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`); }
    finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  }
  try {
    await withApp(async base => {
      let checks = 0;
      const check = (label: string, assertion: () => void) => { assertion(); checks++; console.log('✓ ' + label); };
      async function request(route: string, body?: object, token = '') {
        const response = await fetch(base + '/api/auth' + route, {
          method: body ? 'POST' : 'GET',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
          ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(14000),
        });
        return { status: response.status, data: await response.json() as any };
      }
      const email = 'entrega@comunhao.example', password = "SenhaValida1'";
      const payload = { name: 'Entrega SMTP', email, age: 30, password };
      let result = await request('/request-code', { email: ' ENTREGA@comunhao.example ' });
      check('SMTP recebe código para e-mail normalizado, fora da demonstração', () => { assert.equal(result.status, 200); assert.equal(mailbox.messages.length, 1); assert.equal(result.data.dev_code, undefined); });
      const firstCode = mailbox.codeFor(email);
      check('Mensagem SMTP contém código de seis dígitos e validade', () => { assert.match(firstCode, /^\d{6}$/); assert.ok(Date.parse(result.data.expires_at) > Date.now()); });
      result = await request('/verify-code', { email, code: '000000' });
      check('Código incorreto não confirma e-mail', () => assert.equal(result.status, 400));
      const record = db.prepare('SELECT expires_at FROM email_verifications WHERE email = ?').get(email) as any;
      db.prepare('UPDATE email_verifications SET expires_at = ? WHERE email = ?').run('2000-01-01T00:00:00.000Z', email);
      result = await request('/verify-code', { email, code: firstCode });
      check('Código entregue mas expirado é recusado', () => assert.equal(result.status, 400));
      db.prepare('UPDATE email_verifications SET expires_at = ? WHERE email = ?').run(record.expires_at, email);
      const firstVerification = await request('/verify-code', { email, code: firstCode });
      result = await request('/register', payload);
      check('Entrega SMTP não permite cadastro sem prova de confirmação', () => assert.equal(result.status, 400));
      await request('/request-code', { email });
      const secondCode = mailbox.codeFor(email);
      check('Reenvio entrega um código diferente do anterior', () => assert.notEqual(secondCode, firstCode));
      result = await request('/verify-code', { email, code: firstCode });
      check('Código antigo não funciona após reenvio', () => assert.equal(result.status, 400));
      result = await request('/register', { ...payload, emailVerificationToken: firstVerification.data.verificationToken });
      check('Prova anterior também é invalidada pelo reenvio', () => assert.equal(result.status, 400));
      const verified = await request('/verify-code', { email: ' ENTREGA@comunhao.example ', code: secondCode });
      result = await request('/register', { ...payload, emailVerificationToken: verified.data.verificationToken });
      check('Cadastro com código entregue por SMTP cria conta verificada', () => assert.equal(result.status, 201));
      const token = result.data.token;
      result = await request('/me', undefined, token);
      check('Conta criada com SMTP tem e-mail verificado', () => assert.equal(result.data.email_verified, 1));
      result = await request('/verify-code', { email, code: secondCode });
      check('Código consumido não pode ser confirmado novamente', () => assert.equal(result.status, 400));
      const mailCount = mailbox.messages.length;
      result = await request('/request-code', { email });
      check('E-mail já cadastrado é informado antes de enviar outro código', () => { assert.equal(result.status, 409); assert.equal(mailbox.messages.length, mailCount); });
      result = await request('/login', { email, password: 'SenhaErrada1!' });
      check('Login não aceita senha incorreta após cadastro SMTP', () => assert.equal(result.status, 401));
      result = await request('/login', { email: ' ENTREGA@comunhao.example ', password });
      check('Login aceita a senha com apóstrofo e e-mail normalizado', () => assert.equal(result.status, 200));
      result = await request('/forgot-password', { email: ' ENTREGA@comunhao.example ' });
      check('Recuperação envia por SMTP sem devolver o código na API', () => { assert.equal(result.status, 200); assert.equal(result.data.dev_code, undefined); });
      const newPassword = 'NovaSenha1!';
      result = await request('/reset-password', { email, code: mailbox.codeFor(email), newPassword, confirmPassword: newPassword });
      check('Código recuperado da caixa SMTP redefine a senha', () => assert.equal(result.status, 200));
      result = await request('/me', undefined, token);
      check('Redefinição com SMTP revoga a sessão anterior', () => assert.equal(result.status, 401));

      // Segura um login após a comparação da senha e redefine a senha antes
      // de emitir a sessão: credenciais revogadas não podem ganhar um JWT novo.
      const compare = bcrypt.compare;
      let release!: () => void, entered!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      const comparing = new Promise<void>(resolve => { entered = resolve; });
      (bcrypt as any).compare = async (plain: string, hash: string) => {
        const match = await compare(plain, hash);
        entered(); await gate; return match;
      };
      let loginPending: Promise<{ status: number; data: any }> | undefined;
      try {
        loginPending = request('/login', { email, password: newPassword });
        await comparing;
        await request('/forgot-password', { email });
        result = await request('/reset-password', { email, code: mailbox.codeFor(email), newPassword: 'OutraSenha1!', confirmPassword: 'OutraSenha1!' });
        assert.equal(result.status, 200);
        release();
        const loginResult = await loginPending;
        check('Login em andamento não emite sessão com senha revogada', () => assert.equal(loginResult.status, 401));
      } finally { (bcrypt as any).compare = compare; release(); if (loginPending) await loginPending; }

      mailbox.setMode('reject');
      result = await request('/request-code', { email: 'rejeitado@comunhao.example' });
      check('Falha SMTP retorna erro sem criar confirmação pendente', () => { assert.equal(result.status, 503); assert.equal(result.data.dev_code, undefined); assert.equal(db.prepare('SELECT email FROM email_verifications WHERE email = ?').get('rejeitado@comunhao.example'), undefined); });
      mailbox.setMode('silent');
      result = await request('/request-code', { email: 'timeout@comunhao.example' });
      check('SMTP sem resposta encerra a requisição com indisponibilidade', () => assert.equal(result.status, 503));
      mailbox.setMode('accept');
      const childEmail = 'menor.entrega@comunhao.example', parentPhone = '11911112222';
      await request('/request-code', { email: childEmail });
      const childProof = await request('/verify-code', { email: childEmail, code: mailbox.codeFor(childEmail) });
      result = await request('/parental-consent/send', { parentPhone, childName: 'Menor SMTP' });
      check('Autorização é entregue ao webhook sem expor código ao cliente', () => { assert.equal(result.status, 200); assert.equal(result.data.dev_code, undefined); assert.equal(consents.at(-1)?.phone, parentPhone); });
      const consent = await request('/parental-consent/verify', { parentPhone, code: consents.at(-1)!.code });
      result = await request('/register', { name: 'Menor SMTP', age: 16, email: childEmail, password, parentPhone, emailVerificationToken: childProof.data.verificationToken, parentConsentToken: consent.data.consentToken });
      check('Menor conclui cadastro com SMTP e autorização pelo webhook', () => assert.equal(result.status, 201));
      console.log(`${checks} verificações de entrega e confirmação passaram fora da demonstração.`);
    });
    if (process.env.COMUNHAO_AUTH_BROWSER === 'true') {
      const browserChecks = await import(new URL('../../scripts/browser/auth.mjs', import.meta.url).href);
      await browserChecks.runAuthBrowserChecks({ withApp, mailbox, consents,
        expireEmail(email: string) { db.prepare('UPDATE email_verifications SET expires_at = ? WHERE email = ?').run('2000-01-01T00:00:00.000Z', email); },
      });
    }
  } finally {
    db.close();
    await mailbox.close();
    await new Promise<void>((resolve, reject) => webhook.close(error => error ? reject(error) : resolve()));
  }
}

export function runAuthDeliveryTests(browser = false) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'comunhao-delivery-'));
  const cli = fileURLToPath(new URL('../node_modules/tsx/dist/cli.mjs', import.meta.url));
  try {
    const result = spawnSync(process.execPath, [cli, fileURLToPath(import.meta.url)], {
      env: { ...process.env, DATA_DIR: dataDir, NODE_ENV: 'test', DEMO_MODE: 'false',
        SMTP_URL: '', MAIL_FROM: '', CONSENT_WEBHOOK_URL: '', CONSENT_WEBHOOK_TOKEN: '',
        JWT_SECRET: 'somente-testes-isolados-entrega-comunhao-2026', COMUNHAO_AUTH_DELIVERY_WORKER: 'true', COMUNHAO_AUTH_BROWSER: String(browser) },
      timeout: browser ? 180000 : 45000, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
    });
    if (result.stdout) process.stdout.write(result.stdout);
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr || 'Falha nos testes de confirmação por SMTP.');
  } finally {
    if (path.dirname(dataDir) === path.resolve(os.tmpdir()) && path.basename(dataDir).startsWith('comunhao-delivery-')) fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

if (process.env.COMUNHAO_AUTH_DELIVERY_WORKER === 'true') await runWorker();
else if (process.argv.includes('--browser')) runAuthDeliveryTests(true);
else if (process.argv.includes('--run')) runAuthDeliveryTests();
