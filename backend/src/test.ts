/**
 * Testes Automatizados E2E: Plataforma Multi-Igrejas, Discipulado e Gincanas
 */
const BASE_URL = 'http://127.0.0.1:3000';

export async function runTests() {
  console.log('🧪 Iniciando Bateria Completa de Testes E2E Multi-Igrejas...');

  // 1. Healthcheck
  console.log('\n[1/11] Testando Healthcheck da API...');
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const healthData = await healthRes.json() as any;
  if (healthRes.status !== 200 || healthData.status !== 'online') {
    throw new Error(`Falha no Healthcheck: ${JSON.stringify(healthData)}`);
  }
  console.log('✅ API online e operacional!');

  // 2. Cadastro de Nova Igreja por um Pastor
  console.log('\n[2/11] Testando Cadastro de Nova Congregação (Multi-Tenant)...');
  const churchRegRes = await fetch(`${BASE_URL}/api/auth/register-church`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      churchName: 'Igreja Presbiteriana Esperança',
      city: 'Campinas',
      state: 'SP',
      denomination: 'Presbiteriana',
      pastorName: 'Pastor Samuel Calvino',
      email: `pastor.samuel_${Date.now()}@esperanca.com`,
      password: 'senhaSegura123',
    }),
  });
  const churchRegData = await churchRegRes.json() as any;
  if (!churchRegRes.ok || !churchRegData.church) {
    throw new Error(`Falha ao cadastrar igreja: ${JSON.stringify(churchRegData)}`);
  }
  const newChurchToken = churchRegData.token;
  const newChurchCode = churchRegData.church.slug_code;
  console.log(`✅ Nova Igreja criada: "${churchRegData.church.name}" (Código de Convite: ${newChurchCode})`);

  // 3. Cadastro de Membro com Código da Igreja Videira
  console.log('\n[3/11] Testando Cadastro de Membro Vinculado à Igreja Videira...');
  const memberRegRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Irmão Barnabé Silva',
      email: `barnabe_${Date.now()}@igreja.com`,
      password: 'senhaSegura123',
      churchCode: 'VIDEIRA26',
    }),
  });
  const memberRegData = await memberRegRes.json() as any;
  if (!memberRegRes.ok || !memberRegData.token) {
    throw new Error(`Falha ao cadastrar membro: ${JSON.stringify(memberRegData)}`);
  }
  const barnabeToken = memberRegData.token;
  const barnabeId = memberRegData.user.id;
  console.log(`✅ Membro cadastrado: ${memberRegData.user.name} na congregação ${memberRegData.user.church_name}`);

  // 4. Verificação de Isolamento Multi-Tenant nos Grupos
  console.log('\n[4/11] Testando Isolamento Multi-Tenant nos Grupos...');
  const groupsRes = await fetch(`${BASE_URL}/api/groups`, {
    headers: { 'Authorization': `Bearer ${barnabeToken}` },
  });
  const groups = await groupsRes.json() as any[];
  if (!Array.isArray(groups) || groups.length === 0) {
    throw new Error('Falha ao listar grupos da igreja.');
  }
  // Garantir que todos os grupos pertencem à Videira
  const allVideira = groups.every((g) => g.church_id === memberRegData.user.church_id);
  if (!allVideira) {
    throw new Error('VIOLAÇÃO DE TENANT: grupos de outras igrejas foram vazados!');
  }
  console.log(`✅ Isolamento perfeito! O membro só visualiza os ${groups.length} grupos da sua igreja.`);

  // 5. Envio de Folha Manuscrita pelo Membro Barnabé
  console.log('\n[5/11] Testando Envio de Devocional com Folha Manuscrita...');
  const targetGroup = groups[0];
  const postDevotionalRes = await fetch(`${BASE_URL}/api/devotionals`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${barnabeToken}`,
    },
    body: JSON.stringify({
      groupId: targetGroup.id,
      imageUrl: 'https://images.unsplash.com/photo-1517842645767-c639042777db?w=800',
      passageOrChapter: 'Tiago 1:12',
      notes: 'Feliz o homem que persevera na provação, porque receberá a coroa da vida.',
    }),
  });
  const postDevotionalData = await postDevotionalRes.json() as any;
  if (!postDevotionalRes.ok || !postDevotionalData.devotional) {
    throw new Error(`Falha ao enviar devocional: ${JSON.stringify(postDevotionalData)}`);
  }
  const devotionalId = postDevotionalData.devotional.id;
  console.log(`✅ Devocional registrado com sucesso (+${postDevotionalData.points_earned.total} pts, 🔥 ${postDevotionalData.user_stats.current_streak}d)!`);

  // 6. Teste de Rigorosa Privacidade no Feed Comunitário
  console.log('\n[6/11] Testando Privacidade Rigorosa das Anotações no Feed...');
  // Login como outro membro comum (João Pedro)
  const joaoLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'joao@igreja.com', password: '123456' }),
  });
  const joaoData = await joaoLoginRes.json() as any;
  const joaoToken = joaoData.token;

  const feedRes = await fetch(`${BASE_URL}/api/devotionals/feed`, {
    headers: { 'Authorization': `Bearer ${joaoToken}` },
  });
  const feed = await feedRes.json() as any[];
  const barnabePost = feed.find((p) => p.id === devotionalId);

  if (!barnabePost) {
    throw new Error('Post do devocional não encontrado no feed.');
  }
  if (barnabePost.image_url !== null || barnabePost.notes !== null) {
    throw new Error('FALHA DE PRIVACIDADE: a folha ou reflexão íntima do irmão foi exposta para outro membro no feed!');
  }
  if (!barnabePost.is_private_protected) {
    throw new Error('Flag is_private_protected não está ativada no post protegido.');
  }
  console.log('✅ Privacidade sagrada validada: outro membro recebe image_url: null e notes: null!');

  // 7. Login do Líder Marcos e Discipulado Pastoral Sigiloso
  console.log('\n[7/11] Testando Discipulado Pastoral do Líder do Grupo...');
  const liderLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'lider@igreja.com', password: '123456' }),
  });
  const liderData = await liderLoginRes.json() as any;
  const liderToken = liderData.token;

  // O líder pode inspecionar a folha para discipulado
  const reviewsRes = await fetch(`${BASE_URL}/api/devotionals/leader-reviews`, {
    headers: { 'Authorization': `Bearer ${liderToken}` },
  });
  const reviews = await reviewsRes.json() as any[];
  const reviewTarget = reviews.find((r) => r.id === devotionalId);
  if (!reviewTarget || !reviewTarget.image_url) {
    throw new Error('Líder do grupo não conseguiu acessar a folha para discipulado.');
  }
  console.log(`   Líder Marcos acessou a folha de ${reviewTarget.member_name} para avaliação pastoral.`);

  // Líder envia orientação pastoral bíblica
  const feedbackRes = await fetch(`${BASE_URL}/api/devotionals/${devotionalId}/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${liderToken}`,
    },
    body: JSON.stringify({
      pastoralGuidance: 'Barnabé, meu irmão: excelente meditação! A palavra dokimos em Tiago 1:12 denota o ouro que passa pelo fogo e sai aprovado. Deus está fortalecendo sua perseverança!',
    }),
  });
  const feedbackData = await feedbackRes.json() as any;
  if (!feedbackRes.ok) {
    throw new Error(`Falha ao enviar orientação pastoral: ${JSON.stringify(feedbackData)}`);
  }
  console.log('✅ Orientação pastoral enviada com sucesso pelo Líder!');

  // 8. Membro Acessando suas Orientações Recebidas ("Dicas do Meu Líder")
  console.log('\n[8/11] Testando Consulta de Dicas Bíblicas pelo Membro Barnabé...');
  const myFeedbacksRes = await fetch(`${BASE_URL}/api/devotionals/my-feedbacks`, {
    headers: { 'Authorization': `Bearer ${barnabeToken}` },
  });
  const myFeedbacks = await myFeedbacksRes.json() as any[];
  if (!Array.isArray(myFeedbacks) || myFeedbacks.length === 0) {
    throw new Error('Membro não recebeu sua orientação pastoral.');
  }
  console.log(`✅ Membro visualizou sua dica pastoral recebida de ${myFeedbacks[0].leader_name}:`);
  console.log(`   "${myFeedbacks[0].pastoral_guidance}"`);

  // 9. Ranking Interno de Células (Competição Saudável)
  console.log('\n[9/11] Testando Ranking de Grupos / Células da Mesma Igreja...');
  const groupsRankRes = await fetch(`${BASE_URL}/api/gamification/groups-ranking`, {
    headers: { 'Authorization': `Bearer ${barnabeToken}` },
  });
  const rankedGroups = await groupsRankRes.json() as any[];
  if (!Array.isArray(rankedGroups) || rankedGroups.length === 0) {
    throw new Error('Falha no ranking de grupos.');
  }
  console.log(`✅ Ranking de células ativo! Grupo Líder: "${rankedGroups[0].title}" (Total: ${rankedGroups[0].total_group_points} pts, Média Streak: 🔥 ${rankedGroups[0].avg_streak}d)`);

  // 10. Gincana Amistosa Inter-Igrejas por Convite
  console.log('\n[10/11] Testando Adesão da Nova Igreja à Gincana Inter-Igrejas...');
  const joinChalRes = await fetch(`${BASE_URL}/api/gamification/challenge/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${newChurchToken}`,
    },
    body: JSON.stringify({ inviteCode: 'PROVERBIOS26' }),
  });
  const joinChalData = await joinChalRes.json() as any;
  if (!joinChalRes.ok) {
    throw new Error(`Falha ao entrar na gincana: ${JSON.stringify(joinChalData)}`);
  }
  console.log(`✅ ${joinChalData.message}`);

  // Consulta do placar geral da Gincana
  const chalRes = await fetch(`${BASE_URL}/api/gamification/challenge`, {
    headers: { 'Authorization': `Bearer ${newChurchToken}` },
  });
  const chalData = await chalRes.json() as any;
  console.log(`✅ Placar Geral da Gincana "${chalData.active_challenge.title}":`);
  for (const church of chalData.leaderboard) {
    console.log(`   ${church.badge}: ${church.church_name} - ${church.total_points_earned} pontos`);
  }

  // 11. Validação de Cupom com QR Code pelo Líder
  console.log('\n[11/11] Testando Validação de Cupom no Culto...');
  const redeemRes = await fetch(`${BASE_URL}/api/gamification/redeem`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${liderToken}`,
    },
    body: JSON.stringify({ couponCode: 'CUPOM-OURO-MARIA2026' }),
  });
  const redeemData = await redeemRes.json() as any;
  if (!redeemRes.ok || redeemData.coupon.status !== 'used') {
    throw new Error(`Falha no resgate do cupom: ${JSON.stringify(redeemData)}`);
  }
  console.log(`✅ Cupom da Dona Maria validado com sucesso por Líder Marcos!`);

  console.log('\n========================================================================');
  console.log('🎉 TODOS OS 11 TESTES DO PLANO MULTI-IGREJAS FORAM APROVADOS COM SUCESSO!');
  console.log('========================================================================\n');
}

if (process.argv[1]?.endsWith('test.ts')) {
  runTests().catch((err) => {
    console.error('\n❌ ERRO NOS TESTES:', err);
    process.exit(1);
  });
}
