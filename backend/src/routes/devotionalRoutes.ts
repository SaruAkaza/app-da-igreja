import { Router } from 'express';
import { createDevotional, getFeed, toggleReaction } from '../controllers/devotionalController.js';
import { authenticateToken } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = Router();

router.use(authenticateToken);

router.post('/', upload.single('photo'), createDevotional);
router.get('/feed', getFeed);
router.post('/:devotionalId/react', toggleReaction);

export default router;
