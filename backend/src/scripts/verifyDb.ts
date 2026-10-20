import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '../../../');

const dbs = [
  path.join(root, 'backend', 'data', 'igreja_devocional.db'),
  path.join(root, '.demo-data', 'igreja_devocional.db')
];

for (const p of dbs) {
  const db = new Database(p);
  console.log('=== ' + path.basename(path.dirname(p)) + '/' + path.basename(p) + ' ===');
  console.log('Users:', db.prepare('SELECT id, name, username_handle, email, role, total_points FROM users').all());
  console.log('Churches:', db.prepare('SELECT id, name, slug_code FROM churches').all());
  console.log('Devotionals count:', db.prepare('SELECT COUNT(*) as c FROM devotionals').get());
  console.log('Groups count:', db.prepare('SELECT COUNT(*) as c FROM groups').get());
  console.log('Coupons count:', db.prepare('SELECT COUNT(*) as c FROM user_coupons').get());
  console.log('Feedbacks count:', db.prepare('SELECT COUNT(*) as c FROM leader_feedbacks').get());
  console.log('Reactions count:', db.prepare('SELECT COUNT(*) as c FROM reactions').get());
  db.close();
}
