import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import { db, initDatabase } from './database.js';

export async function runSeed() {
  initDatabase();

  const churchCount = db.prepare('SELECT COUNT(*) as count FROM churches').get() as { count: number };
  if (churchCount.count > 0) {
    console.log('ℹ️ O banco de dados já possui igrejas cadastradas. Pulando seed.');
    return;
  }

  console.log('🌱 Populando dados da plataforma Multi-Igrejas...');

  const passwordHash = await bcrypt.hash('123456', 10);
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  // 1. Igrejas Cadastradas
  const churches = [
    {
      id: 'chu-videira-01',
      name: 'Igreja Videira Central',
      slug_code: 'VIDEIRA26',
      city: 'São Paulo',
      state: 'SP',
      denomination: 'Videira',
      logo_url: 'https://images.unsplash.com/photo-1548625361-19598285a815?w=200',
    },
    {
      id: 'chu-memorial-01',
      name: 'Igreja Batista Memorial',
      slug_code: 'MEMORIAL26',
      city: 'São Paulo',
      state: 'SP',
      denomination: 'Batista',
      logo_url: 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?w=200',
    },
  ];

  const insertChurch = db.prepare(`
    INSERT INTO churches (id, name, slug_code, city, state, denomination, logo_url, created_at)
    VALUES (@id, @name, @slug_code, @city, @state, @denomination, @logo_url, @created_at)
  `);

  for (const c of churches) {
    insertChurch.run({ ...c, created_at: now });
  }

  // 2. Usuários da Videira e da Memorial
  const users = [
    // Videira
    {
      id: 'usr-admin-01',
      church_id: 'chu-videira-01',
      name: 'Pastor Davi (Admin)',
      email: 'admin@igreja.com',
      role: 'church_admin',
      current_streak: 24,
      highest_streak: 24,
      last_devotional_date: today,
      total_points: 3850,
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    },
    {
      id: 'usr-leader-01',
      church_id: 'chu-videira-01',
      name: 'Líder Marcos Oliveira',
      email: 'lider@igreja.com',
      role: 'leader',
      current_streak: 15,
      highest_streak: 18,
      last_devotional_date: today,
      total_points: 2900,
      avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    },
    {
      id: 'usr-maria-01',
      church_id: 'chu-videira-01',
      name: 'Dona Maria de Lourdes',
      email: 'maria@igreja.com',
      role: 'member',
      current_streak: 30, // Exemplo inspirador de idosa fiel
      highest_streak: 30,
      last_devotional_date: today,
      total_points: 4120, // Nível Ouro
      avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
    },
    {
      id: 'usr-joao-01',
      church_id: 'chu-videira-01',
      name: 'João Pedro (Jovens)',
      email: 'joao@igreja.com',
      role: 'member',
      current_streak: 7,
      highest_streak: 12,
      last_devotional_date: today,
      total_points: 1650, // Nível Bronze
      avatar_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150',
    },

    // Batista Memorial
    {
      id: 'usr-admin-memorial',
      church_id: 'chu-memorial-01',
      name: 'Pastor Silas Batista',
      email: 'pastor.silas@memorial.com',
      role: 'church_admin',
      current_streak: 20,
      highest_streak: 20,
      last_devotional_date: today,
      total_points: 3200,
      avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    },
    {
      id: 'usr-leader-memorial',
      church_id: 'chu-memorial-01',
      name: 'Líder Lucas Mendes',
      email: 'lucas@memorial.com',
      role: 'leader',
      current_streak: 12,
      highest_streak: 15,
      last_devotional_date: today,
      total_points: 2100,
      avatar_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
    },
    {
      id: 'usr-raquel-memorial',
      church_id: 'chu-memorial-01',
      name: 'Raquel Santos',
      email: 'raquel@memorial.com',
      role: 'member',
      current_streak: 18,
      highest_streak: 18,
      last_devotional_date: today,
      total_points: 2750,
      avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    },
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (id, church_id, name, email, password_hash, role, current_streak, highest_streak, last_devotional_date, total_points, avatar_url, created_at)
    VALUES (@id, @church_id, @name, @email, @password_hash, @role, @current_streak, @highest_streak, @last_devotional_date, @total_points, @avatar_url, @created_at)
  `);

  for (const u of users) {
    insertUser.run({
      ...u,
      password_hash: passwordHash,
      created_at: now,
    });
  }

  // 3. Grupos / Células com seus Líderes Discipuladores
  const groups = [
    // Videira
    {
      id: 'grp-tiago-01',
      church_id: 'chu-videira-01',
      leader_id: 'usr-leader-01',
      title: 'Devocional no Livro de Tiago',
      description: 'Estudo diário sobre fé prática e sabedoria. Anote suas reflexões na folha.',
      category: 'biblia',
      book_or_theme: 'Carta de Tiago (Novo Testamento)',
      cover_image: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600',
      invite_code: 'TIAGO26',
    },
    {
      id: 'grp-ego-01',
      church_id: 'chu-videira-01',
      leader_id: 'usr-leader-01',
      title: 'O Ego Transformado (Timothy Keller)',
      description: 'Leitura sobre a verdadeira humildade cristã e o descanso do coração.',
      category: 'livro',
      book_or_theme: 'O Ego Transformado',
      cover_image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600',
      invite_code: 'EGO26',
    },
    {
      id: 'grp-pais-01',
      church_id: 'chu-videira-01',
      leader_id: 'usr-admin-01',
      title: 'Paternidade Bem Resolvida',
      description: 'Pais e mães aprendendo a discipular seus filhos.',
      category: 'livro',
      book_or_theme: 'Família Cristã',
      cover_image: 'https://images.unsplash.com/photo-1476703993599-0035a21b17a9?w=600',
      invite_code: 'PAIS26',
    },
    // Memorial
    {
      id: 'grp-paulinas-01',
      church_id: 'chu-memorial-01',
      leader_id: 'usr-leader-memorial',
      title: 'Jovens Memorial - Cartas Paulinas',
      description: 'Aprofundamento nas epístolas aos Romanos e Gálatas.',
      category: 'biblia',
      book_or_theme: 'Epístolas Paulinas',
      cover_image: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=600',
      invite_code: 'PAULO26',
    },
  ];

  const insertGroup = db.prepare(`
    INSERT INTO groups (id, church_id, leader_id, title, description, category, book_or_theme, cover_image, invite_code, created_at)
    VALUES (@id, @church_id, @leader_id, @title, @description, @category, @book_or_theme, @cover_image, @invite_code, @created_at)
  `);

  for (const g of groups) {
    insertGroup.run({ ...g, created_at: now });
  }

  // 4. Membros nos Grupos
  const insertMember = db.prepare(`
    INSERT INTO group_members (id, group_id, user_id, joined_at)
    VALUES (?, ?, ?, ?)
  `);

  insertMember.run('gm-01', 'grp-tiago-01', 'usr-maria-01', now);
  insertMember.run('gm-02', 'grp-tiago-01', 'usr-joao-01', now);
  insertMember.run('gm-03', 'grp-tiago-01', 'usr-leader-01', now);
  insertMember.run('gm-04', 'grp-tiago-01', 'usr-admin-01', now);

  insertMember.run('gm-05', 'grp-ego-01', 'usr-maria-01', now);
  insertMember.run('gm-06', 'grp-ego-01', 'usr-joao-01', now);

  insertMember.run('gm-07', 'grp-pais-01', 'usr-maria-01', now);
  insertMember.run('gm-08', 'grp-pais-01', 'usr-admin-01', now);

  insertMember.run('gm-09', 'grp-paulinas-01', 'usr-raquel-memorial', now);
  insertMember.run('gm-10', 'grp-paulinas-01', 'usr-leader-memorial', now);
  insertMember.run('gm-11', 'grp-paulinas-01', 'usr-admin-memorial', now);

  // 5. Trimestres e Prêmios Locais da Videira
  const quarterVideira = 'qtr-videira-2026-t1';
  db.prepare(`
    INSERT INTO quarters (id, church_id, title, start_date, end_date, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(quarterVideira, 'chu-videira-01', '1º Trimestre 2026 - O Hábito da Palavra', '2026-01-01', '2026-03-31', 1, now);

  const rewards = [
    {
      id: 'rew-bronze-01',
      quarter_id: quarterVideira,
      church_id: 'chu-videira-01',
      title: '🥉 15% de Desconto na Livraria da Igreja',
      description: 'Válido para devocionais e bíblias.',
      tier: 'bronze',
      points_required: 1500,
      partner_name: 'Livraria Videira',
    },
    {
      id: 'rew-prata-01',
      quarter_id: quarterVideira,
      church_id: 'chu-videira-01',
      title: '🥈 R$ 20,00 na Camisa da Conferência 2026',
      description: 'Desconto na camiseta oficial do congresso.',
      tier: 'prata',
      points_required: 2800,
      partner_name: 'Secretaria da Igreja',
    },
    {
      id: 'rew-ouro-01',
      quarter_id: quarterVideira,
      church_id: 'chu-videira-01',
      title: '🥇 Almoço no Restaurante Parceiro + Livro do Trimestre',
      description: 'Voucher individual com sobremesa inclusa.',
      tier: 'ouro',
      points_required: 4000,
      partner_name: 'Restaurante do Pão & Livraria',
    },
  ];

  const insertReward = db.prepare(`
    INSERT INTO rewards (id, quarter_id, church_id, title, description, tier, points_required, partner_name, created_at)
    VALUES (@id, @quarter_id, @church_id, @title, @description, @tier, @points_required, @partner_name, @created_at)
  `);

  for (const r of rewards) {
    insertReward.run({ ...r, created_at: now });
  }

  // 6. Devocionais com Fotos de Folhas Manuscritas
  const devotionals = [
    {
      id: 'dev-01',
      church_id: 'chu-videira-01',
      group_id: 'grp-tiago-01',
      user_id: 'usr-maria-01',
      image_url: 'https://images.unsplash.com/photo-1517842645767-c639042777db?w=800',
      passage_or_chapter: 'Tiago 1:2-5',
      notes: 'Meus irmãos, considerem motivo de grande alegria as provações. A oração pela sabedoria.',
      points_awarded: 60,
      devotional_date: today,
    },
    {
      id: 'dev-02',
      church_id: 'chu-videira-01',
      group_id: 'grp-tiago-01',
      user_id: 'usr-joao-01',
      image_url: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800',
      passage_or_chapter: 'Tiago 1:19-22',
      notes: 'Sejam praticantes da palavra e não apenas ouvintes. Escrevi minhas metas de oração.',
      points_awarded: 60,
      devotional_date: today,
    },
    {
      id: 'dev-03',
      church_id: 'chu-videira-01',
      group_id: 'grp-ego-01',
      user_id: 'usr-maria-01',
      image_url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=800',
      passage_or_chapter: 'Capítulo 1 - A Humildade que Liberta',
      notes: 'A verdadeira humildade bíblica não é pensar menos de si mesmo, mas pensar menos em si mesmo.',
      points_awarded: 60,
      devotional_date: today,
    },
  ];

  const insertDevotional = db.prepare(`
    INSERT INTO devotionals (id, church_id, group_id, user_id, image_url, passage_or_chapter, notes, points_awarded, devotional_date, created_at)
    VALUES (@id, @church_id, @group_id, @user_id, @image_url, @passage_or_chapter, @notes, @points_awarded, @devotional_date, @created_at)
  `);

  for (const d of devotionals) {
    insertDevotional.run({ ...d, created_at: now });
  }

  // 7. Discipulado Pastoral do Líder (Orientações Bíblicas Sigilosas)
  const feedbacks = [
    {
      id: 'fb-01',
      church_id: 'chu-videira-01',
      group_id: 'grp-tiago-01',
      devotional_id: 'dev-01',
      leader_id: 'usr-leader-01',
      member_id: 'usr-maria-01',
      pastoral_guidance: 'Irmã Maria, que reflexão preciosa! No grego original de Tiago 1:2, a palavra alegria (chara) aponta para um regozijo profundo baseado na soberania de Deus, não nas circunstâncias passageiras. Continue firme sendo essa inspiração para a nossa congregação!',
    },
    {
      id: 'fb-02',
      church_id: 'chu-videira-01',
      group_id: 'grp-tiago-01',
      devotional_id: 'dev-02',
      leader_id: 'usr-leader-01',
      member_id: 'usr-joao-01',
      pastoral_guidance: 'Muito bom, João! Preste atenção especial ao v. 25 sobre a "lei perfeita da liberdade". A obediência a Cristo não é um fardo, mas a verdadeira liberdade contra o engano do pecado. Conte comigo para orarmos pelas suas metas!',
    },
  ];

  const insertFeedback = db.prepare(`
    INSERT INTO leader_feedbacks (id, church_id, group_id, devotional_id, leader_id, member_id, pastoral_guidance, created_at)
    VALUES (@id, @church_id, @group_id, @devotional_id, @leader_id, @member_id, @pastoral_guidance, @created_at)
  `);

  for (const fb of feedbacks) {
    insertFeedback.run({ ...fb, created_at: now });
  }

  // 8. Reações Comunitárias no Feed
  const insertReaction = db.prepare(`
    INSERT INTO reactions (id, devotional_id, user_id, reaction_type, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertReaction.run('reac-01', 'dev-01', 'usr-joao-01', 'amen', now);
  insertReaction.run('reac-02', 'dev-01', 'usr-leader-01', 'glory', now);

  // 9. Cupons Emitidos para Dona Maria
  const mariaCode = 'CUPOM-OURO-MARIA2026';
  const mariaQr = await QRCode.toDataURL(mariaCode);
  db.prepare(`
    INSERT INTO user_coupons (id, church_id, user_id, reward_id, coupon_code, qr_code_data, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
  `).run('cp-01', 'chu-videira-01', 'usr-maria-01', 'rew-ouro-01', mariaCode, mariaQr, now);

  // 10. Gincana Amistosa Inter-Igrejas por Convite Pastoral
  const challengeId = 'chal-proverbios-01';
  db.prepare(`
    INSERT INTO inter_church_challenges (id, title, description, created_by_church_id, invite_code, start_date, end_date, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
  `).run(
    challengeId,
    'Jornada 21 Dias em Provérbios',
    'Desafio de comunhão e sabedoria prática entre as congregações parceiras.',
    'chu-videira-01',
    'PROVERBIOS26',
    '2026-10-01',
    '2026-10-31',
    now
  );

  const insertParticipant = db.prepare(`
    INSERT INTO challenge_participants (id, challenge_id, church_id, total_points_earned, active_members_count, joined_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertParticipant.run('cp-part-01', challengeId, 'chu-videira-01', 12520, 4, now);
  insertParticipant.run('cp-part-02', challengeId, 'chu-memorial-01', 8050, 3, now);

  console.log('✅ Seed Multi-Igrejas concluído com sucesso!');
}

if (process.argv[1]?.endsWith('seed.ts')) {
  runSeed().catch(console.error);
}
