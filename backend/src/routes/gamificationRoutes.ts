import { Router } from 'express';
import { getRanking, getRewards, getMyCoupons, validateAndRedeemCoupon } from '../controllers/gamificationController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/ranking', getRanking);
router.get('/rewards', getRewards);
router.get('/my-coupons', getMyCoupons);
router.post('/redeem', requireRole('leader', 'admin'), validateAndRedeemCoupon);

export default router;
