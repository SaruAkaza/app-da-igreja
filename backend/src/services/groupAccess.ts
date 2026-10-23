import { db } from '../config/database.js';
import type { AuthUser } from '../middleware/auth.js';

export const isChurchAdmin = (user: AuthUser) => ['church_admin', 'super_admin'].includes(user.role);
export const managesGroup = (user: AuthUser, group: { church_id: string; leader_id: string | null }) =>
  user.church_id === group.church_id && (isChurchAdmin(user) || (user.role === 'leader' && group.leader_id === user.id));

export function accessibleGroup(id: unknown, user: AuthUser) {
  if (typeof id !== 'string' || !user.church_id) return null;
  const group = db.prepare(`SELECT g.*, EXISTS(SELECT 1 FROM group_members gm WHERE gm.group_id = g.id AND gm.user_id = ?) AS is_member
    FROM groups g WHERE g.id = ? AND g.church_id = ?`).get(user.id, id, user.church_id) as any;
  return group && (group.is_member || managesGroup(user, group)) ? group : null;
}

// A classificação do grupo usa somente as leituras deste grupo no seu ciclo.
export const groupScoreSql = (user = 'u.id', group = 'g.id') => `(SELECT COALESCE(SUM(ds.points_awarded),0) FROM devotionals ds
  JOIN groups gs ON gs.id = ds.group_id WHERE ds.user_id = ${user} AND ds.group_id = ${group}
  AND ds.church_id = gs.church_id AND ds.devotional_date >= COALESCE(gs.cycle_start_date,'0000-01-01')
  AND ds.devotional_date <= COALESCE(gs.cycle_end_date,'9999-12-31'))`;
