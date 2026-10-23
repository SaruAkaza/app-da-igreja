import Database from 'better-sqlite3';
import { dataDir } from './runtime.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const uploadsDir = path.resolve(__dirname, '../../uploads/devotionals');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'igreja_devocional.db');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    -- 1. Igrejas (Multi-tenant)
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

    -- 2. Usuários vinculados à Igreja (church_id opcional no cadastro inicial)
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
      role TEXT NOT NULL DEFAULT 'member', -- 'member', 'leader', 'church_admin', 'super_admin'
      current_streak INTEGER NOT NULL DEFAULT 0,
      highest_streak INTEGER NOT NULL DEFAULT 0,
      last_devotional_date TEXT,
      total_points INTEGER NOT NULL DEFAULT 0,
      avatar_url TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE
    );

    -- 3. Grupos / Células internos da Igreja com Líder Discipulador
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      church_id TEXT NOT NULL,
      leader_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL, -- 'biblia' ou 'livro'
      book_or_theme TEXT NOT NULL,
      cover_image TEXT,
      invite_code TEXT UNIQUE NOT NULL,
      cycle_start_date TEXT,
      cycle_end_date TEXT,
      cycle_status TEXT DEFAULT 'active', -- 'active', 'completed'
      cycle_closed_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE,
      FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE SET NULL
    );

    -- 4. Membros dos Grupos
    CREATE TABLE IF NOT EXISTS group_members (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      joined_at TEXT NOT NULL,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(group_id, user_id)
    );

    -- 5. Devocionais com Fotos de Folhas Manuscritas (Privacidade Garantida)
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

    -- 6. Discipulado Pastoral: Dicas Exegéticas & Orientações Privadas do Líder
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

    -- 7. Reações Comunitárias (Celebrando a fidelidade no feed público)
    CREATE TABLE IF NOT EXISTS reactions (
      id TEXT PRIMARY KEY,
      devotional_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      reaction_type TEXT NOT NULL, -- 'amen', 'glory', 'heart'
      created_at TEXT NOT NULL,
      FOREIGN KEY (devotional_id) REFERENCES devotionals(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(devotional_id, user_id, reaction_type)
    );

    -- 8. Trimestres e Temporadas Locais da Igreja
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

    -- 9. Recompensas Locais da Igreja
    CREATE TABLE IF NOT EXISTS rewards (
      id TEXT PRIMARY KEY,
      quarter_id TEXT NOT NULL,
      church_id TEXT NOT NULL,
      group_id TEXT, -- NULL para geral da igreja, ou ID do grupo/célula
      reward_type TEXT NOT NULL DEFAULT 'points', -- 'points', 'podium'
      podium_position INTEGER, -- 1, 2 ou 3 para prêmios de pódio
      title TEXT NOT NULL,
      description TEXT,
      tier TEXT NOT NULL, -- 'bronze', 'prata', 'ouro', 'especial'
      points_required INTEGER NOT NULL,
      partner_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (quarter_id) REFERENCES quarters(id) ON DELETE CASCADE,
      FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL
    );

    -- 10. Cupons Digitais Emitidos aos Membros
    CREATE TABLE IF NOT EXISTS user_coupons (
      id TEXT PRIMARY KEY,
      church_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      reward_id TEXT NOT NULL,
      coupon_code TEXT UNIQUE NOT NULL,
      qr_code_data TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active', -- 'active', 'used', 'expired'
      redeemed_at TEXT,
      redeemed_by_leader_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE CASCADE,
      FOREIGN KEY (redeemed_by_leader_id) REFERENCES users(id)
    );

    -- 11. Histórico de Pontos
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

    -- 12. Gincanas Amistosas Inter-Igrejas por Convite Pastoral
    CREATE TABLE IF NOT EXISTS inter_church_challenges (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      created_by_church_id TEXT NOT NULL,
      invite_code TEXT UNIQUE NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active', -- 'active', 'finished'
      created_at TEXT NOT NULL,
      FOREIGN KEY (created_by_church_id) REFERENCES churches(id) ON DELETE CASCADE
    );

    -- 13. Igrejas Participantes da Gincana
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

    -- 14. Códigos Temporários de Validação em Duas Etapas (2FA) e Recuperação
    CREATE TABLE IF NOT EXISTS email_verifications (
      email TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    -- 15. Códigos e Consentimento Parental via WhatsApp para Menores (< 18 anos)
    CREATE TABLE IF NOT EXISTS parental_consents (
      parent_phone TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      child_name TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    -- Índices para Máxima Performance
    CREATE TABLE IF NOT EXISTS group_questions (
      id TEXT PRIMARY KEY,
      church_id TEXT NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
      group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      devotional_id TEXT REFERENCES devotionals(id) ON DELETE SET NULL,
      body TEXT NOT NULL,
      answer TEXT,
      answered_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      answered_at TEXT,
      answer_read_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_questions_scope ON group_questions(church_id, group_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_questions_author ON group_questions(author_id, answered_at);
    CREATE INDEX IF NOT EXISTS idx_users_church ON users(church_id);
    CREATE INDEX IF NOT EXISTS idx_groups_church ON groups(church_id);
    CREATE INDEX IF NOT EXISTS idx_devotionals_church ON devotionals(church_id);
    CREATE INDEX IF NOT EXISTS idx_devotionals_group ON devotionals(group_id);
    CREATE INDEX IF NOT EXISTS idx_devotionals_user ON devotionals(user_id);
    CREATE INDEX IF NOT EXISTS idx_devotionals_date ON devotionals(devotional_date);
    CREATE INDEX IF NOT EXISTS idx_feedbacks_devotional ON leader_feedbacks(devotional_id);
    CREATE INDEX IF NOT EXISTS idx_feedbacks_member ON leader_feedbacks(member_id);
    CREATE INDEX IF NOT EXISTS idx_coupons_church ON user_coupons(church_id);
    CREATE INDEX IF NOT EXISTS idx_coupons_code ON user_coupons(coupon_code);
  `);

  runMigrations();
  const columns = db.prepare('PRAGMA table_info(users)').all() as { name: string }[];
  if (!columns.some(c => c.name === 'session_version')) db.exec('ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0');
  db.exec('CREATE INDEX IF NOT EXISTS idx_devotional_daily ON devotionals(user_id, group_id, devotional_date)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_coupon_reward ON user_coupons(user_id, reward_id)');
  db.pragma('busy_timeout = 5000');
  console.log('✅ Banco de dados Multi-Igrejas SQLite inicializado com sucesso.');
}

function runMigrations() {
  try {
    const userColumns = db.prepare('PRAGMA table_info(users)').all() as { name: string; notnull: number }[];
    const userColNames = new Set(userColumns.map((c) => c.name));

    // Se church_id for not null, relaxar restrição
    const churchIdCol = userColumns.find((c) => c.name === 'church_id');
    if (churchIdCol && churchIdCol.notnull === 1) {
      const definition = (db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get() as { sql: string }).sql;
      const indexes = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'users' AND sql IS NOT NULL").all() as { sql: string }[];
      const relaxed = definition.replace(/church_id\s+TEXT\s+NOT\s+NULL/i, 'church_id TEXT').replace(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?["\[]?users["\]]?/i, 'CREATE TABLE users_migrating');
      if (relaxed === definition) throw new Error('Não foi possível migrar users com segurança.');
      db.pragma('foreign_keys = OFF');
      try {
        db.transaction(() => {
          db.exec(relaxed);
          db.exec('INSERT INTO users_migrating SELECT * FROM users');
          db.exec('DROP TABLE users');
          db.exec('ALTER TABLE users_migrating RENAME TO users');
          indexes.forEach(index => db.exec(index.sql));
        })();
      } finally { db.pragma('foreign_keys = ON'); }
      console.log('🔄 Tabela users migrada com church_id opcional.');
      runMigrations();
      return;
    }

    const churchColumns = db.prepare('PRAGMA table_info(churches)').all() as { name: string }[];
    const churchColNames = new Set(churchColumns.map((c) => c.name));

    const addColIfMissing = (table: string, colName: string, colDef: string, colSet: Set<string>) => {
      if (!colSet.has(colName)) {
        try {
          db.exec(`ALTER TABLE ${table} ADD COLUMN ${colName} ${colDef}`);
          console.log(`+ Coluna ${colName} adicionada em ${table}`);
        } catch (e) {
          console.warn(`Aviso ao adicionar coluna ${colName}:`, e);
        }
      }
    };

    // Novas colunas de users
    addColIfMissing('users', 'last_name', 'TEXT', userColNames);
    addColIfMissing('users', 'username_handle', 'TEXT', userColNames);
    addColIfMissing('users', 'age', 'INTEGER', userColNames);
    addColIfMissing('users', 'parent_phone', 'TEXT', userColNames);
    addColIfMissing('users', 'parent_consent_verified', 'INTEGER DEFAULT 0', userColNames);
    addColIfMissing('users', 'parent_consent_code', 'TEXT', userColNames);
    addColIfMissing('users', 'parent_consent_date', 'TEXT', userColNames);
    addColIfMissing('users', 'email_verified', 'INTEGER DEFAULT 0', userColNames);
    addColIfMissing('users', 'verification_code', 'TEXT', userColNames);
    addColIfMissing('users', 'verification_code_expires_at', 'TEXT', userColNames);
    addColIfMissing('users', 'address_street', 'TEXT', userColNames);
    addColIfMissing('users', 'address_neighborhood', 'TEXT', userColNames);
    addColIfMissing('users', 'address_city', 'TEXT', userColNames);
    addColIfMissing('users', 'address_state', 'TEXT', userColNames);
    addColIfMissing('users', 'address_zipcode', 'TEXT', userColNames);
    addColIfMissing('users', 'profile_completion_percent', 'INTEGER DEFAULT 0', userColNames);
    addColIfMissing('users', 'profile_bonus_awarded', 'INTEGER DEFAULT 0', userColNames);

    // Novas colunas de churches
    addColIfMissing('churches', 'cnpj', 'TEXT', churchColNames);
    addColIfMissing('churches', 'phone', 'TEXT', churchColNames);
    addColIfMissing('churches', 'address_full', 'TEXT', churchColNames);

    // Novas colunas de groups (Ciclo de Leitura)
    const groupColumns = db.prepare('PRAGMA table_info(groups)').all() as { name: string }[];
    const groupColNames = new Set(groupColumns.map((c) => c.name));
    addColIfMissing('groups', 'cycle_start_date', 'TEXT', groupColNames);
    addColIfMissing('groups', 'cycle_end_date', 'TEXT', groupColNames);
    addColIfMissing('groups', 'cycle_status', "TEXT DEFAULT 'active'", groupColNames);
    addColIfMissing('groups', 'cycle_closed_at', 'TEXT', groupColNames);

    // Novas colunas de rewards (Vínculo a grupo e Pódio)
    const rewardColumns = db.prepare('PRAGMA table_info(rewards)').all() as { name: string }[];
    const rewardColNames = new Set(rewardColumns.map((c) => c.name));
    addColIfMissing('rewards', 'group_id', 'TEXT', rewardColNames);
    addColIfMissing('rewards', 'reward_type', "TEXT DEFAULT 'points'", rewardColNames);
    addColIfMissing('rewards', 'podium_position', 'INTEGER', rewardColNames);

  } catch (err) { throw err; }
}
