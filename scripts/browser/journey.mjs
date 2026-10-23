import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export async function runJourneyChecks({ base, fixture, photo }) {
  let playwright;
  try { playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright'); }
  catch { throw new Error('Instale Playwright e os navegadores Chromium e WebKit antes de testar a jornada.'); }
  const artifacts = process.env.COMUNHAO_TEST_ARTIFACTS || fs.mkdtempSync(path.join(os.tmpdir(), 'comunhao-journey-browser-'));
  fs.mkdirSync(artifacts, { recursive: true });
  const profiles = [
    { name: 'desktop', engine: 'chromium', options: { viewport: { width: 1440, height: 1000 } } },
    { name: 'iphone', engine: 'webkit', options: { ...playwright.devices['iPhone 13'] } },
    { name: 'android', engine: 'chromium', options: { ...playwright.devices['Pixel 7'] } },
  ].filter(p => !process.env.COMUNHAO_TEST_PROFILES || process.env.COMUNHAO_TEST_PROFILES.split(',').includes(p.name));
  assert(profiles.length, 'Selecione ao menos um perfil válido.');
  const report = [];
  for (const profile of profiles) {
    const browser = await playwright[profile.engine].launch({ headless: true, ...(profile.engine === 'chromium' ? { args: ['--no-sandbox'], ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}) } : {}) });
    const f = fixture(profile.name), actors = {}, errors = [], checks = [];
    const note = message => { checks.push(message); console.log('✓ ' + profile.name + ': ' + message); };
    async function post(page, button, route, expected = 200) {
      const [response] = await Promise.all([page.waitForResponse(r => r.url().endsWith('/api' + route) && r.request().method() === 'POST'), button.click()]);
      const data = await response.json(); assert.equal(response.status(), expected, JSON.stringify(data)); return data;
    }
    async function actor(key) {
      const context = await browser.newContext(profile.options);
      const page = await context.newPage(); page.setDefaultTimeout(18000);
      page.on('pageerror', e => errors.push(e.message));
      page.on('dialog', async d => await d.accept());
      actors[key] = { page, context };
      await page.goto(base);
      await page.getByLabel('E-mail ou nome de usuário', { exact: true }).fill(f.users[key].email);
      await page.getByLabel('Senha', { exact: true }).fill(f.password);
      await post(page, page.getByRole('button', { name: 'Entrar na minha comunidade' }), '/auth/login');
      await page.getByRole('button', { name: 'Abrir menu e configurações' }).waitFor();
      return page;
    }
    async function inGroup(page, tab = 'readings') {
      await page.goto(base + '/group?groupId=' + f.group + '&tab=' + tab);
      await page.getByRole('tab', { name: tab === 'readings' ? 'Leituras' : tab === 'questions' ? 'Dúvidas' : 'Conquistas', exact: true }).waitFor();
    }
    try {
      const member = await actor('member');
      assert.equal(await member.getByText('Cuidar dos meus grupos', { exact: true }).count(), 0);
      await member.getByText('Meus grupos', { exact: true }).click();
      await member.getByRole('button', { name: 'Abrir grupo Conexão ' + profile.name, exact: true }).click();
      await member.getByRole('tab', { name: 'Leituras', exact: true }).waitFor();
      note('Membro abre apenas seu grupo e não recebe ferramentas de liderança');

      const admin = await actor('admin');
      await inGroup(admin, 'rewards');
      async function reward(title, podium = false) {
        await admin.getByRole('button', { name: 'Cadastrar prêmio neste grupo', exact: true }).click();
        await admin.getByLabel('Nome do prêmio').fill(title);
        await admin.getByLabel('Local de retirada').fill('Encontro do grupo');
        if (podium) await admin.getByRole('button', { name: 'Pódio do ciclo', exact: true }).click();
        else await admin.getByLabel('Pontos necessários no grupo').fill('50');
        const data = await post(admin, admin.getByRole('button', { name: 'Salvar prêmio do grupo' }), '/admin/rewards', 201);
        await admin.getByRole('button', { name: 'Cadastrar prêmio neste grupo', exact: true }).waitFor();
        return data.reward.id;
      }
      await reward('Livro da conexão ' + profile.name);
      await reward('Pódio da conexão ' + profile.name, true);
      note('Administrador cadastra metas por pontos e pódio dentro do grupo');

      await admin.goto(base + '/home');
      await admin.getByRole('button', { name: 'Abrir menu e configurações' }).click();
      await admin.getByText('Painel da Igreja (Web)', { exact: true }).click();
      await admin.locator('#shell').waitFor({ state: 'visible' });
      assert.equal(await admin.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'Cabeçalho do painel deve caber no celular');
      await admin.getByRole('button', { name: 'Grupos de leitura', exact: true }).click();
      await admin.locator('[data-open-group="' + f.group + '"]').click();
      await admin.getByRole('tab', { name: 'Leituras', exact: true }).waitFor();
      note('Administrador circula entre aplicativo e painel com a mesma sessão');

      await member.getByRole('button', { name: 'Registrar leitura neste grupo', exact: true }).click();
      await member.getByPlaceholder('Ex: Tiago 1:19-27 ou Capítulo 3').fill('Salmos 119:105');
      await member.getByPlaceholder('Escreva em poucas palavras o que mais tocou seu coração...').fill('Reflexão privada da jornada ' + profile.name);
      const chooser = member.waitForEvent('filechooser');
      await member.getByRole('button', { name: '🖼️ Escolher da Galeria de Fotos', exact: true }).click();
      await (await chooser).setFiles({ name: 'leitura.png', mimeType: 'image/png', buffer: photo });
      const posted = await post(member, member.getByRole('button', { name: '✅ Tudo Certo, Enviar!', exact: true }), '/devotionals', 201);
      await member.getByRole('button', { name: 'Registrar dúvida sobre esta leitura', exact: true }).waitFor();
      assert.equal(posted.points_earned.total, 60); assert.equal(posted.unlocked_coupons.length, 1);
      note('Galeria envia imagem real, registra leitura e desbloqueia cupom do grupo');

      await member.getByRole('button', { name: 'Registrar dúvida sobre esta leitura', exact: true }).click();
      await member.getByRole('button', { name: 'Respondidas', exact: true }).click();
      const questionText = 'Como viver esta palavra no dia a dia? ' + profile.name;
      await member.getByLabel('Sua dúvida', { exact: true }).fill(questionText);
      const question = await post(member, member.getByRole('button', { name: 'Enviar dúvida ao líder', exact: true }), '/questions', 201);
      assert.equal(question.devotional_id, posted.devotional.id);
      await member.getByText(questionText, { exact: true }).waitFor();
      note('Dúvida é registrada na interface e preserva o vínculo com a imagem');

      const leader = await actor('leader');
      const photos = [];
      leader.on('response', r => { if (r.url().endsWith('/api/devotionals/' + posted.devotional.id + '/photo')) photos.push(r.status()); });
      await inGroup(leader, 'questions');
      await leader.getByText(questionText, { exact: true }).waitFor();
      await leader.getByLabel('Imagem vinculada à dúvida', { exact: true }).waitFor();
      await leader.getByLabel('Resposta para ' + f.users.member.name).fill('A Palavra ilumina cada decisão. Comece acolhendo e ouvindo sua família. ' + profile.name);
      await post(leader, leader.getByRole('button', { name: 'Enviar resposta', exact: true }), '/questions/' + question.id + '/answer');
      assert.ok(photos.includes(200), 'Imagem da dúvida deve carregar para a liderança responsável');
      note('Liderança acessa a imagem protegida e responde ao membro');

      await member.goto(base + '/home');
      await member.getByText('1 resposta(s) para ler', { exact: true }).waitFor();
      await member.getByText('Dúvidas e respostas', { exact: true }).click();
      await member.getByText('A Palavra ilumina cada decisão. Comece acolhendo e ouvindo sua família. ' + profile.name, { exact: true }).waitFor();
      await post(member, member.getByRole('button', { name: 'Marcar resposta como lida', exact: true }), '/questions/' + question.id + '/read');
      await member.getByRole('button', { name: 'Marcar resposta como lida', exact: true }).waitFor({ state: 'hidden' });
      note('Membro recebe aviso na página inicial, lê e marca a resposta');

      await inGroup(member, 'rewards');
      assert.equal(await member.getByRole('button', { name: 'Cadastrar prêmio neste grupo', exact: true }).count(), 0);
      assert.equal(await member.getByRole('button', { name: 'Registrar entrega de prêmio', exact: true }).count(), 0);
      const code = posted.unlocked_coupons[0].coupon_code;
      await member.getByText(code, { exact: true }).waitFor();
      await member.getByRole('button', { name: '📲 Apresentar QR Code no Culto', exact: true }).click();
      await member.getByRole('button', { name: 'Voltar', exact: true }).click();
      note('Membro acompanha conquista e apresenta o QR do seu próprio cupom');

      await inGroup(leader, 'rewards');
      await leader.getByRole('button', { name: 'Registrar entrega de prêmio', exact: true }).click();
      await leader.getByPlaceholder('Ex: CUPOM-OURO-MARIA2026').fill(code);
      await post(leader, leader.getByRole('button', { name: '✅ Validar e Dar Baixa', exact: true }), '/gamification/redeem');
      await inGroup(member, 'rewards');
      await member.getByText('UTILIZADO', { exact: true }).waitFor();
      note('Líder confirma entrega e o cupom aparece utilizado para o membro');

      await inGroup(admin, 'rewards');
      const closed = await post(admin, admin.getByRole('button', { name: 'Encerrar ciclo e premiar pódio', exact: true }), '/groups/' + f.group + '/close-cycle');
      assert.equal(closed.result.awardedCoupons[0].winner_id, f.users.member.id);
      await inGroup(member, 'rewards');
      await member.getByText(closed.result.awardedCoupons[0].coupon_code, { exact: true }).waitFor();
      note('Encerramento do ciclo premia o participante com leituras no grupo');

      const outsider = await actor('foreign');
      await outsider.getByText('Meus grupos', { exact: true }).click();
      assert.equal(await outsider.getByRole('button', { name: 'Abrir grupo Conexão ' + profile.name, exact: true }).count(), 0);
      await outsider.goto(base + '/group?groupId=' + f.group + '&tab=questions');
      await outsider.getByRole('alert').waitFor();
      assert.equal(await outsider.getByText(questionText, { exact: true }).count(), 0);
      note('Outra igreja não vê o grupo nem abre a conversa por endereço direto');

      await member.goto(base + '/home');
      await member.getByRole('button', { name: 'Alternar conta', exact: true }).click();
      await member.getByRole('button', { name: '+ Conectar Outra Conta', exact: true }).click();
      await member.getByLabel('E-mail ou nome de usuário', { exact: true }).fill(f.users.foreign.email);
      await member.getByLabel('Senha', { exact: true }).fill(f.password);
      await post(member, member.getByRole('button', { name: 'Entrar na minha comunidade' }), '/auth/login');
      await member.getByRole('button', { name: 'Abrir menu e configurações' }).waitFor();
      await member.getByText('Meus grupos', { exact: true }).click();
      await member.getByRole('button', { name: 'Abrir grupo Grupo de outra igreja ' + profile.name, exact: true }).waitFor();
      assert.equal(await member.getByRole('button', { name: 'Abrir grupo Conexão ' + profile.name, exact: true }).count(), 0);
      await member.getByLabel('Ir para a tela inicial').click();
      await member.getByRole('button', { name: 'Alternar conta', exact: true }).click();
      await member.getByText(f.users.member.name, { exact: true }).click();
      await member.getByRole('button', { name: 'Abrir menu e configurações' }).waitFor();
      await member.getByText('Meus grupos', { exact: true }).click();
      await member.getByRole('button', { name: 'Abrir grupo Conexão ' + profile.name, exact: true }).waitFor();
      note('Alternância real entre contas limpa os dados da igreja anterior');

      await admin.goto(base + '/home');
      await admin.getByRole('button', { name: 'Abrir menu e configurações' }).click();
      await admin.getByText('Painel da Igreja (Web)', { exact: true }).click();
      await admin.locator('#shell').waitFor({ state: 'visible' });
      await admin.getByRole('button', { name: 'Sair da conta', exact: true }).first().click();
      assert.equal(await admin.evaluate(() => sessionStorage.getItem('church_auth_token')), null);
      await admin.goto(base + '/home');
      await admin.getByLabel('E-mail ou nome de usuário', { exact: true }).waitFor();
      note('Sair do painel também encerra a sessão ativa no aplicativo web');
      for (const [key, { page }] of Object.entries(actors)) {
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'Sem transbordamento em ' + key);
      }
      assert.deepEqual(errors, []);
      await inGroup(member, 'rewards');
      await member.getByText(closed.result.awardedCoupons[0].coupon_code, { exact: true }).scrollIntoViewIfNeeded();
      await member.screenshot({ path: path.join(artifacts, profile.name + '-conquistas.png'), fullPage: true });
      await inGroup(member, 'questions');
      await member.getByText('A Palavra ilumina cada decisão. Comece acolhendo e ouvindo sua família. ' + profile.name, { exact: true }).scrollIntoViewIfNeeded();
      await member.screenshot({ path: path.join(artifacts, profile.name + '-conversa.png'), fullPage: true });
      note('Telas dos perfis sem erros JavaScript e sem transbordamento horizontal');
      report.push({ profile: profile.name, engine: profile.engine, checks: checks.length, scenarios: checks });
    } catch (error) {
      for (const [key, { page }] of Object.entries(actors)) await page.screenshot({ path: path.join(artifacts, profile.name + '-' + key + '-falha.png'), fullPage: true }).catch(() => {});
      throw error;
    } finally { await browser.close(); }
  }
  console.log(JSON.stringify({ ok: true, journey: report, artifacts }, null, 2));
}
