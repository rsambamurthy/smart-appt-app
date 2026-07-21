import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { systemController } from './system.controller';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';

const router = Router();
router.use(authenticate);

// All authenticated users can read (Layout needs it to filter nav)
router.get('/menu-config', (req, res, next) =>
  systemController.getMenuConfig(req as never, res, next));

// Only SUPER_USER can modify
router.put('/menu-config', requireRoles(UserRole.SUPER_USER), (req, res, next) =>
  systemController.saveMenuConfig(req as never, res, next));

export default router;
