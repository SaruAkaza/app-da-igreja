import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import { db, initDatabase } from './database.js';

export async function runSeed() {
  initDatabase();

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count > 0) {
    console.log('ℹ️ O banco de dados já possui dados. Pulando seed.');
    return;
  }

  console.log('🌱 Populando dados iniciais da igreja...');

  const passwordHash = await bcrypt.hash('123456', 10);
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  // 1. Usuários
  const users = [
    {
      id: 'usr-admin-01',
      name: 'Pastor Davi (Admin)',
      email: 'admin@igreja.com',
      role: 'admin',
      current_streak: 24,
      highest_streak: 24,
      last_devotional_date: today,
      total_points: 3850,
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    },
    {
      id: 'usr-leader-01',
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
      name: 'Dona Maria de Lourdes',
      email: 'maria@igreja.com',
      role: 'member',
      current_streak: 30, // Exemplo inspirador de idosa fiel
      highest_streak: 30,
      last_devotional_date: today,
      total_points: 4120, // Já atingiu Ouro!
      avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
    },
    {
      id: 'usr-joao-01',
      name: 'João Pedro (Jovens)',
      email: 'joao@igreja.com',
      role: 'member',
      current_streak: 7,
      highest_streak: 12,
      last_devotional_date: today,
      total_points: 1650, // Atingiu Bronze
      avatar_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150',
    },
    {
      id: 'usr-ana-01',
      name: 'Ana Carolina',
      email: 'ana@igreja.com',
      role: 'member',
      current_streak: 4,
      highest_streak: 9,
      last_devotional_date: today,
      total_points: 820,
      avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    },
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, current_streak, highest_streak, last_devotional_date, total_points, avatar_url, created_at)
    VALUES (@id, @name, @email, @password_hash, @role, @current_streak, @highest_streak, @last_devotional_date, @total_points, @avatar_url, @created_at)
  `);

  for (const u of users) {
    insertUser.run({
      ...u,
      password_hash: passwordHash,
      created_at: now,
    });
  }

  // 2. Grupos de Estudo
  const groups = [
    {
      id: 'grp-tiago-01',
      title: 'Devocional no Livro de Tiago',
      description: 'Estudo diário sobre fé prática, paciência nas provações e refrear a língua. Anote seus aprendizados no caderno!',
      category: 'biblia',
      book_or_theme: 'Carta de Tiago (Novo Testamento)',
      cover_image: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600',
      invite_code: 'TIAGO26',
    },
    {
      id: 'grp-ego-01',
      title: 'O Ego Transformado (Timothy Keller)',
      description: 'Leitura em comunidade do clássico sobre a verdadeira humildade cristã e o descanso do coração.',
      category: 'livro',
      book_or_theme: 'O Ego Transformado - Timothy Keller',
      cover_image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600',
      invite_code: 'EGO26',
    },
    {
      id: 'grp-pais-01',
      title: 'Paternidade Bem Resolvida',
      description: 'Pais e mães aprendendo juntos a discipular seus filhos à luz das Escrituras com notas diárias.',
      category: 'livro',
      book_or_theme: 'Família & Paternidade Cristã',
      cover_image: 'https://images.unsplash.com/photo-1476703993599-0035a21b17a9?w=600',
      invite_code: 'PAIS26',
    },
  ];

  const insertGroup = db.prepare(`
    INSERT INTO groups (id, title, description, category, book_or_theme, cover_image, invite_code, created_at)
    VALUES (@id, @title, @description, @category, @book_or_theme, @cover_image, @invite_code, @created_at)
  `);

  for (const g of groups) {
    insertGroup.run({ ...g, created_at: now });
  }

  // 3. Membros nos Grupos
  const insertMember = db.prepare(`
    INSERT INTO group_members (id, group_id, user_id, joined_at)
    VALUES (?, ?, ?, ?)
  `);

  // Vincular usuários aos grupos
  insertMember.run('gm-01', 'grp-tiago-01', 'usr-maria-01', now);
  insertMember.run('gm-02', 'grp-tiago-01', 'usr-joao-01', now);
  insertMember.run('gm-03', 'grp-tiago-01', 'usr-ana-01', now);
  insertMember.run('gm-04', 'grp-tiago-01', 'usr-leader-01', now);
  insertMember.run('gm-05', 'grp-tiago-01', 'usr-admin-01', now);

  insertMember.run('gm-06', 'grp-ego-01', 'usr-maria-01', now);
  insertMember.run('gm-07', 'grp-ego-01', 'usr-joao-01', now);
  insertMember.run('gm-08', 'grp-ego-01', 'usr-leader-01', now);

  insertMember.run('gm-09', 'grp-pais-01', 'usr-maria-01', now);
  insertMember.run('gm-10', 'grp-pais-01', 'usr-leader-01', now);
  insertMember.run('gm-11', 'grp-pais-01', 'usr-admin-01', now);

  // 4. Trimestres e Recompensas
  const quarterId = 'qtr-2026-t1';
  db.prepare(`
    INSERT INTO quarters (id, title, start_date, end_date, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(quarterId, '1º Trimestre 2026 - O Hábito da Palavra', '2026-01-01', '2026-03-31', 1, now);

  const rewards = [
    {
      id: 'rew-bronze-01',
      quarter_id: quarterId,
      title: '🥉 15% de Desconto na Livraria da Igreja',
      description: 'Válido para qualquer devocional, bíblia ou livro na livraria da comunidade.',
      tier: 'bronze',
      points_required: 1500,
      partner_name: 'Livraria Videira',
    },
    {
      id: 'rew-prata-01',
      quarter_id: quarterId,
      title: '🥈 R$ 20,00 na Camisa da Conferência 2026',
      description: 'Desconto direto na aquisição da camiseta oficial do congresso da juventude e família.',
      tier: 'prata',
      points_required: 2800,
      partner_name: 'Secretaria da Igreja',
    },
    {
      id: 'rew-ouro-01',
      quarter_id: quarterId,
      title: '🥇 Almoço Gratuito no Restaurante Parceiro + Livro do Mês',
      description: 'Voucher individual completo para confraternização no Restaurante do Pão com sobremesa inclusa.',
      tier: 'ouro',
      points_required: 4000,
      partner_name: 'Restaurante do Pão & Livraria',
    },
  ];

  const insertReward = db.prepare(`
    INSERT INTO rewards (id, quarter_id, title, description, tier, points_required, partner_name, created_at)
    VALUES (@id, @quarter_id, @title, @description, @tier, @points_required, @partner_name, @created_at)
  `);

  for (const r of rewards) {
    insertReward.run({ ...r, created_at: now });
  }

  // 5. Devocionais de Demonstração (com fotos de anotações reais)
  const devotionals = [
    {
      id: 'dev-01',
      group_id: 'grp-tiago-01',
      user_id: 'usr-maria-01',
      image_url: 'https://images.unsplash.com/photo-1517842645767-c639042777db?w=800', // Foto de caderno com caneta
      passage_or_chapter: 'Tiago 1:2-5',
      notes: 'Meus irmãos, considerem motivo de grande alegria o fato de passarem por diversas provações. A oração pela sabedoria.',
      points_awarded: 60,
      devotional_date: today,
    },
    {
      id: 'dev-02',
      group_id: 'grp-tiago-01',
      user_id: 'usr-joao-01',
      image_url: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800',
      passage_or_chapter: 'Tiago 1:19-22',
      notes: 'Sejam praticantes da palavra, e não apenas ouvintes, enganando a si mesmos. Escrevi no caderno para não esquecer.',
      points_awarded: 60,
      devotional_date: today,
    },
    {
      id: 'dev-03',
      group_id: 'grp-ego-01',
      user_id: 'usr-maria-01',
      image_url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=800',
      passage_or_chapter: 'Capítulo 1 - A Condição Humana',
      notes: 'A verdadeira humildade bíblica não é pensar menos de si mesmo, mas pensar menos em si mesmo.',
      points_awarded: 60,
      devotional_date: today,
    },
    {
      id: 'dev-04',
      group_id: 'grp-pais-01',
      user_id: 'usr-leader-01',
      image_url: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=800',
      passage_or_chapter: 'Deuteronômio 6:6-9',
      notes: 'Gravem estas minhas palavras no coração e na mente; ensinem-nas aos seus filhos ao sentar e ao andar pelo caminho.',
      points_awarded: 60,
      devotional_date: today,
    },
  ];

  const insertDevotional = db.prepare(`
    INSERT INTO devotionals (id, group_id, user_id, image_url, passage_or_chapter, notes, points_awarded, devotional_date, created_at)
    VALUES (@id, @group_id, @user_id, @image_url, @passage_or_chapter, @notes, @points_awarded, @devotional_date, @created_at)
  `);

  for (const d of devotionals) {
    insertDevotional.run({ ...d, created_at: now });
  }

  // 6. Reações iniciais nos devocionais
  const insertReaction = db.prepare(`
    INSERT INTO reactions (id, devotional_id, user_id, reaction_type, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertReaction.run('reac-01', 'dev-01', 'usr-joao-01', 'amen', now);
  insertReaction.run('reac-02', 'dev-01', 'usr-leader-01', 'glory', now);
  insertReaction.run('reac-03', 'dev-01', 'usr-ana-01', 'heart', now);
  insertReaction.run('reac-04', 'dev-02', 'usr-maria-01', 'amen', now);

  // 7. Cupons gerados para Maria (que já atingiu Ouro) e João (Bronze)
  const mariaCouponCode = 'CUPOM-OURO-MARIA2026';
  const mariaQrData = await QRCode.toDataURL(mariaCouponCode);

  const joaoCouponCode = 'CUPOM-BRONZE-JOAO2026';
  const joaoQrData = await QRCode.toDataURL(joaoCouponCode);

  const insertCoupon = db.prepare(`
    INSERT INTO user_coupons (id, user_id, reward_id, coupon_code, qr_code_data, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertCoupon.run('cp-01', 'usr-maria-01', 'rew-ouro-01', mariaCouponCode, mariaQrData, 'active', now);
  insertCoupon.run('cp-02', 'usr-joao-01', 'rew-bronze-01', joaoCouponCode, joaoQrData, 'active', now);

  console.log('✅ Seed executado com sucesso! Usuários, grupos, trimestres e cupons criados.');
}

if (process.argv[1]?.endsWith('seed.ts')) {
  runSeed().catch(console.error);
}
