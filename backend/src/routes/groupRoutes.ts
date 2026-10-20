import { Router } from 'express';
import {
  listGroups,
  myGroups,
  getGroupDetails,
  joinGroup,
  leaveGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  listGroupMembers,
  addGroupMember,
  removeGroupMember,
  getGroupCycleDetails,
  closeGroupCycleEndpoint,
} from '../controllers/groupController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/', listGroups);
router.get('/my', myGroups);
router.get('/:id', getGroupDetails);
router.get('/:id/cycle', getGroupCycleDetails);
router.post('/:id/close-cycle', requireRole('leader', 'church_admin', 'admin'), closeGroupCycleEndpoint);
router.post('/join', joinGroup);
router.post('/:id/leave', leaveGroup);
router.post('/', requireRole('leader', 'church_admin', 'admin'), createGroup);
router.patch('/:id', requireRole('leader', 'church_admin', 'admin'), updateGroup);
router.delete('/:id', requireRole('church_admin', 'admin'), deleteGroup);
router.get('/:id/members', listGroupMembers);
router.post('/:id/members', requireRole('leader', 'church_admin', 'admin'), addGroupMember);
router.delete('/:id/members/:userId', requireRole('leader', 'church_admin', 'admin'), removeGroupMember);

export default router;
