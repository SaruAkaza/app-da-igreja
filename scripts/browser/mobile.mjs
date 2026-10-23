import assert from 'node:assert/strict';
import path from 'node:path';

export async function runMobileChecks(browser, base, artifacts) {
  const report = [];
  const failures = [];
  const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  let currentPage;
  async function newPage() {
    const context = await browser.newContext({ viewport: { width: 430, height: 932 } });
    const page = await context.newPage();
    currentPage = page;
    page.setDefaultTimeout(15000);
    page.on('dialog', async dialog => { await dialog.accept(); });
    page.on('pageerror', error => failures.push(error.message));
    return { page, context };
  }
  async function home(page) { await page.getByRole('button', { name: 'Abrir menu e configurações' }).waitFor(); }
  async function token(page) { return page.evaluate(() => sessionStorage.getItem('church_auth_token')); }
  async function clickResponse(page, locator, pathname) {
    const [response] = await Promise.all([page.waitForResponse(r => r.url().endsWith(pathname) && r.request().method() === 'POST'), locator.click()]);
    const body = await response.json();
    assert(response.status() >= 200 && response.status() < 300, String(response.status()) + ': ' + (body.error || body.message || 'falha na requisição'));
    return body;
  }
  try {
    {
      const { page, context } = await newPage();
      await page.goto(base);
      await page.getByText('Administrador de demonstração', { exact: true }).click();
      await home(page);
      const original = await token(page);
      assert.ok(original);
      await page.route('**/api/auth/me', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"indisponibilidade temporária simulada"}' }));
      await page.goto(base);
      await page.getByRole('button', { name: 'Entrar na minha comunidade' }).waitFor();
      assert.equal(await token(page), original, '503 deve preservar token para nova tentativa');
      await page.unroute('**/api/auth/me');
      await page.reload();
      await home(page);
      assert.equal(await token(page), original);
      report.push('Acesso rápido demo autentica; falha 503 preserva sessão; restauração recupera quando API retorna.');
      await page.route('**/api/auth/me', route => route.abort('internetdisconnected'));
      await page.goto(base);
      await page.getByRole('button', { name: 'Entrar na minha comunidade' }).waitFor();
      assert.equal(await token(page), original, 'Desconexão não pode apagar a sessão.');
      await page.unroute('**/api/auth/me');
      await page.reload();
      await home(page);
      assert.equal(await token(page), original);
      await page.screenshot({ path: path.join(artifacts, 'session-recovered.png'), fullPage: true });
      report.push('Desconexão preserva sessão; reconexão restaura sem nova senha.');
      await page.route('**/api/auth/me', route => route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"sessão expirada simulada"}' }));
      await page.goto(base);
      await page.getByRole('button', { name: 'Entrar na minha comunidade' }).waitFor();
      assert.equal(await token(page), null);
      const remaining = await page.evaluate(() => JSON.parse(sessionStorage.getItem('church_saved_accounts') || '[]'));
      assert(!remaining.some(account => account.token === original));
      await page.unroute('**/api/auth/me');
      await page.evaluate(() => sessionStorage.setItem('church_saved_accounts', JSON.stringify([{ id: 'expired-test', name: 'Conta expirada', email: 'expired@example.test', token: 'expired-test-token' }])));
      await page.reload();
      await page.getByRole('button', { name: 'Alternar conta salva' }).click();
      await page.getByText('Conta expirada', { exact: true }).click();
      await page.waitForFunction(() => !JSON.parse(sessionStorage.getItem('church_saved_accounts') || '[]').some(a => a.id === 'expired-test'));
      assert.equal(await token(page), null);
      report.push('401 remove sessão e conta salva inválida; alternar conta expirada mostra erro e remove entrada.');
      await context.close();
    }
    {
      const { page, context } = await newPage();
      await page.goto(base);
      await page.getByText('Levar o Comunhão para minha igreja', { exact: true }).click();
      await page.getByPlaceholder('Ex: Igreja Videira Central').fill('Igreja Teste Browser ' + stamp);
      await page.getByPlaceholder('Ex: Pastor Davi Almeida').fill('Pastor Browser ' + stamp);
      await page.getByPlaceholder('pastor@suaigreja.com').fill('pastor-browser-' + stamp + '@example.test');
      await page.getByPlaceholder('Mínimo 8 letras, números e símbolos (!@#$)').fill('TesteBrowser123!');
      await page.getByPlaceholder('Repita sua senha').fill('TesteBrowser123!');
      const verification = await clickResponse(page, page.getByRole('button', { name: 'Receber código de confirmação', exact: true }), '/api/auth/request-code');
      await page.getByLabel('Código recebido por e-mail').fill(verification.dev_code);
      const registered = await clickResponse(page, page.getByRole('button', { name: 'Confirmar e cadastrar igreja' }), '/api/auth/register-church');
      await page.getByText(registered.church.slug_code, { exact: true }).waitFor();
      assert.equal(await token(page), null, 'Sessão somente deve iniciar após confirmar tela de sucesso');
      await page.screenshot({ path: path.join(artifacts, 'church-success.png'), fullPage: true });
      await page.getByRole('button', { name: '🚪 Entrar no Aplicativo', exact: true }).click();
      await home(page);
      assert.ok(await token(page));
      report.push('Cadastro igreja confirma e-mail, exibe código antes da sessão e entra após botão explícito.');
      await context.close();
    }
    {
      const { page, context } = await newPage();
      await page.goto(base);
      await page.getByText('Primeira vez por aqui?', { exact: false }).click();
      await page.getByLabel('Nome', { exact: true }).fill('Pessoa Browser ' + stamp);
      await page.getByLabel('Seu e-mail', { exact: true }).fill('member-browser-' + stamp + '@example.test');
      await page.getByLabel('Idade', { exact: true }).fill('24');
      await page.getByLabel('Crie uma senha', { exact: true }).fill('TesteBrowser123!');
      await page.getByLabel('Confirme a senha', { exact: true }).fill('TesteBrowser123!');
      const verification = await clickResponse(page, page.getByRole('button', { name: 'Receber código de confirmação', exact: true }), '/api/auth/request-code');
      await page.getByLabel('Código recebido por e-mail').fill(verification.dev_code);
      await clickResponse(page, page.getByRole('button', { name: 'Confirmar e criar minha conta' }), '/api/auth/register');
      await home(page);
      // Simula dados legados: adulto com flag antiga e telefone já salvo.
      const legacySession = await token(page);
      const legacyProfile = await fetch(base + '/api/auth/me', { headers: { Authorization: 'Bearer ' + legacySession } }).then(response => response.json());
      await page.route('**/api/auth/me', route => route.fulfill({ status: 200, json: { ...legacyProfile, parent_consent_verified: 1, parent_phone: '11988776655' } }));
      await page.reload();
      await home(page);
      await page.getByRole('button', { name: 'Abrir menu e configurações' }).click();
      await page.getByText('📋 Status do Seu Perfil', { exact: true }).click();
      await page.getByPlaceholder('Ex: 24', { exact: true }).fill('16');
      assert.equal(await page.getByLabel('Telefone do responsável com DDD').inputValue(), '11988776655');
      await page.getByRole('button', { name: 'Solicitar autorização ao responsável' }).waitFor();
      report.push('Perfil legado adulto com flag de consentimento antiga exige nova autorização ao mudar para menor.');
      await page.unrouteAll({ behavior: 'wait' });
      const consent = await clickResponse(page, page.getByRole('button', { name: 'Solicitar autorização ao responsável' }), '/api/auth/parental-consent/send');
      await page.getByLabel('Código informado pelo responsável').fill(consent.dev_code);
      const updated = await clickResponse(page, page.getByRole('button', { name: 'Salvar e Resgatar Bônus' }), '/api/auth/update-profile');
      for (const secret of ['password_hash', 'verification_code', 'verification_code_expires_at', 'parent_consent_code', 'session_version']) assert(!(secret in updated.user), secret + ' não pode aparecer no perfil');
      const session = await token(page);
      const me = await fetch(base + '/api/auth/me', { headers: { Authorization: 'Bearer ' + session } }).then(r => r.json());
      assert.equal(me.age, 16);
      assert.equal(me.parent_consent_verified, 1);
      assert.equal(me.parent_phone, '11988776655');
      report.push('Cadastro membro completo na UI; atualização adulto→menor confirma responsável e retorna perfil sem campos secretos.');
      await home(page);
      await page.getByRole('button', { name: 'Alternar conta', exact: true }).click();
      await page.getByRole('button', { name: '🚪 Encerrar Sessão (Logout)', exact: true }).click();
      await page.getByRole('button', { name: 'Entrar na minha comunidade' }).waitFor();
      assert.equal(await token(page), null);
      assert.equal(await page.evaluate(() => sessionStorage.getItem('church_auth_user')), null);
      report.push('Logout remove sessão ativa e volta à entrada.');
      await context.close();
    }
    assert.deepEqual(failures, [], 'Erros não tratados do navegador');
    return { checks: report.length, scenarios: report, pageErrors: failures };
  } catch (error) {
    if (currentPage && !currentPage.isClosed()) await currentPage.screenshot({ path: path.join(artifacts, 'mobile-failure.png'), fullPage: true }).catch(() => {});
    throw error;
  }
}
