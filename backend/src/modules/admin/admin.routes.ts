import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { requireMenuFeature } from '../../middleware/menu-access';
import { validate } from '../../middleware/validate';
import { updateAssociationConfigSchema } from './admin.schema';
import prisma from '../../config/database';
import { AuthRequest } from '../../types';

const router = Router();
router.use(authenticate);

// GET & PUT /admin/config
//
// Gated by requireMenuFeature rather than a fixed requireRoles list: which
// role(s) may actually view/change this — not just see its sidebar link —
// is a call for this association's own Manager to make via Web Menu
// Configuration (itemId 'system_expense_approval', see Layout.tsx), not
// something to hardcode here. MANAGER is only the *default* that applies
// until a Manager explicitly configures something else — e.g. handing this
// to COMMITTEE instead, or adding it alongside MANAGER — for associations
// where Committee, not Manager, owns financial policy like this.
router.get('/config', requireMenuFeature('system_expense_approval', UserRole.MANAGER, UserRole.TREASURER), async (req: AuthRequest, res, next) => {
  try {
    const config = await prisma.associationConfig.findUnique({ where: { association_id: req.user!.association_id } });
    res.json({ data: config });
  } catch (err) { next(err); }
});

// A plain `update`, not an upsert: the config row is always created inside
// the same transaction that creates the Association itself
// (associations.service.ts), so by the time any user can authenticate and
// reach this route it is guaranteed to already exist. (An upsert here used
// to crash on every partial body — see admin.schema.ts for the story.) The
// validate() call whitelists exactly which fields this endpoint may touch.
router.put('/config', requireMenuFeature('system_expense_approval', UserRole.MANAGER), validate(updateAssociationConfigSchema), async (req: AuthRequest, res, next) => {
  try {
    const config = await prisma.associationConfig.update({
      where: { association_id: req.user!.association_id },
      data: req.body,
    });
    res.json({ data: config });
  } catch (err) { next(err); }
});

// GET /admin/vendors
router.get('/vendors', requireRoles(UserRole.MANAGER, UserRole.TREASURER), async (req: AuthRequest, res, next) => {
  try {
    const vendors = await prisma.vendor.findMany({ where: { association_id: req.user!.association_id, is_active: true } });
    res.json({ data: vendors });
  } catch (err) { next(err); }
});

// POST /admin/vendors
router.post('/vendors', requireRoles(UserRole.MANAGER, UserRole.TREASURER), async (req: AuthRequest, res, next) => {
  try {
    const vendor = await prisma.vendor.create({
      data: { association_id: req.user!.association_id, ...req.body, created_by: req.user!.id },
    });
    res.status(201).json({ data: vendor });
  } catch (err) { next(err); }
});

// GET /admin/audit-logs
router.get('/audit-logs', requireRoles(UserRole.MANAGER), async (req: AuthRequest, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({
      where: { association_id: req.user!.association_id },
      include: { performer: { select: { name: true, role: true } } },
      orderBy: { created_at: 'desc' },
      take: 100,
    });
    res.json({ data: logs });
  } catch (err) { next(err); }
});

export default router;
