import { Router } from 'express';
import {
  getDashboardStats,
  listMembers,
  awardBonusPoints,
  deleteDevotional,
  updateUserRole,
} from '../controllers/adminController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);
router.use(requireRole('church_admin', 'leader', 'admin'));

router.get('/stats', getDashboardStats);
router.get('/members', listMembers);
router.post('/bonus', requireRole('church_admin', 'admin'), awardBonusPoints);
router.delete('/devotionals/:id', requireRole('church_admin', 'admin'), deleteDevotional);
router.patch('/users/role', requireRole('church_admin', 'admin'), updateUserRole);

export default router;
