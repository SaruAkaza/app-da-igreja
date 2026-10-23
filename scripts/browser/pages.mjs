import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Interface estática e API têm origens HTTPS diferentes, como no GitHub Pages.
export async function runPagesChecks({ appBase, apiBase, fixture, photo, mailbox }) {
  const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const artifacts = process.env.COMUNHAO_TEST_ARTIFACTS || fs.mkdtempSync(path.join(os.tmpdir(), 'comunhao-pages-browser-'));
  fs.mkdirSync(artifacts, { recursive: true });
  const profiles = [
    { name: 'desktop', engine: 'chromium', options: { viewport: { width: 1440, height: 1000 } } },
    { name: 'iphone', engine: 'webkit', options: { ...playwright.devices['iPhone 13'] } },
    { name: 'android', engine: 'chromium', options: { ...playwright.devices['Pixel 7'] } },
  ].filter(p => !process.env.COMUNHAO_TEST_PROFILES || process.env.COMUNHAO_TEST_PROFILES.split(',').includes(p.name));
  assert.ok(profiles.length);
  const report = [];
  for (const profile of profiles) {
    const browser = await playwright[profile.engine].launch({ headless: true, ...(profile.engine === 'chromium' ? { args: ['--no-sandbox'], executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}) });
    const context = await browser.newContext({ ...profile.options, ignoreHTTPSErrors: true });
    const page = await context.newPage(); page.setDefaultTimeout(20000);
    const errors = [], assets = [], checks = [], f = fixture(profile.name);
    page.on('pageerror', error => errors.push({ message: error.message, stack: error.stack, page: page.url() }));
    if (process.env.COMUNHAO_PAGES_DEBUG === 'true') page.on('requestfailed', request => console.log('requestfailed', request.url(), request.failure()));
    page.on('dialog', dialog => dialog.accept());
    page.on('response', response => { if (response.url().includes('/_expo/') || response.url().includes('/assets/')) assets.push(response); });
    const note = label => { checks.push(label); console.log('✓ ' + profile.name + ': ' + label); };
    const home = () => page.getByRole('button', { name: 'Abrir menu e configurações' }).waitFor();
    async function post(button, route, status = 200) {
      const [response] = await Promise.all([page.waitForResponse(r => r.url() === apiBase + '/api' + route && r.request().method() === 'POST'), button.click()]);
      const body = await response.json(); assert.equal(response.status(), status, JSON.stringify(body)); return body;
    }
    async function logout() {
      await page.getByRole('button', { name: 'Alternar conta', exact: true }).click();
      await page.getByRole('button', { name: '🚪 Encerrar Sessão (Logout)', exact: true }).click();
      await page.getByLabel('E-mail ou nome de usuário', { exact: true }).waitFor();
    }
    try {
      assert.equal((await page.goto(appBase + '/')).status(), 200);
      await page.getByRole('button', { name: 'Conectar servidor', exact: true }).click();
      await page.getByLabel('Endereço do servidor').fill('http://127.0.0.1:3000');
      await page.getByRole('button', { name: 'Verificar e salvar conexão' }).click();
      await page.getByRole('alert').filter({ hasText: 'HTTPS' }).waitFor();
      assert.equal(await page.evaluate(() => localStorage.getItem('church_custom_api_url')), null);
      await page.getByLabel('Endereço do servidor').fill(apiBase);
      await page.getByRole('button', { name: 'Verificar e salvar conexão' }).click();
      await page.getByLabel('Endereço do servidor').waitFor({ state: 'hidden' });
      note('Aplicativo sob /app-da-igreja conecta API externa e recusa HTTP em página HTTPS');

      assert.equal((await page.goto(appBase + '/register/?origem=pages')).status(), 200);
      await page.getByLabel('Nome', { exact: true }).fill('Pessoa Pages ' + profile.name);
      const email = 'pages.' + Date.now() + '.' + profile.name + '@comunhao.example';
      await page.getByLabel('Seu e-mail', { exact: true }).fill(email);
      await page.getByLabel('Idade', { exact: true }).fill('30');
      await page.getByLabel('Crie uma senha', { exact: true }).fill(f.password);
      await page.getByLabel('Confirme a senha', { exact: true }).fill(f.password);
      await page.getByLabel('Código da igreja (opcional)').fill(f.churchCode);
      const requested = await post(page.getByRole('button', { name: 'Receber código de confirmação' }), '/auth/request-code');
      assert.equal(requested.dev_code, undefined);
      await page.getByLabel('Código recebido por e-mail').fill('000000');
      await post(page.getByRole('button', { name: 'Confirmar e criar minha conta' }), '/auth/verify-code', 400);
      await page.getByRole('alert').waitFor();
      assert.equal(await page.evaluate(() => sessionStorage.getItem('church_auth_token')), null);
      await page.getByLabel('Código recebido por e-mail').fill(mailbox.codeFor(email));
      await post(page.getByRole('button', { name: 'Confirmar e criar minha conta' }), '/auth/register', 201);
      await home();
      assert.ok(page.url().startsWith(appBase + '/'));
      note('Cadastro no Pages bloqueia código incorreto e confirma código entregue por SMTP local');
      await logout();
      await page.getByLabel('E-mail ou nome de usuário', { exact: true }).fill(email);
      await page.getByLabel('Senha', { exact: true }).fill(f.password);
      await post(page.getByRole('button', { name: 'Entrar na minha comunidade' }), '/auth/login');
      await home();
      assert.equal((await page.reload()).status(), 200); await home();
      note('Login, sessão e atualização de rota funcionam com interface e API em origens separadas');

      await logout();
      await page.getByLabel('E-mail ou nome de usuário', { exact: true }).fill(f.users.member.email);
      await page.getByLabel('Senha', { exact: true }).fill(f.password);
      await post(page.getByRole('button', { name: 'Entrar na minha comunidade' }), '/auth/login'); await home();
      await page.goto(appBase + '/group/?groupId=' + f.group + '&tab=readings');
      await page.getByRole('tab', { name: 'Leituras', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Registrar leitura neste grupo', exact: true }).click();
      await page.getByPlaceholder('Ex: Tiago 1:19-27 ou Capítulo 3').fill('Salmos 119:105');
      const chooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: '🖼️ Escolher da Galeria de Fotos', exact: true }).click();
      await (await chooser).setFiles({ name: 'leitura.png', mimeType: 'image/png', buffer: photo });
      const posted = await post(page.getByRole('button', { name: '✅ Tudo Certo, Enviar!', exact: true }), '/devotionals', 201);
      await page.getByRole('button', { name: 'Registrar dúvida sobre esta leitura', exact: true }).click();
      await page.getByLabel('Sua dúvida', { exact: true }).fill('Pergunta no Pages ' + profile.name);
      const question = await post(page.getByRole('button', { name: 'Enviar dúvida ao líder', exact: true }), '/questions', 201);
      assert.equal(question.devotional_id, posted.devotional.id);
      await page.getByLabel('Imagem vinculada à dúvida', { exact: true }).waitFor();
      note('Upload multipart e dúvida vinculada funcionam com CORS na API externa');

      await page.goto(appBase + '/home/'); await home(); await logout();
      await page.getByLabel('E-mail ou nome de usuário', { exact: true }).fill(f.users.leader.email);
      await page.getByLabel('Senha', { exact: true }).fill(f.password);
      await post(page.getByRole('button', { name: 'Entrar na minha comunidade' }), '/auth/login'); await home();
      const photos = [];
      page.on('response', r => { if (r.url() === apiBase + '/api/devotionals/' + posted.devotional.id + '/photo') photos.push(r.status()); });
      await page.goto(appBase + '/group/?groupId=' + f.group + '&tab=questions');
      await page.getByLabel('Imagem vinculada à dúvida', { exact: true }).waitFor();
      await page.getByLabel('Resposta para ' + f.users.member.name).fill('Resposta pelo Pages ' + profile.name);
      await post(page.getByRole('button', { name: 'Enviar resposta', exact: true }), '/questions/' + question.id + '/answer');
      assert.ok(photos.includes(200));
      assert.equal(new URL(page.url()).searchParams.get('groupId'), f.group);
      assert.equal((await page.reload()).status(), 200);
      await page.getByText('Resposta pelo Pages ' + profile.name, { exact: true }).waitFor();
      note('Foto protegida, resposta e parâmetros da rota persistem após atualizar o grupo');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      assert.deepEqual(errors, []);
      assert.ok(assets.length > 0);
      assert.deepEqual(assets.filter(r => !r.url().startsWith(appBase + '/') || ![200, 304].includes(r.status())).map(r => ({ url: r.url(), status: r.status() })), []);
      await page.getByText('Resposta pelo Pages ' + profile.name, { exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(artifacts, profile.name + '-pages.png'), fullPage: true });
      note('Scripts, fontes e imagens respeitam o subdiretório; tela sem erro JavaScript ou transbordamento');
      report.push({ profile: profile.name, checks: checks.length, scenarios: checks });
    } catch (error) {
      await page.screenshot({ path: path.join(artifacts, profile.name + '-falha.png'), fullPage: true }).catch(() => {});
      throw error;
    } finally { await browser.close(); }
  }
  fs.writeFileSync(path.join(artifacts, 'resultados.json'), JSON.stringify({ ok: true, pages: report }, null, 2));
  console.log(JSON.stringify({ ok: true, pages: report, artifacts }, null, 2));
}
