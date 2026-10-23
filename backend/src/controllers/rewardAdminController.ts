import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../config/database.js';
import { localDay } from '../config/runtime.js';

export function createReward(req: Request, res: Response) {
  const { title, description, tier, pointsRequired, partnerName, groupId, rewardType, podiumPosition } = req.body;
  const churchId = req.user!.church_id;

  if (!churchId || typeof title !== 'string' || title.trim().length < 3 || title.length > 150 || !['bronze','prata','ouro','especial'].includes(tier) || typeof partnerName !== 'string' || !partnerName.trim()) {
    return res.status(400).json({ error: 'Confira título, nível e local de retirada.' });
  }

  const type = rewardType === 'podium' ? 'podium' : 'points';
  let pos: number | null = null;
  let pts = Number(pointsRequired) || 0;
  let targetGroupId: string | null = (groupId && typeof groupId === 'string' && groupId.trim()) ? groupId.trim() : null;

  if (type === 'podium') {
    pos = Number(podiumPosition);
    if (![1, 2, 3].includes(pos)) {
      return res.status(400).json({ error: 'Para prêmios de pódio, selecione a colocação (1º, 2º ou 3º lugar).' });
    }
    if (!targetGroupId) {
      return res.status(400).json({ error: 'Prêmios de pódio devem ser vinculados a um grupo ou célula de leitura.' });
    }
    pts = 0;
  } else {
    if (!Number.isSafeInteger(pts) || pts < 1 || pts > 1000000) {
      return res.status(400).json({ error: 'Pontos necessários devem ser um número positivo entre 1 e 1.000.000.' });
    }
  }

  if (targetGroupId) {
    const groupExists = db.prepare('SELECT id, cycle_status FROM groups WHERE id = ? AND church_id = ?').get(targetGroupId, churchId) as any;
    if (!groupExists) {
      return res.status(400).json({ error: 'Grupo selecionado não pertence a esta igreja.' });
    }
    if (type === 'podium' && groupExists.cycle_status === 'completed') return res.status(409).json({ error: 'Este ciclo já foi premiado. Cadastre o pódio antes de encerrar o grupo.' });
  }

  const today = localDay(), now = new Date().toISOString();
  const result = db.transaction(() => {
    let quarter = db.prepare('SELECT id FROM quarters WHERE church_id = ? AND is_active = 1 AND start_date <= ? AND end_date >= ?').get(churchId, today, today) as any;
    if (!quarter) {
      const year = Number(today.slice(0, 4));
      const month = Number(today.slice(5, 7));
      const quarterIndex = Math.floor((month - 1) / 3);
      const start = `${year}-${String(quarterIndex * 3 + 1).padStart(2, '0')}-01`;
      const end = new Date(Date.UTC(year, quarterIndex * 3 + 3, 0)).toISOString().slice(0, 10);
      quarter = { id: 'qtr-' + crypto.randomUUID() };
      db.prepare('INSERT INTO quarters (id,church_id,title,start_date,end_date,is_active,created_at) VALUES (?,?,?,?,?,1,?)').run(quarter.id, churchId, `${quarterIndex + 1}º trimestre de ${year}`, start, end, now);
    }

    const id = 'rew-' + crypto.randomUUID();
    db.prepare(`
      INSERT INTO rewards (id, quarter_id, church_id, group_id, reward_type, podium_position, title, description, tier, points_required, partner_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, quarter.id, churchId, targetGroupId, type, pos, title.trim(), description || '', tier, pts, partnerName.trim(), now);

    return { id, group_id: targetGroupId, reward_type: type, podium_position: pos };
  })();

  return res.status(201).json({ message: 'Prêmio cadastrado com sucesso.', reward: result });
}

export function updateReward(req: Request, res: Response) {
  const { id } = req.params;
  const { title, description, tier, pointsRequired, partnerName, groupId, rewardType, podiumPosition } = req.body;
  const churchId = req.user!.church_id;

  if (!id) return res.status(400).json({ error: 'ID do prêmio não informado.' });
  if (!churchId || typeof title !== 'string' || title.trim().length < 3 || title.length > 150 || !['bronze','prata','ouro','especial'].includes(tier) || typeof partnerName !== 'string' || !partnerName.trim()) {
    return res.status(400).json({ error: 'Confira título, nível e local de retirada.' });
  }

  const reward = db.prepare('SELECT id, group_id, reward_type FROM rewards WHERE id = ? AND church_id = ?').get(id, churchId) as any;
  if (!reward) return res.status(404).json({ error: 'Prêmio não encontrado.' });

  const type = rewardType === 'podium' ? 'podium' : 'points';
  let pos: number | null = null;
  let pts = Number(pointsRequired) || 0;
  let targetGroupId: string | null = (groupId && typeof groupId === 'string' && groupId.trim()) ? groupId.trim() : null;

  if ((targetGroupId !== reward.group_id || type !== reward.reward_type) && db.prepare('SELECT id FROM user_coupons WHERE reward_id = ? LIMIT 1').get(id)) return res.status(409).json({ error: 'Prêmios com cupons emitidos não podem mudar de grupo ou modalidade.' });

  if (type === 'podium') {
    pos = Number(podiumPosition);
    if (![1, 2, 3].includes(pos)) {
      return res.status(400).json({ error: 'Para prêmios de pódio, selecione a colocação (1º, 2º ou 3º lugar).' });
    }
    if (!targetGroupId) {
      return res.status(400).json({ error: 'Prêmios de pódio devem ser vinculados a um grupo ou célula de leitura.' });
    }
    pts = 0;
  } else {
    if (!Number.isSafeInteger(pts) || pts < 1 || pts > 1000000) {
      return res.status(400).json({ error: 'Pontos necessários devem ser um número positivo entre 1 e 1.000.000.' });
    }
  }

  if (targetGroupId) {
    const groupExists = db.prepare('SELECT id FROM groups WHERE id = ? AND church_id = ?').get(targetGroupId, churchId);
    if (!groupExists) {
      return res.status(400).json({ error: 'Grupo selecionado não pertence a esta igreja.' });
    }
  }

  db.prepare(`
    UPDATE rewards SET
      title = ?,
      description = ?,
      tier = ?,
      points_required = ?,
      partner_name = ?,
      group_id = ?,
      reward_type = ?,
      podium_position = ?
    WHERE id = ? AND church_id = ?
  `).run(title.trim(), description || '', tier, pts, partnerName.trim(), targetGroupId, type, pos, id, churchId);

  return res.json({ message: 'Prêmio atualizado com sucesso.' });
}

export function deleteReward(req: Request, res: Response) {
  const { id } = req.params;
  const churchId = req.user!.church_id;
  if (!id) return res.status(400).json({ error: 'ID do prêmio não informado.' });

  const reward = db.prepare('SELECT id FROM rewards WHERE id = ? AND church_id = ?').get(id, churchId);
  if (!reward) return res.status(404).json({ error: 'Prêmio não encontrado.' });

  db.prepare('DELETE FROM rewards WHERE id = ? AND church_id = ?').run(id, churchId);
  return res.json({ message: 'Prêmio excluído com sucesso.' });
}
