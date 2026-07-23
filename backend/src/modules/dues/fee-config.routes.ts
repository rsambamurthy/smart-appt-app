import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { UserRole } from '@prisma/client';
import { feeConfigController } from './fee-config.controller';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requireRoles(UserRole.TREASURER, UserRole.COMMITTEE, UserRole.MANAGER),
  (req, res, next) => feeConfigController.list(req as never, res, next),
);

router.put(
  '/',
  requireRoles(UserRole.TREASURER),
  (req, res, next) => feeConfigController.save(req as never, res, next),
);

router.delete(
  '/:id',
  requireRoles(UserRole.TREASURER),
  (req, res, next) => feeConfigController.remove(req as never, res, next),
);

export default router;
