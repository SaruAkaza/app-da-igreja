import crypto from 'node:crypto';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import type Database from 'better-sqlite3';
import { localDay } from '../config/runtime.js';

// PNG de 1024 px do próprio projeto: exercita upload, entrega e exibição reais.
export const testPhoto = fs.readFileSync(new URL('../../../mobile/assets/icon.png', import.meta.url));
export function platformFixture(db: Database.Database, label = 'API') {
  const stamp = crypto.randomBytes(5).toString('hex'), now = new Date().toISOString(), today = localDay();
  const churches = { a: 'church-a-' + stamp, b: 'church-b-' + stamp };
  const group = 'group-' + stamp, privateGroup = 'private-' + stamp, foreignGroup = 'foreign-' + stamp;
  const password = 'ExperienciaSegura1!';
  const hash = bcrypt.hashSync(password, 10);
  const users: Record<string, { id: string; email: string; name: string }> = {};
  db.transaction(() => {
    for (const [key, id] of Object.entries(churches)) db.prepare('INSERT INTO churches (id,name,slug_code,created_at) VALUES (?,?,?,?)').run(id, (key === 'a' ? 'Igreja Conexão ' : 'Outra Igreja ') + label, key.toUpperCase() + stamp, now);
    for (const [name, role, church] of [['admin', 'church_admin', churches.a], ['leader', 'leader', churches.a], ['member', 'member', churches.a], ['peer', 'member', churches.a], ['unrelated', 'leader', churches.a], ['foreign', 'church_admin', churches.b], ['outside', 'member', null]]) {
      const id = name + '-' + stamp, email = name + '.' + stamp + '@comunhao.example';
      users[name!] = { id, email, name: name === 'member' ? 'Pessoa ' + label : name === 'leader' ? 'Liderança ' + label : name + ' ' + label };
      db.prepare('INSERT INTO users (id,church_id,name,email,email_verified,password_hash,role,age,created_at) VALUES (?,?,?,?,1,?,?,30,?)').run(id, church, users[name!].name, email, hash, role, now);
    }
    for (const [id, church, title, leader] of [[group, churches.a, 'Conexão ' + label, users.leader!.id], [privateGroup, churches.a, 'Outro grupo ' + label, users.unrelated!.id], [foreignGroup, churches.b, 'Grupo de outra igreja ' + label, users.foreign!.id]]) {
      db.prepare(`INSERT INTO groups (id,church_id,title,category,book_or_theme,leader_id,invite_code,cycle_start_date,cycle_end_date,created_at) VALUES (?,?,?,'biblia','Salmos e a vida em comunidade',?,?,?,'2099-12-31',?)`).run(id, church, title, leader, id.toUpperCase(), today, now);
    }
    for (const key of ['admin', 'leader', 'member', 'peer']) db.prepare('INSERT INTO group_members (id,group_id,user_id,joined_at) VALUES (?,?,?,?)').run(crypto.randomUUID(), group, users[key]!.id, now);
    db.prepare('INSERT INTO group_members (id,group_id,user_id,joined_at) VALUES (?,?,?,?)').run(crypto.randomUUID(), privateGroup, users.unrelated!.id, now);
    db.prepare('INSERT INTO group_members (id,group_id,user_id,joined_at) VALUES (?,?,?,?)').run(crypto.randomUUID(), foreignGroup, users.foreign!.id, now);
  })();
  return { churches, group, privateGroup, foreignGroup, users, password, invite: group.toUpperCase(), churchCode: 'A' + stamp };
}
