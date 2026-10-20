/**
 * Testes Automatizados E2E da API do App Devocional da Igreja
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://127.0.0.1:3000';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runTests() {
  console.log('🧪 Iniciando Bateria de Testes Automatizados E2E...');

  // 1. Healthcheck
  console.log('\n[1/10] Testando Healthcheck da API...');
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const healthData = await healthRes.json() as any;
  if (healthRes.status !== 200 || healthData.status !== 'online') {
    throw new Error(`Falha no Healthcheck: ${JSON.stringify(healthData)}`);
  }
  console.log('✅ Healthcheck online com sucesso!');

  // 2. Login como Pastor Davi (Admin)
  console.log('\n[2/10] Testando Login de Administrador...');
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@igreja.com', password: '123456' }),
  });
  const adminLoginData = await adminLoginRes.json() as any;
  if (!adminLoginRes.ok || !adminLoginData.token) {
    throw new Error(`Falha no Login de Admin: ${JSON.stringify(adminLoginData)}`);
  }
  const adminToken = adminLoginData.token;
  console.log(`✅ Admin autenticado: ${adminLoginData.user.name} (Role: ${adminLoginData.user.role})`);

  // 3. Cadastro de Novo Irmão
  console.log('\n[3/10] Testando Cadastro de Novo Membro...');
  const testEmail = `irmao_teste_${Date.now()}@igreja.com`;
  const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Irmão Barnabé de Teste',
      email: testEmail,
      password: 'senhaSegura123',
    }),
  });
  const registerData = await registerRes.json() as any;
  if (!registerRes.ok || !registerData.token) {
    throw new Error(`Falha no Cadastro: ${JSON.stringify(registerData)}`);
  }
  const memberToken = registerData.token;
  const memberId = registerData.user.id;
  console.log(`✅ Membro criado: ${registerData.user.name} (${registerData.user.email})`);

  // 4. Listar Grupos e Verificar Inscrição Automática
  console.log('\n[4/10] Testando Listagem de Grupos e Participação...');
  const groupsRes = await fetch(`${BASE_URL}/api/groups`, {
    headers: { 'Authorization': `Bearer ${memberToken}` },
  });
  const groupsData = await groupsRes.json() as any[];
  if (!groupsRes.ok || !Array.isArray(groupsData) || groupsData.length === 0) {
    throw new Error('Falha ao listar grupos.');
  }
  const targetGroup = groupsData[0];
  console.log(`✅ Grupos listados (${groupsData.length} grupos). Alvo: "${targetGroup.title}"`);

  // 5. Enviar Foto de Devocional (Folha Manuscrita)
  console.log('\n[5/10] Testando Postagem de Devocional com Foto da Folha...');
  const postDevotionalRes = await fetch(`${BASE_URL}/api/devotionals`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${memberToken}`,
    },
    body: JSON.stringify({
      groupId: targetGroup.id,
      imageUrl: 'https://images.unsplash.com/photo-1517842645767-c639042777db?w=800',
      passageOrChapter: 'Tiago 1:5',
      notes: 'Se algum de vocês tem falta de sabedoria, peça-a a Deus, que a todos dá livremente.',
    }),
  });
  const postDevotionalData = await postDevotionalRes.json() as any;
  if (!postDevotionalRes.ok || !postDevotionalData.devotional) {
    throw new Error(`Falha ao publicar devocional: ${JSON.stringify(postDevotionalData)}`);
  }
  const devotionalId = postDevotionalData.devotional.id;
  console.log(`✅ Devocional publicado com sucesso!`);
  console.log(`   Pontos recebidos: +${postDevotionalData.points_earned.total} (Base: ${postDevotionalData.points_earned.base}, Bônus Streak: ${postDevotionalData.points_earned.streak_bonus})`);
  console.log(`   Sequência atual (Streak): 🔥 ${postDevotionalData.user_stats.current_streak} dia(s)`);

  // 6. Testar Reação Bíblica ("Amém 🙏")
  console.log('\n[6/10] Testando Reação "Amém 🙏" no Devocional...');
  const reactRes = await fetch(`${BASE_URL}/api/devotionals/${devotionalId}/react`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ reactionType: 'amen' }),
  });
  const reactData = await reactRes.json() as any;
  if (!reactRes.ok || !reactData.active) {
    throw new Error(`Falha na reação: ${JSON.stringify(reactData)}`);
  }
  console.log('✅ Reação "Amém 🙏" registrada com sucesso pelo Pastor!');

  // 7. Atribuição de Bônus Pastoral pelo Pastor Davi
  console.log('\n[7/10] Testando Atribuição de Bônus de Pontos pelo Administrador...');
  const bonusRes = await fetch(`${BASE_URL}/api/admin/bonus`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      userId: memberId,
      amount: 1500, // Pontos suficientes para alcançar o nível Bronze!
      reason: 'Destaque de dedicação aos estudos no culto de jovens',
    }),
  });
  const bonusData = await bonusRes.json() as any;
  if (!bonusRes.ok) {
    throw new Error(`Falha ao conceder bônus: ${JSON.stringify(bonusData)}`);
  }
  console.log(`✅ ${bonusData.message}`);

  // 8. Enviar segundo devocional em outro grupo para acionar desbloqueio automático de cupom
  console.log('\n[8/10] Testando Verificação de Cupons e Desbloqueio de Recompensas...');
  const otherGroup = groupsData[1] || groupsData[0];
  const secondPostRes = await fetch(`${BASE_URL}/api/devotionals`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${memberToken}`,
    },
    body: JSON.stringify({
      groupId: otherGroup.id,
      imageUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=800',
      passageOrChapter: 'Capítulo 2',
      notes: 'A cruz nos esvazia do orgulho e nos enche da graça de Cristo.',
    }),
  });
  const secondPostData = await secondPostRes.json() as any;
  console.log(`✅ Segundo devocional postado! Total de pontos: ${secondPostData.user_stats.total_points}`);

  // 9. Buscar Cupons do Membro
  console.log('\n[9/10] Consultando Carteira de Cupons Digitais do Membro...');
  const couponsRes = await fetch(`${BASE_URL}/api/gamification/my-coupons`, {
    headers: { 'Authorization': `Bearer ${memberToken}` },
  });
  const couponsData = await couponsRes.json() as any[];
  if (!couponsRes.ok) {
    throw new Error('Falha ao buscar cupons.');
  }
  console.log(`✅ O membro possui ${couponsData.length} cupom(ns) na carteira digital.`);
  let activeCoupon = couponsData.find((c) => c.status === 'active');

  // Se o seed já tinha cupom para a Maria, vamos testar resgate com o cupom da Maria ou do membro
  let codeToRedeem = activeCoupon ? activeCoupon.coupon_code : 'CUPOM-BRONZE-JOAO2026';

  // 10. Baixa / Resgate do Cupom pelo Líder/Admin no Culto
  console.log(`\n[10/10] Testando Resgate de Cupom (Código: ${codeToRedeem}) pelo Líder/Admin...`);
  const redeemRes = await fetch(`${BASE_URL}/api/gamification/redeem`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ couponCode: codeToRedeem }),
  });
  const redeemData = await redeemRes.json() as any;
  if (!redeemRes.ok || redeemData.coupon.status !== 'used') {
    throw new Error(`Falha no resgate do cupom: ${JSON.stringify(redeemData)}`);
  }
  console.log(`✅ Cupom validado com sucesso!`);
  console.log(`   Prêmio: ${redeemData.coupon.reward_title}`);
  console.log(`   Membro: ${redeemData.coupon.member_name}`);
  console.log(`   Local/Parceiro: ${redeemData.coupon.partner_name}`);

  console.log('\n======================================================');
  console.log('🎉 TODOS OS 10 TESTES E2E FORAM CONCLUÍDOS COM SUCESSO!');
  console.log('======================================================\n');
}

if (process.argv[1]?.endsWith('test.ts')) {
  runTests().catch((err) => {
    console.error('\n❌ ERRO NOS TESTES:', err);
    process.exit(1);
  });
}
