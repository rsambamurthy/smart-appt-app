import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import prisma from '../../config/database';
import { AuthRequest } from '../../types';

const router = Router();
router.use(authenticate);

// GET /admin/config
router.get('/config', requireRoles(UserRole.MANAGER, UserRole.TREASURER), async (req: AuthRequest, res, next) => {
  try {
    const config = await prisma.associationConfig.findUnique({ where: { association_id: req.user!.association_id } });
    res.json({ data: config });
  } catch (err) { next(err); }
});

// PUT /admin/config
router.put('/config', requireRoles(UserRole.MANAGER), async (req: AuthRequest, res, next) => {
  try {
    const config = await prisma.associationConfig.upsert({
      where: { association_id: req.user!.association_id },
      update: req.body,
      create: { association_id: req.user!.association_id, association_name: req.body.association_name, ...req.body },
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
