import { Router } from 'express';
import {
  register,
  registerChurch,
  login,
  getMe,
  requestCode,
  verifyCode,
  sendParentalConsent,
  verifyParentalConsent,
  forgotPassword,
  resetPassword,
  updateProfile,
  joinChurchByCode,
  getBattleStatus,
} from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// 2FA Email & Consentimento Parental
router.post('/request-code', requestCode);
router.post('/verify-code', verifyCode);
router.post('/parental-consent/send', sendParentalConsent);
router.post('/parental-consent/verify', verifyParentalConsent);

// Recuperação de Senha
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Registro de Usuário e de Igreja
router.post('/register', register);
router.post('/complete-registration', register);
router.post('/register-church', registerChurch);

// Login
router.post('/login', login);

// Rotas Autenticadas
router.get('/me', authenticateToken, getMe);
router.post('/update-profile', authenticateToken, updateProfile);
router.post('/join-church', authenticateToken, joinChurchByCode);
router.get('/battle-status', authenticateToken, getBattleStatus);

export default router;
