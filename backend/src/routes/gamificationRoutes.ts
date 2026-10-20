import { Router } from 'express';
import {
  getRanking,
  getGroupsRanking,
  getRewards,
  getMyCoupons,
  validateAndRedeemCoupon,
  getActiveChallenge,
  createInterChurchChallenge,
  joinInterChurchChallenge,
} from '../controllers/gamificationController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/ranking', getRanking);
router.get('/groups-ranking', getGroupsRanking);
router.get('/rewards', getRewards);
router.get('/my-coupons', getMyCoupons);
router.post('/redeem', requireRole('leader', 'church_admin', 'admin'), validateAndRedeemCoupon);

// Gincana Inter-Igrejas
router.get('/challenge', getActiveChallenge);
router.post('/challenge', requireRole('church_admin', 'admin'), createInterChurchChallenge);
router.post('/challenge/join', requireRole('church_admin', 'admin'), joinInterChurchChallenge);

export default router;
