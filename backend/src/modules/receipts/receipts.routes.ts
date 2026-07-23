import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { receiptsController } from './receipts.controller';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { createReceiptSchema } from './receipts.schema';

const router = Router();
router.use(authenticate);

router.get('/',
  requireRoles(UserRole.TREASURER, UserRole.COMMITTEE, UserRole.MANAGER),
  (req, res, next) => receiptsController.list(req as never, res, next));

router.post('/',
  requireRoles(UserRole.TREASURER),
  validate(createReceiptSchema),
  (req, res, next) => receiptsController.create(req as never, res, next));

router.delete('/:id',
  requireRoles(UserRole.TREASURER),
  (req, res, next) => receiptsController.remove(req as never, res, next));

export default router;
