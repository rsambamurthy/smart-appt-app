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

// ── Mobile Config ─────────────────────────────────────────────────────────────
// Any authenticated user can read their own association's config (mobile app)
router.get('/mobile-config', (req, res, next) =>
  systemController.getMyMobileConfig(req as never, res, next));

// SUPER_USER can read/write any association's mobile config (admin)
router.get('/mobile-config/:associationId', requireRoles(UserRole.SUPER_USER), (req, res, next) =>
  systemController.getMobileConfigById(req as never, res, next));

router.put('/mobile-config/:associationId', requireRoles(UserRole.SUPER_USER), (req, res, next) =>
  systemController.saveMobileConfig(req as never, res, next));

export default router;
