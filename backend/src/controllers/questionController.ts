import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../config/database.js';
import { accessibleGroup, isChurchAdmin, managesGroup } from '../services/groupAccess.js';

const selection = `SELECT q.*, g.title AS group_title, g.leader_id, u.name AS author_name,
  responder.name AS answered_by_name, d.passage_or_chapter,
  CASE WHEN d.id IS NOT NULL THEN '/api/devotionals/' || d.id || '/photo' END AS image_url
  FROM group_questions q JOIN groups g ON g.id = q.group_id AND g.church_id = q.church_id
  JOIN users u ON u.id = q.author_id LEFT JOIN users responder ON responder.id = q.answered_by
  LEFT JOIN devotionals d ON d.id = q.devotional_id AND d.church_id = q.church_id AND d.group_id = q.group_id`;

function visibleQuestion(id: string, req: Request) {
  const q = db.prepare(selection + ' WHERE q.id = ? AND q.church_id = ?').get(id, req.user!.church_id) as any;
  return q && (q.author_id === req.user!.id || managesGroup(req.user!, q)) ? q : null;
}
function present(q: any, req: Request) {
  return { ...q, status: q.answer ? 'answered' : 'open', can_answer: managesGroup(req.user!, q) && !q.answer,
    unread: q.author_id === req.user!.id && !!q.answer && !q.answer_read_at };
}
export function listQuestions(req: Request, res: Response) {
  const user = req.user!, groupId = req.query.groupId;
  if (groupId !== undefined && !accessibleGroup(groupId, user)) return res.status(404).json({ error: 'Grupo não encontrado entre seus acessos.' });
  const page = Number(req.query.page || 1);
  if (!Number.isInteger(page) || page < 1) return res.status(400).json({ error: 'Página inválida.' });
  const params: any[] = [user.church_id];
  let filter = ' WHERE q.church_id = ?';
  if (!isChurchAdmin(user)) { filter += ' AND (q.author_id = ? OR (? = \'leader\' AND g.leader_id = ?))'; params.push(user.id, user.role, user.id); }
  if (groupId) { filter += ' AND q.group_id = ?'; params.push(groupId); }
  if (req.query.status === 'open') filter += ' AND q.answer IS NULL';
  if (req.query.status === 'answered') filter += ' AND q.answer IS NOT NULL';
  params.push((page - 1) * 50);
  return res.json(db.prepare(selection + filter + ' ORDER BY q.created_at DESC, q.id DESC LIMIT 50 OFFSET ?').all(...params).map(q => present(q, req)));
}
export function createQuestion(req: Request, res: Response) {
  const { groupId, body, devotionalId } = req.body;
  const group = accessibleGroup(groupId, req.user!);
  if (!group) return res.status(404).json({ error: 'Entre em um grupo da sua igreja para enviar uma dúvida.' });
  if (typeof body !== 'string' || body.trim().length < 5 || body.length > 3000) return res.status(400).json({ error: 'Escreva sua dúvida com 5 a 3.000 caracteres.' });
  if (devotionalId && !db.prepare('SELECT id FROM devotionals WHERE id = ? AND church_id = ? AND group_id = ? AND user_id = ?').get(devotionalId, req.user!.church_id, groupId, req.user!.id))
    return res.status(404).json({ error: 'Selecione uma leitura sua deste grupo para vincular à dúvida.' });
  const id = 'question-' + crypto.randomUUID();
  db.prepare(`INSERT INTO group_questions (id, church_id, group_id, author_id, devotional_id, body, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, req.user!.church_id, groupId, req.user!.id, devotionalId || null, body.trim(), new Date().toISOString());
  return res.status(201).json(present(visibleQuestion(id, req), req));
}
export function getQuestion(req: Request, res: Response) {
  const question = visibleQuestion(req.params.id, req);
  return question ? res.json(present(question, req)) : res.status(404).json({ error: 'Dúvida não encontrada entre seus acessos.' });
}
export function answerQuestion(req: Request, res: Response) {
  const question = visibleQuestion(req.params.id, req);
  if (!question) return res.status(404).json({ error: 'Dúvida não encontrada entre seus acessos.' });
  if (!managesGroup(req.user!, question)) return res.status(403).json({ error: 'Somente a liderança responsável pode responder.' });
  const { answer } = req.body;
  if (typeof answer !== 'string' || answer.trim().length < 5 || answer.length > 5000) return res.status(400).json({ error: 'Escreva uma resposta com 5 a 5.000 caracteres.' });
  const result = db.prepare('UPDATE group_questions SET answer = ?, answered_by = ?, answered_at = ? WHERE id = ? AND answer IS NULL')
    .run(answer.trim(), req.user!.id, new Date().toISOString(), question.id);
  if (!result.changes) return res.status(409).json({ error: 'Esta dúvida já foi respondida. Atualize a conversa.' });
  return res.json(present(visibleQuestion(question.id, req), req));
}
export function markQuestionRead(req: Request, res: Response) {
  const result = db.prepare('UPDATE group_questions SET answer_read_at = ? WHERE id = ? AND church_id = ? AND author_id = ? AND answer IS NOT NULL')
    .run(new Date().toISOString(), req.params.id, req.user!.church_id, req.user!.id);
  return result.changes ? res.json({ message: 'Resposta marcada como lida.' }) : res.status(404).json({ error: 'Resposta não encontrada.' });
}
