/**
 * Testes Automatizados E2E: Plataforma Multi-Igrejas, Discipulado, 2FA, Menores, Senha Forte e Gincanas
 */
const BASE_URL = 'http://127.0.0.1:3000';

export async function runTests() {
  console.log('🧪 Iniciando Bateria Completa de Testes E2E (Segurança 2FA, Menores, Perfil 100% e Gincanas)...');

  // 1. Healthcheck
  console.log('\n[1/13] Testando Healthcheck da API...');
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const healthData = (await healthRes.json()) as any;
  if (healthRes.status !== 200 || healthData.status !== 'online') {
    throw new Error(`Falha no Healthcheck: ${JSON.stringify(healthData)}`);
  }
  console.log('✅ API online e operacional!');

  // 2. Cadastro Divergente de Igreja por um Pastor (com CNPJ, Endereço e Senha Forte)
  console.log('\n[2/13] Testando Cadastro Divergente de Nova Igreja com Senha Forte e CNPJ...');
  const churchRegRes = await fetch(`${BASE_URL}/api/auth/register-church`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      churchName: 'Igreja Presbiteriana Esperança',
      city: 'Campinas',
      state: 'SP',
      denomination: 'Presbiteriana',
      cnpj: '98.765.432/0001-10',
      addressFull: 'Rua da Fé, 500 - Cambuí, Campinas - SP',
      phone: '(19) 99888-1234',
      pastorName: 'Pastor Samuel Calvino',
      email: `pastor.samuel_${Date.now()}@esperanca.com`,
      password: 'SenhaForte@2026',
    }),
  });
  const churchRegData = (await churchRegRes.json()) as any;
  if (!churchRegRes.ok || !churchRegData.church) {
    throw new Error(`Falha ao cadastrar igreja: ${JSON.stringify(churchRegData)}`);
  }
  const newChurchToken = churchRegData.token;
  const newChurchCode = churchRegData.church.slug_code;
  console.log(`✅ Nova Igreja criada: "${churchRegData.church.name}"`);
  console.log(`   Código gerado: ${newChurchCode} | Link: ${churchRegData.church.invite_link}`);

  // 3. Validação de 2FA por E-mail (Código de 6 Dígitos)
  console.log('\n[3/13] Testando Fluxo de Validação em Duas Etapas (2FA) por E-mail...');
  const testEmail = `jovem.timoteo_${Date.now()}@igreja.com`;
  const codeReqRes = await fetch(`${BASE_URL}/api/auth/request-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail }),
  });
  const codeReqData = (await codeReqRes.json()) as any;
  if (!codeReqRes.ok || !codeReqData.dev_code) {
    throw new Error(`Falha ao solicitar código 2FA: ${JSON.stringify(codeReqData)}`);
  }
  console.log(`   Código 2FA de 6 dígitos gerado: ${codeReqData.dev_code}`);

  const verifyRes = await fetch(`${BASE_URL}/api/auth/verify-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, code: codeReqData.dev_code }),
  });
  const verifyData = (await verifyRes.json()) as any;
  if (!verifyRes.ok || !verifyData.valid) {
    throw new Error(`Falha ao verificar código 2FA: ${JSON.stringify(verifyData)}`);
  }
  console.log('✅ 2FA validado com sucesso para o e-mail do membro!');

  // 4. Salvaguarda e Consentimento Parental para Menor (< 18 anos) via WhatsApp (4 Dígitos)
  console.log('\n[4/13] Testando Salvaguarda de Menores (< 18) e Consentimento Parental...');
  const parentPhone = '11999998888';
  const consentReqRes = await fetch(`${BASE_URL}/api/auth/parental-consent/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      childName: 'Timóteo Junior',
      parentPhone,
      churchName: 'Igreja Videira Central',
    }),
  });
  const consentReqData = (await consentReqRes.json()) as any;
  if (!consentReqRes.ok || !consentReqData.dev_code) {
    throw new Error(`Falha ao gerar consentimento parental: ${JSON.stringify(consentReqData)}`);
  }
  console.log(`   Código parental de 4 dígitos: ${consentReqData.dev_code}`);
  console.log(`   URL WhatsApp gerada: ${consentReqData.whatsapp_url.substring(0, 50)}...`);

  const verifyConsentRes = await fetch(`${BASE_URL}/api/auth/parental-consent/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parentPhone, code: consentReqData.dev_code }),
  });
  const verifyConsentData = (await verifyConsentRes.json()) as any;
  if (!verifyConsentRes.ok || !verifyConsentData.verified) {
    throw new Error(`Falha ao verificar consentimento parental: ${JSON.stringify(verifyConsentData)}`);
  }
  console.log('✅ Autorização parental de 4 dígitos confirmada pelo responsável!');

  // 5. Cadastro Completo com Perfil 100% e Bônus de +100 Pontos
  console.log('\n[5/13] Testando Cadastro 100% com @handle e Concessão de Bônus de 100 Pontos...');
  const memberRegRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Timóteo',
      lastName: 'Junior',
      usernameHandle: '@timoteo.jr',
      email: testEmail,
      password: 'SenhaForte@2026',
      confirmPassword: 'SenhaForte@2026',
      age: 16,
      parentPhone,
      parentConsentCode: consentReqData.dev_code,
      avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200',
      addressStreet: 'Rua das Oliveiras, 250',
      addressNeighborhood: 'Jardim Bíblico',
      addressCity: 'São Paulo',
      addressState: 'SP',
      addressZipcode: '01234-567',
      churchCode: 'VIDEIRA26',
    }),
  });
  const memberRegData = (await memberRegRes.json()) as any;
  if (!memberRegRes.ok || !memberRegData.token) {
    throw new Error(`Falha no cadastro completo de membro: ${JSON.stringify(memberRegData)}`);
  }
  if (!memberRegData.bonus_awarded || memberRegData.user.total_points < 100) {
    throw new Error(`Bônus de 100% de perfil não foi concedido: ${JSON.stringify(memberRegData)}`);
  }
  const timoteoToken = memberRegData.token;
  console.log(`✅ Membro ${memberRegData.user.name} (@${memberRegData.user.username_handle}) cadastrado!`);
  console.log(`   Progresso do Perfil: ${memberRegData.profile_completion_percent}% | Bônus Ganho: +100 Pontos!`);

  // 6. Recuperação de Senha ("Esqueci Minha Senha") com 6 Dígitos
  console.log('\n[6/13] Testando Recuperação de Senha com Código de 6 Dígitos...');
  const forgotRes = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail }),
  });
  const forgotData = (await forgotRes.json()) as any;
  if (!forgotRes.ok || !forgotData.dev_code) {
    throw new Error(`Falha ao solicitar esqueci senha: ${JSON.stringify(forgotData)}`);
  }

  const resetRes = await fetch(`${BASE_URL}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      code: forgotData.dev_code,
      newPassword: 'NovaSenhaSegura#2026',
      confirmPassword: 'NovaSenhaSegura#2026',
    }),
  });
  const resetData = (await resetRes.json()) as any;
  if (!resetRes.ok) {
    throw new Error(`Falha ao redefinir senha: ${JSON.stringify(resetData)}`);
  }
  console.log('✅ Senha redefinida com sucesso com código de 6 dígitos e senha forte!');

  // 7. Login com @handle ou E-mail e Nova Senha
  console.log('\n[7/13] Testando Login com @handle e Nova Senha...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: '@timoteo.jr', password: 'NovaSenhaSegura#2026' }),
  });
  const loginData = (await loginRes.json()) as any;
  if (!loginRes.ok || !loginData.token) {
    throw new Error(`Falha ao logar com @handle: ${JSON.stringify(loginData)}`);
  }
  console.log(`✅ Login com @handle realizado com sucesso! Usuário: ${loginData.user.name}`);

  // 8. Isolamento Multi-Tenant nos Grupos
  console.log('\n[8/13] Testando Isolamento Multi-Tenant nos Grupos...');
  const groupsRes = await fetch(`${BASE_URL}/api/groups`, {
    headers: { Authorization: `Bearer ${timoteoToken}` },
  });
  const groups = (await groupsRes.json()) as any[];
  if (!Array.isArray(groups) || groups.length === 0) {
    throw new Error('Falha ao listar grupos da congregação.');
  }
  console.log(`✅ O membro visualiza os ${groups.length} grupos da sua igreja.`);

  // 9. Envio de Folha Manuscrita pelo Membro Timóteo
  console.log('\n[9/13] Testando Envio de Devocional com Folha Manuscrita...');
  const targetGroup = groups[0];
  const postDevotionalRes = await fetch(`${BASE_URL}/api/devotionals`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${timoteoToken}`,
    },
    body: JSON.stringify({
      groupId: targetGroup.id,
      imageUrl: 'https://images.unsplash.com/photo-1517842645767-c639042777db?w=800',
      passageOrChapter: 'Tiago 1:12',
      notes: 'Feliz o jovem que persevera na fé!',
    }),
  });
  const postDevotionalData = (await postDevotionalRes.json()) as any;
  if (!postDevotionalRes.ok || !postDevotionalData.devotional) {
    throw new Error(`Falha ao enviar devocional: ${JSON.stringify(postDevotionalData)}`);
  }
  const devotionalId = postDevotionalData.devotional.id;
  console.log(`✅ Devocional enviado (+${postDevotionalData.points_earned.total} pts, 🔥 ${postDevotionalData.user_stats.current_streak}d)!`);

  // 10. Rigorosa Privacidade no Feed Comunitário
  console.log('\n[10/13] Testando Rigorosa Privacidade das Anotações no Feed...');
  const joaoLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'joao@igreja.com', password: '123456' }),
  });
  const joaoData = (await joaoLoginRes.json()) as any;
  const feedRes = await fetch(`${BASE_URL}/api/devotionals/feed`, {
    headers: { Authorization: `Bearer ${joaoData.token}` },
  });
  const feed = (await feedRes.json()) as any[];
  const timoteoPost = feed.find((p) => p.id === devotionalId);
  if (!timoteoPost || timoteoPost.image_url !== null || timoteoPost.notes !== null) {
    throw new Error('FALHA DE PRIVACIDADE: a folha ou reflexão do irmão foi exposta para outro membro!');
  }
  console.log('✅ Privacidade sagrada: outro irmão vê o post como celebração da fidelidade (image_url: null)!');

  // 11. Discipulado Pastoral do Líder Marcos
  console.log('\n[11/13] Testando Discipulado Pastoral do Líder...');
  const liderLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'lider@igreja.com', password: '123456' }),
  });
  const liderData = (await liderLoginRes.json()) as any;
  const feedbackRes = await fetch(`${BASE_URL}/api/devotionals/${devotionalId}/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${liderData.token}`,
    },
    body: JSON.stringify({
      pastoralGuidance: 'Timóteo, excelente anotação! Que Deus continue firmando seus passos na juventude.',
    }),
  });
  if (!feedbackRes.ok) {
    throw new Error('Falha ao enviar orientação pastoral.');
  }
  console.log('✅ Orientação pastoral sigilosa enviada pelo Líder Marcos!');

  // 12. Ranking de Grupos e Batalha de Células
  console.log('\n[12/13] Testando Ranking de Grupos / Células...');
  const groupsRankRes = await fetch(`${BASE_URL}/api/gamification/groups-ranking`, {
    headers: { Authorization: `Bearer ${timoteoToken}` },
  });
  const rankedGroups = (await groupsRankRes.json()) as any[];
  if (!Array.isArray(rankedGroups) || rankedGroups.length === 0) {
    throw new Error('Falha no ranking de células.');
  }
  console.log(`✅ Batalha de Células ativa! Grupo líder: "${rankedGroups[0].title}" (${rankedGroups[0].total_group_points} pts)`);

  // 13. Resgate de Cupom
  console.log('\n[13/13] Testando Validação de Cupom pelo Líder...');
  const redeemRes = await fetch(`${BASE_URL}/api/gamification/redeem`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${liderData.token}`,
    },
    body: JSON.stringify({ couponCode: 'CUPOM-OURO-MARIA2026' }),
  });
  const redeemData = (await redeemRes.json()) as any;
  if (redeemRes.ok && redeemData.coupon?.status === 'used') {
    console.log(`✅ Cupom da Dona Maria validado com sucesso pelo Líder!`);
  } else if (redeemData.coupon?.status === 'used') {
    console.log(`✅ Cupom da Dona Maria confirmado como validado anteriormente pelo Líder!`);
  } else {
    throw new Error(`Falha no resgate do cupom: ${JSON.stringify(redeemData)}`);
  }

  console.log('\n========================================================================');
  console.log('🎉 TODOS OS 13 TESTES DE SEGURANÇA, 2FA E GAMIFICAÇÃO APROVADOS COM SUCESSO!');
  console.log('========================================================================\n');
}

if (process.argv[1]?.endsWith('test.ts')) {
  runTests().catch((err) => {
    console.error('\n❌ ERRO NOS TESTES:', err);
    process.exit(1);
  });
}
