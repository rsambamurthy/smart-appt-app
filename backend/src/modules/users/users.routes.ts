import { Router } from 'express';
import { usersController } from './users.controller';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { UserRole } from '@prisma/client';
import {
  createUnitSchema, updateUnitSchema,
  createUserSchema, updateUserSchema, inviteUserSchema, paginationSchema,
} from './users.schema';

const router = Router();
router.use(authenticate);

// ── Units ─────────────────────────────────────────────────────────────────────
router.get('/units', requireRoles(UserRole.MANAGER, UserRole.COMMITTEE, UserRole.TREASURER), (req, res, next) =>
  usersController.listUnits(req as never, res, next));

router.post('/units', requireRoles(UserRole.MANAGER), validate(createUnitSchema), (req, res, next) =>
  usersController.createUnit(req as never, res, next));

router.patch('/units/:unitId', requireRoles(UserRole.MANAGER), validate(updateUnitSchema), (req, res, next) =>
  usersController.updateUnit(req as never, res, next));

router.delete('/units/:unitId', requireRoles(UserRole.MANAGER), (req, res, next) =>
  usersController.deleteUnit(req as never, res, next));

// ── Users ─────────────────────────────────────────────────────────────────────
router.get('/', requireRoles(UserRole.MANAGER), validate(paginationSchema, 'query'), (req, res, next) =>
  usersController.listUsers(req as never, res, next));

router.get('/:userId', requireRoles(UserRole.MANAGER), (req, res, next) =>
  usersController.getUser(req as never, res, next));

router.post('/', requireRoles(UserRole.MANAGER), validate(createUserSchema), (req, res, next) =>
  usersController.createUser(req as never, res, next));

router.patch('/:userId', requireRoles(UserRole.MANAGER), validate(updateUserSchema), (req, res, next) =>
  usersController.updateUser(req as never, res, next));

router.delete('/:userId', requireRoles(UserRole.MANAGER), (req, res, next) =>
  usersController.deactivateUser(req as never, res, next));

// ── Invitations ───────────────────────────────────────────────────────────────
router.post('/invites', requireRoles(UserRole.MANAGER), validate(inviteUserSchema), (req, res, next) =>
  usersController.inviteUser(req as never, res, next));

// ── Bulk import ───────────────────────────────────────────────────────────────
router.post('/bulk-import', requireRoles(UserRole.MANAGER), (req, res, next) =>
  usersController.bulkImport(req as never, res, next));

router.post('/units/bulk-import', requireRoles(UserRole.MANAGER), (req, res, next) =>
  usersController.bulkImportUnits(req as never, res, next));

export default router;
