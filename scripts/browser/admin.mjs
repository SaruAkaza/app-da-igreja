import assert from 'node:assert/strict';
import path from 'node:path';

export async function runAdminChecks(browser, base, artifacts) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  const scenarios = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(base + '/admin/');
    await page.locator('#email').fill('maria@igreja.com');
    await page.locator('#password').fill('123456');
    await page.getByRole('button', { name: 'Entrar no painel', exact: false }).click();
    await page.locator('#loginError').filter({ hasText: 'exclusivo de administradores' }).waitFor();
    assert.equal(await page.evaluate(() => sessionStorage.getItem('communhao_session')), null);
    scenarios.push('Perfil membro não acessa painel administrativo.');

    await page.getByRole('button', { name: 'Entrar como Admin', exact: true }).click();
    await page.locator('#shell').waitFor({ state: 'visible' });
    await page.locator('#content[aria-busy="false"]').waitFor();
    scenarios.push('Acesso rápido administrador autentica.');
    for (const target of ['church', 'members', 'groups', 'reviews', 'rewards', 'challenge', 'dashboard']) {
      await page.locator('nav [data-page="' + target + '"]').click();
      await page.locator('#content[aria-busy="false"]').waitFor();
      assert.equal(await page.locator('#connection').innerText(), 'Conectado', target);
      assert.ok(await page.locator('#content h1').innerText());
      scenarios.push('Seção administrativa carrega: ' + target + '.');
    }
    assert.equal(await page.getByRole('link', { name: 'Abrir App Mobile' }).getAttribute('href'), '/');
    scenarios.push('Link para aplicativo aponta para origem correta.');

    const token = await page.evaluate(() => sessionStorage.getItem('communhao_session'));
    await page.route('**/api/auth/me', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Temporário"}' }));
    await page.reload();
    await page.locator('#loginError').filter({ hasText: 'Temporário' }).waitFor();
    assert.equal(await page.evaluate(() => sessionStorage.getItem('communhao_session')), token);
    scenarios.push('Falha temporária preserva sessão administrativa.');
    await page.unroute('**/api/auth/me');
    await page.reload();
    await page.locator('#shell').waitFor({ state: 'visible' });
    await page.locator('#content[aria-busy="false"]').waitFor();
    scenarios.push('Sessão administrativa recupera quando API retorna.');
    await page.screenshot({ path: path.join(artifacts, 'admin-dashboard.png'), fullPage: true });

    await page.locator('#shell .sidebar [data-action="logout"]').click();
    await page.locator('#login').waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => sessionStorage.getItem('communhao_session')), null);
    scenarios.push('Logout administrativo remove sessão.');
    assert.deepEqual(errors, [], 'Erros não tratados no painel administrativo.');
    return { checks: scenarios.length, scenarios, pageErrors: errors };
  } catch (error) {
    await page.screenshot({ path: path.join(artifacts, 'admin-failure.png'), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}
