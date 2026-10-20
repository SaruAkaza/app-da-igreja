import { Router } from 'express';
import { register, registerChurch, login, getMe } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.post('/register', register);
router.post('/register-church', registerChurch);
router.post('/login', login);
router.get('/me', authenticateToken, getMe);

export default router;
