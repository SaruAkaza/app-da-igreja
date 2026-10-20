import { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../config/database.js';
import { backendRoot, uploadsDir } from '../config/runtime.js';
export function privatePhoto(req: Request, res: Response) {
  const post = db.prepare('SELECT d.*, g.leader_id FROM devotionals d JOIN groups g ON g.id = d.group_id WHERE d.id = ? AND d.church_id = ?').get(req.params.id, req.user!.church_id) as any;
  if (!post) return res.status(404).json({ error: 'Foto não encontrada.' });
  const user = req.user!;
  if (post.user_id !== user.id && post.leader_id !== user.id && !['church_admin', 'super_admin'].includes(user.role)) return res.status(403).json({ error: 'Esta anotação é privada.' });
  const filename = path.basename(post.image_url);
  if (!post.image_url.startsWith('/uploads/devotionals/')) return res.status(404).json({ error: 'Esta foto de demonstração não está armazenada no servidor.' });
  const file = [path.join(uploadsDir, filename), path.join(backendRoot, 'uploads/devotionals', filename)].find(p => fs.existsSync(p));
  if (!file) return res.status(404).json({ error: 'Arquivo da foto não encontrado.' });
  res.setHeader('Cache-Control', 'private, no-store');
  res.sendFile(file);
}
