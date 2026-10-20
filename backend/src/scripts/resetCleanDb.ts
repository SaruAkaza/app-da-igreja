import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '../../../');

const targetDatabases = [
  path.join(root, 'backend', 'data', 'igreja_devocional.db'),
  path.join(root, '.demo-data', 'igreja_devocional.db')
];

const targetUploadDirs = [
  path.join(root, 'backend', 'uploads', 'devotionals'),
  path.join(root, 'backend', 'data', 'uploads', 'devotionals'),
  path.join(root, '.demo-data', 'uploads', 'devotionals')
];

async function main() {
  console.log('🧹 [1/3] Limpando arquivos de fotos e uploads...');
  for (const dir of targetUploadDirs) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        try {
          if (fs.statSync(fullPath).isFile()) {
            fs.unlinkSync(fullPath);
            console.log(`   Removido: ${file}`);
          }
        } catch (e: any) {
          console.warn(`   Aviso ao remover ${file}:`, e.message);
        }
      }
    }
  }

  const now = new Date().toISOString();
  const passwordHash = await bcrypt.hash('1234', 10);

  for (const dbPath of targetDatabases) {
    console.log(`\n📦 [2/3] Processando banco de dados: ${dbPath}`);
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');

    // Inicializar tabelas completas
    db.exec(`
      CREATE TABLE IF NOT EXISTS churches (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug_code TEXT UNIQUE NOT NULL,
        city TEXT,
        state TEXT,
        denomination TEXT,
        cnpj TEXT,
        phone TEXT,
        address_full TEXT,
        logo_url TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        church_id TEXT,
        name TEXT NOT NULL,
        last_name TEXT,
        username_handle TEXT UNIQUE,
        age INTEGER,
        parent_phone TEXT,
        parent_consent_verified INTEGER DEFAULT 0,
        parent_consent_code TEXT,
        parent_consent_date TEXT,
        email TEXT UNIQUE NOT NULL,
        email_verified INTEGER DEFAULT 0,
        verification_code TEXT,
        verification_code_expires_at TEXT,
        password_hash TEXT NOT NULL,
        address_street TEXT,
        address_neighborhood TEXT,
        address_city TEXT,
        address_state TEXT,
        address_zipcode TEXT,
        profile_completion_percent INTEGER DEFAULT 0,
        profile_bonus_awarded INTEGER DEFAULT 0,
        role TEXT NOT NULL DEFAULT 'member',
        current_streak INTEGER NOT NULL DEFAULT 0,
        highest_streak INTEGER NOT NULL DEFAULT 0,
        last_devotional_date TEXT,
        total_points INTEGER NOT NULL DEFAULT 0,
        avatar_url TEXT,
        created_at TEXT NOT NULL,
        session_version INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        church_id TEXT NOT NULL,
        leader_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        book_or_theme TEXT NOT NULL,
        cover_image TEXT,
        invite_code TEXT UNIQUE NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE,
        FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS group_members (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        joined_at TEXT NOT NULL,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(group_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS devotionals (
        id TEXT PRIMARY KEY,
        church_id TEXT NOT NULL,
        group_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        image_url TEXT NOT NULL,
        passage_or_chapter TEXT,
        notes TEXT,
        points_awarded INTEGER NOT NULL,
        devotional_date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS leader_feedbacks (
        id TEXT PRIMARY KEY,
        church_id TEXT NOT NULL,
        group_id TEXT NOT NULL,
        devotional_id TEXT NOT NULL,
        leader_id TEXT NOT NULL,
        member_id TEXT NOT NULL,
        pastoral_guidance TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        FOREIGN KEY (devotional_id) REFERENCES devotionals(id) ON DELETE CASCADE,
        FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (member_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS reactions (
        id TEXT PRIMARY KEY,
        devotional_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        reaction_type TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (devotional_id) REFERENCES devotionals(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(devotional_id, user_id, reaction_type)
      );

      CREATE TABLE IF NOT EXISTS quarters (
        id TEXT PRIMARY KEY,
        church_id TEXT NOT NULL,
        title TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS rewards (
        id TEXT PRIMARY KEY,
        quarter_id TEXT NOT NULL,
        church_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        tier TEXT NOT NULL,
        points_required INTEGER NOT NULL,
        partner_name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (quarter_id) REFERENCES quarters(id) ON DELETE CASCADE,
        FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS user_coupons (
        id TEXT PRIMARY KEY,
        church_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        reward_id TEXT NOT NULL,
        coupon_code TEXT UNIQUE NOT NULL,
        qr_code_data TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        redeemed_at TEXT,
        redeemed_by_leader_id TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE CASCADE,
        FOREIGN KEY (redeemed_by_leader_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS point_history (
        id TEXT PRIMARY KEY,
        church_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        reason TEXT NOT NULL,
        reference_id TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS inter_church_challenges (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        created_by_church_id TEXT NOT NULL,
        invite_code TEXT UNIQUE NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        FOREIGN KEY (created_by_church_id) REFERENCES churches(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS challenge_participants (
        id TEXT PRIMARY KEY,
        challenge_id TEXT NOT NULL,
        church_id TEXT NOT NULL,
        total_points_earned INTEGER NOT NULL DEFAULT 0,
        active_members_count INTEGER NOT NULL DEFAULT 0,
        joined_at TEXT NOT NULL,
        FOREIGN KEY (challenge_id) REFERENCES inter_church_challenges(id) ON DELETE CASCADE,
        FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE,
        UNIQUE(challenge_id, church_id)
      );

      CREATE TABLE IF NOT EXISTS email_verifications (
        email TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        verified INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS parental_consents (
        parent_phone TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        child_name TEXT NOT NULL,
        verified INTEGER NOT NULL DEFAULT 0,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    // Garantir colunas adicionais e índices
    const userCols = db.prepare('PRAGMA table_info(users)').all() as { name: string }[];
    if (!userCols.some(c => c.name === 'session_version')) {
      db.exec('ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0');
    }

    db.pragma('foreign_keys = OFF');
    db.exec(`
      DELETE FROM reactions;
      DELETE FROM leader_feedbacks;
      DELETE FROM devotionals;
      DELETE FROM group_members;
      DELETE FROM groups;
      DELETE FROM user_coupons;
      DELETE FROM point_history;
      DELETE FROM challenge_participants;
      DELETE FROM inter_church_challenges;
      DELETE FROM rewards;
      DELETE FROM quarters;
      DELETE FROM users;
      DELETE FROM churches;
      DELETE FROM email_verifications;
      DELETE FROM parental_consents;
    `);
    db.pragma('foreign_keys = ON');

    // 1. Inserir Igreja Base
    const churchId = 'chu-central-01';
    db.prepare(`
      INSERT INTO churches (id, name, slug_code, city, state, denomination, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(churchId, 'Igreja Central', 'CENTRAL26', 'São Paulo', 'SP', 'Comunhão', now);

    // 2. Inserir Temporada Atual Ativa
    const year = new Date().getFullYear();
    db.prepare(`
      INSERT INTO quarters (id, church_id, title, start_date, end_date, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `).run('qua-2026-q1', churchId, `Temporada Geral ${year}`, `${year}-01-01`, `${year}-12-31`, now);

    // 3. Inserir Usuário Administrador
    db.prepare(`
      INSERT INTO users (
        id, church_id, name, last_name, username_handle, age, email,
        email_verified, password_hash, role, current_streak, highest_streak,
        total_points, profile_completion_percent, profile_bonus_awarded,
        created_at, session_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 'church_admin', 0, 0, 0, 100, 1, ?, 0)
    `).run(
      'usr-admin-01',
      churchId,
      'Administrador',
      'do Sistema',
      'admin',
      35,
      'admin@igreja.com',
      passwordHash,
      now
    );

    db.close();
    console.log(`   ✅ Limpeza concluída e Administrador inserido com sucesso em ${path.basename(dbPath)}!`);
  }

  console.log('\n🎉 [3/3] Processo concluído com êxito!');
  console.log('----------------------------------------------------');
  console.log('Dados do Usuário Administrador Criado:');
  console.log('• Login (Nome de Usuário): admin');
  console.log('• Login (E-mail alternativo): admin@igreja.com');
  console.log('• Senha: 1234');
  console.log('• Perfil: church_admin (Acesso total ao Painel e App)');
  console.log('• Congregação vinculada: Igreja Central (Código: CENTRAL26)');
  console.log('----------------------------------------------------\n');
}

main().catch(err => {
  console.error('❌ Erro durante a limpeza e criação do admin:', err);
  process.exit(1);
});
