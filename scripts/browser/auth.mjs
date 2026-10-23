import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// API, SMTP e webhook pertencem ao worker isolado. Não usa serviços externos.
export async function runAuthBrowserChecks({ withApp, mailbox, consents, expireEmail }) {
  let playwright;
  try { playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright'); }
  catch { throw new Error('Instale Playwright: npm install --no-save --package-lock=false playwright; npx playwright install chromium webkit.'); }
  const artifacts = process.env.COMUNHAO_TEST_ARTIFACTS || fs.mkdtempSync(path.join(os.tmpdir(), 'comunhao-auth-browser-'));
  fs.mkdirSync(artifacts, { recursive: true });
  const profiles = [
    { name: 'desktop', type: 'chromium', options: { viewport: { width: 1440, height: 1000 } } },
    { name: 'iphone', type: 'webkit', options: { ...playwright.devices['iPhone 13'] } },
    { name: 'android', type: 'chromium', options: { ...playwright.devices['Pixel 7'] } },
  ];
  const selected = process.env.COMUNHAO_TEST_PROFILES?.split(',');
  const enabledProfiles = selected ? profiles.filter(profile => selected.includes(profile.name)) : profiles;
  assert(enabledProfiles.length > 0, 'Nenhum perfil de navegador selecionado.');
  const report = [];
  for (const profile of enabledProfiles) {
    const browser = await playwright[profile.type].launch({ headless: true,
      ...(profile.type === 'chromium' ? { args: ['--no-sandbox'], ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}) } : {}),
    });
    const context = await browser.newContext(profile.options);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [], dialogs = [], checks = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
    const note = label => { checks.push(label); console.log('✓ ' + profile.name + ': ' + label); };
    const home = () => page.getByRole('button', { name: 'Abrir menu e configurações' }).waitFor();
    async function logout() {
      await home();
      await page.getByRole('button', { name: 'Alternar conta', exact: true }).click();
      await page.getByRole('button', { name: '🚪 Encerrar Sessão (Logout)', exact: true }).click();
      await page.getByRole('button', { name: 'Entrar na minha comunidade' }).waitFor();
    }
    async function post(button, route, expected = 200) {
      const [response] = await Promise.all([page.waitForResponse(r => r.url().endsWith('/api/auth/' + route) && r.request().method() === 'POST'), button.click()]);
      const body = await response.json();
      assert.equal(response.status(), expected, body.error || route);
      return body;
    }
    try {
      await withApp(async base => {
        const stamp = Date.now().toString(36) + profile.name;
        const email = 'browser.' + stamp + '@comunhao.example';
        const password = "SenhaValida1'", newPassword = "SenhaRenovada1'";
        const send = page.getByRole('button', { name: 'Receber código de confirmação', exact: true });
        await page.goto(base + '/register');
        await page.getByLabel('Nome', { exact: true }).fill('Pessoa ' + profile.name);
        await page.getByLabel('Seu e-mail', { exact: true }).fill(' ' + email.toUpperCase() + ' ');
        await page.getByLabel('Idade', { exact: true }).fill('30');
        let sends = 0;
        page.on('request', request => { if (request.url().endsWith('/api/auth/request-code')) sends++; });
        for (const invalid of ['SenhaValida1~', 'Aa1!' + '😀'.repeat(18)]) {
          await page.getByLabel('Crie uma senha', { exact: true }).fill(invalid);
          await page.getByLabel('Confirme a senha', { exact: true }).fill(invalid);
          await send.click();
          await page.getByRole('alert').waitFor();
          assert.equal(sends, 0);
        }
        note('Senha inválida ou acima de 72 bytes é recusada antes do envio');
        await page.getByLabel('Crie uma senha', { exact: true }).fill(password);
        await page.getByLabel('Confirme a senha', { exact: true }).fill(password);
        mailbox.setMode('reject');
        await post(send, 'request-code', 503);
        await page.getByRole('alert').waitFor();
        assert.equal(await page.getByLabel('Crie uma senha', { exact: true }).inputValue(), password);
        note('Falha do SMTP mantém formulário e permite nova tentativa');
        mailbox.setMode('accept');
        const requested = await post(send, 'request-code');
        assert.equal(requested.dev_code, undefined);
        const firstCode = mailbox.codeFor(email);
        const codeInput = page.getByLabel('Código recebido por e-mail');
        await codeInput.fill('000000');
        const finish = page.getByRole('button', { name: 'Confirmar e criar minha conta' });
        await post(finish, 'verify-code', 400);
        await page.getByRole('alert').waitFor();
        assert.equal(await page.evaluate(() => sessionStorage.getItem('church_auth_token')), null);
        note('Código errado mantém cadastro bloqueado');
        expireEmail(email);
        await codeInput.fill(firstCode);
        await post(finish, 'verify-code', 400);
        await page.getByRole('alert').filter({ hasText: 'expirado' }).waitFor();
        note('Código expirado mostra erro sem criar conta');
        await post(page.getByRole('button', { name: 'Reenviar códigos' }), 'request-code');
        const validCode = mailbox.codeFor(email);
        assert.notEqual(validCode, firstCode);
        await codeInput.fill(validCode);
        await page.screenshot({ path: path.join(artifacts, profile.name + '-confirmacao.png'), fullPage: true });
        await post(finish, 'register', 201);
        await home();
        note('Cadastro confirma código recebido por SMTP e inicia sessão');
        await logout();
        await page.getByLabel('E-mail ou nome de usuário', { exact: true }).fill(' ' + email.toUpperCase() + ' ');
        await page.getByLabel('Senha', { exact: true }).fill('SenhaIncorreta1!');
        const enter = page.getByRole('button', { name: 'Entrar na minha comunidade' });
        await post(enter, 'login', 401);
        await page.getByRole('alert').waitFor();
        await page.getByLabel('Senha', { exact: true }).fill(password);
        await post(enter, 'login'); await home();
        note('Login rejeita senha errada e aceita as credenciais cadastradas');
        await logout();
        await page.getByText('Esqueceu a senha?', { exact: true }).click();
        await page.getByPlaceholder('exemplo@igreja.com', { exact: true }).fill(' ' + email.toUpperCase() + ' ');
        const resetRequest = await post(page.getByRole('button', { name: 'Enviar Código de 6 Dígitos' }), 'forgot-password');
        assert.equal(resetRequest.dev_code, undefined);
        await page.getByPlaceholder('000000', { exact: true }).fill(mailbox.codeFor(email));
        await page.getByPlaceholder('Mínimo 8 letras, números e símbolos', { exact: true }).fill(newPassword);
        await page.getByPlaceholder('Repita a nova senha', { exact: true }).fill(newPassword);
        await post(page.getByRole('button', { name: 'Redefinir Senha', exact: true }), 'reset-password');
        await page.getByText('Recuperar Minha Senha', { exact: true }).waitFor({ state: 'hidden' });
        await page.getByLabel('E-mail ou nome de usuário', { exact: true }).fill(email);
        await page.getByLabel('Senha', { exact: true }).fill(password);
        await post(enter, 'login', 401);
        await page.getByLabel('Senha', { exact: true }).fill(newPassword);
        await post(enter, 'login'); await home();
        note('Recuperação por SMTP troca a senha e invalida a senha anterior');
        await page.screenshot({ path: path.join(artifacts, profile.name + '-login.png'), fullPage: true });
        await logout();
        await page.goto(base + '/register');
        const childEmail = 'menor.' + stamp + '@comunhao.example';
        const phone = '11912345678';
        await page.getByLabel('Nome', { exact: true }).fill('Menor ' + profile.name);
        await page.getByLabel('Seu e-mail', { exact: true }).fill(childEmail);
        await page.getByLabel('Idade', { exact: true }).fill('16');
        await page.getByLabel('Telefone do responsável com DDD').fill(phone);
        await page.getByLabel('Crie uma senha', { exact: true }).fill(password);
        await page.getByLabel('Confirme a senha', { exact: true }).fill(password);
        await post(send, 'parental-consent/send');
        await page.getByLabel('Código recebido por e-mail').fill(mailbox.codeFor(childEmail));
        await page.getByLabel('Código informado pelo responsável').fill(consents.at(-1).code);
        await post(finish, 'register', 201); await home();
        note('Menor confirma e-mail e autorização recebida pelo responsável');
        await logout();
        await page.getByText('Levar o Comunhão para minha igreja', { exact: true }).click();
        const pastorEmail = 'pastor.' + stamp + '@comunhao.example';
        await page.getByPlaceholder('Ex: Igreja Videira Central').fill('Igreja ' + profile.name);
        await page.getByPlaceholder('Ex: Pastor Davi Almeida').fill('Pastor ' + profile.name);
        await page.getByPlaceholder('pastor@suaigreja.com').fill(pastorEmail);
        await page.getByPlaceholder('Mínimo 8 letras, números e símbolos (!@#$)').fill(password);
        await page.getByPlaceholder('Repita sua senha').fill(password);
        await post(send, 'request-code');
        await page.getByLabel('Código recebido por e-mail').fill(mailbox.codeFor(pastorEmail));
        const church = await post(page.getByRole('button', { name: 'Confirmar e cadastrar igreja' }), 'register-church', 201);
        await page.getByText(church.church.slug_code, { exact: true }).waitFor();
        assert.equal(await page.evaluate(() => sessionStorage.getItem('church_auth_token')), null);
        await page.getByRole('button', { name: '🚪 Entrar no Aplicativo', exact: true }).click(); await home();
        note('Cadastro pastoral exige confirmação antes de liberar a igreja');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
        assert.deepEqual(errors, []);
        note('Interface sem rolagem horizontal e sem erros JavaScript não tratados');
      });
      report.push({ profile: profile.name, engine: profile.type, checks: checks.length, scenarios: checks });
    } catch (error) {
      await page.screenshot({ path: path.join(artifacts, profile.name + '-falha.png'), fullPage: true }).catch(() => {});
      throw error;
    } finally { mailbox.setMode('accept'); await browser.close(); }
  }
  console.log(JSON.stringify({ ok: true, authBrowser: report, artifacts }, null, 2));
}
