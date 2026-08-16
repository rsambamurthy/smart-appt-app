import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { systemController } from './system.controller';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';

const router = Router();
router.use(authenticate);

// All authenticated users can read (Layout needs it to filter nav)
// Every authenticated user reads their own association's web menu — Layout
// cannot draw the sidebar without it.
router.get('/menu-config', (req, res, next) =>
  systemController.getMenuConfig(req as never, res, next));

// Configuring it is manager-and-up. The association a manager may touch is
// their own, enforced in scopeAssociation rather than by the route, because
// the id in the URL is a hint and never an authority.
router.get('/menu-config/:associationId', requireRoles(UserRole.SUPER_USER, UserRole.MANAGER), (req, res, next) =>
  systemController.getMenuConfigById(req as never, res, next));

router.put('/menu-config/:associationId', requireRoles(UserRole.SUPER_USER, UserRole.MANAGER), (req, res, next) =>
  systemController.saveMenuConfig(req as never, res, next));

// Only SUPER_USER can modify


// ── Mobile Config ─────────────────────────────────────────────────────────────
// Any authenticated user can read their own association's config (mobile app)
router.get('/mobile-config', (req, res, next) =>
  systemController.getMyMobileConfig(req as never, res, next));

// SUPER_USER can read/write any association's mobile config (admin).
// MANAGER can read/write their own — scoped in the controller via
// scopeAssociation, same as menu-config and mobile-menu above. A manager's
// write is further narrowed to branding fields only (see saveMobileConfig):
// this route is how the Branding screen reaches the API, and a manager only
// gets to use it at all once a super user grants that screen via Web Menu by
// Role — the menu item defaults to SUPER_USER-only.
router.get('/mobile-config/:associationId', requireRoles(UserRole.SUPER_USER, UserRole.MANAGER), (req, res, next) =>
  systemController.getMobileConfigById(req as never, res, next));

router.put('/mobile-config/:associationId', requireRoles(UserRole.SUPER_USER, UserRole.MANAGER), (req, res, next) =>
  systemController.saveMobileConfig(req as never, res, next));

// Role-by-role mobile menu. Kept on its own path rather than folded into
// mobile-config: the matrix is large, the rest of the config is small, and the
// app never needs the matrix at all.
router.get('/mobile-menu/:associationId', requireRoles(UserRole.SUPER_USER, UserRole.MANAGER), (req, res, next) =>
  systemController.getMobileMenuMatrix(req as never, res, next));

router.put('/mobile-menu/:associationId', requireRoles(UserRole.SUPER_USER, UserRole.MANAGER), (req, res, next) =>
  systemController.saveMobileMenu(req as never, res, next));

// ── Audit Trail (read-only) ───────────────────────────────────────────────────
// Managers see their own association; SUPER_USER can query across all.
// There is deliberately no write/delete endpoint — the trail is append-only.
router.get('/audit-logs', requireRoles(UserRole.MANAGER, UserRole.SUPER_USER), (req, res, next) =>
  systemController.listAuditLogs(req as never, res, next));

router.get('/audit-logs/facets', requireRoles(UserRole.MANAGER, UserRole.SUPER_USER), (req, res, next) =>
  systemController.auditFacets(req as never, res, next));

export default router;
