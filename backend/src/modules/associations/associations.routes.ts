import { Router } from 'express';
import { associationsController } from './associations.controller';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { registerAssociationSchema, updateAssociationSchema } from './associations.schema';
import { UserRole } from '@prisma/client';

const router = Router();

const superUserOnly = [authenticate, requireRoles(UserRole.SUPER_USER)];

// ── Public ────────────────────────────────────────────────────────────────────
router.post('/register', validate(registerAssociationSchema), associationsController.register);

// ── SUPER_USER only ───────────────────────────────────────────────────────────
router.get('/',      ...superUserOnly, associationsController.list);
router.get('/:id',   ...superUserOnly, associationsController.getOne);
router.patch('/:id', ...superUserOnly, validate(updateAssociationSchema), associationsController.update);
router.delete('/:id',       ...superUserOnly, associationsController.remove);
router.delete('/:id/hard', ...superUserOnly, associationsController.hardDelete);

export default router;
