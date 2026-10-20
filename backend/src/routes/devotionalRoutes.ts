import { privatePhoto } from '../middleware/media.js';
import { Router } from 'express';
import {
  createDevotional,
  getFeed,
  toggleReaction,
  getLeaderDevotionals,
  submitLeaderFeedback,
  getMyFeedbacks,
} from '../controllers/devotionalController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = Router();

router.use(authenticateToken);

router.post('/', upload.single('photo'), createDevotional);
router.get('/feed', getFeed);
router.get('/:id/photo', privatePhoto);
router.get('/my-feedbacks', getMyFeedbacks);
router.post('/:devotionalId/react', toggleReaction);

// Rotas de Discipulado do Líder
router.get('/leader-reviews', requireRole('leader', 'church_admin', 'admin'), getLeaderDevotionals);
router.post('/:devotionalId/feedback', requireRole('leader', 'church_admin', 'admin'), submitLeaderFeedback);

export default router;
