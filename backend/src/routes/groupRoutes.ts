import { Router } from 'express';
import { listGroups, myGroups, getGroupDetails, joinGroup, leaveGroup, createGroup } from '../controllers/groupController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/', listGroups);
router.get('/my', myGroups);
router.get('/:id', getGroupDetails);
router.post('/join', joinGroup);
router.post('/:id/leave', leaveGroup);
router.post('/', requireRole('leader', 'admin'), createGroup);

export default router;
