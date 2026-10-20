import { createReward, updateReward, deleteReward } from '../controllers/rewardAdminController.js';
import { Router } from 'express';
import {
  getDashboardStats,
  listMembers,
  awardBonusPoints,
  deleteDevotional,
  updateUserRole,
  getChurchDetails,
  updateChurchDetails,
  unlinkMember,
} from '../controllers/adminController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);
router.use(requireRole('church_admin', 'admin'));

router.get('/church', getChurchDetails);
router.patch('/church', updateChurchDetails);
router.get('/stats', getDashboardStats);
router.get('/members', listMembers);
router.delete('/members/:userId', unlinkMember);
router.post('/bonus', requireRole('church_admin', 'admin'), awardBonusPoints);
router.delete('/devotionals/:id', requireRole('church_admin', 'admin'), deleteDevotional);
router.patch('/users/role', requireRole('church_admin', 'admin'), updateUserRole);

router.post('/rewards', createReward);
router.patch('/rewards/:id', updateReward);
router.delete('/rewards/:id', deleteReward);

export default router;
