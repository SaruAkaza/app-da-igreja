import { Router } from 'express';
import { getDashboardStats, listMembers, awardBonusPoints, deleteDevotional, updateUserRole } from '../controllers/adminController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);
router.use(requireRole('admin', 'leader'));

router.get('/stats', getDashboardStats);
router.get('/members', listMembers);
router.post('/bonus', requireRole('admin'), awardBonusPoints);
router.delete('/devotionals/:id', requireRole('admin'), deleteDevotional);
router.patch('/users/role', requireRole('admin'), updateUserRole);

export default router;
