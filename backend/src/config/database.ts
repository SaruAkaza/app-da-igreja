import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Garantir que a pasta data e uploads existam
const dataDir = path.resolve(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const uploadsDir = path.resolve(__dirname, '../../uploads/devotionals');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'igreja_devocional.db');
export const db = new Database(dbPath);

// Ativar chaves estrangeiras e modo WAL para excelente performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member', -- 'member', 'leader', 'admin'
      current_streak INTEGER NOT NULL DEFAULT 0,
      highest_streak INTEGER NOT NULL DEFAULT 0,
      last_devotional_date TEXT,
      total_points INTEGER NOT NULL DEFAULT 0,
      avatar_url TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL, -- 'biblia' ou 'livro'
      book_or_theme TEXT NOT NULL,
      cover_image TEXT,
      invite_code TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL
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
      group_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      image_url TEXT NOT NULL,
      passage_or_chapter TEXT,
      notes TEXT,
      points_awarded INTEGER NOT NULL,
      devotional_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

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

    CREATE TABLE IF NOT EXISTS quarters (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rewards (
      id TEXT PRIMARY KEY,
      quarter_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      tier TEXT NOT NULL, -- 'bronze', 'prata', 'ouro', 'especial'
      points_required INTEGER NOT NULL,
      partner_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (quarter_id) REFERENCES quarters(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_coupons (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      reward_id TEXT NOT NULL,
      coupon_code TEXT UNIQUE NOT NULL,
      qr_code_data TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active', -- 'active', 'used', 'expired'
      redeemed_at TEXT,
      redeemed_by_leader_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE CASCADE,
      FOREIGN KEY (redeemed_by_leader_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS point_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      reason TEXT NOT NULL, -- 'devotional_post', 'streak_bonus', 'admin_bonus'
      reference_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_devotionals_group ON devotionals(group_id);
    CREATE INDEX IF NOT EXISTS idx_devotionals_user ON devotionals(user_id);
    CREATE INDEX IF NOT EXISTS idx_devotionals_date ON devotionals(devotional_date);
    CREATE INDEX IF NOT EXISTS idx_coupons_user ON user_coupons(user_id);
    CREATE INDEX IF NOT EXISTS idx_coupons_code ON user_coupons(coupon_code);
  `);
  console.log('✅ Banco de dados SQLite inicializado com sucesso.');
}
