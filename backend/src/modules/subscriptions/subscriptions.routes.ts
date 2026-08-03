import { Router } from 'express';
import { ModuleKey, SubscriptionStatus, UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { AuthRequest } from '../../types';
import { UnprocessableError, NotFoundError } from '../../utils/errors';
import { auditService } from '../../services/audit.service';
import { AuditAction } from '@prisma/client';
import prisma from '../../config/database';
import {
  entitlementService, MODULE_CATALOG, ALL_MODULES, TRIAL_DAYS,
} from '../../services/entitlement.service';

const router = Router();
router.use(authenticate);

const isModuleKey = (v: unknown): v is ModuleKey =>
  typeof v === 'string' && (ALL_MODULES as string[]).includes(v);

const parseDate = (v: unknown, field: string): Date => {
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new UnprocessableError(`${field} is not a valid date.`);
  return d;
};

// ── Any signed-in user: what does MY association have? ────────────────────────
//
// Drives menu visibility and the expiry banner. Deliberately readable by every
// role: a resident who cannot see the Governance menu should still be able to
// be told why, and a treasurer needs the renewal warning without being an
// administrator.
router.get('/mine', async (req: AuthRequest, res, next) => {
  try {
    res.json({
      data: {
        modules: await entitlementService.listFor(req.user!.association_id, req.user!.role),
        catalog: MODULE_CATALOG,
      },
    });
  } catch (err) { next(err); }
});

// ── Super user only, from here ────────────────────────────────────────────────
router.use(requireRoles(UserRole.SUPER_USER));

/** Every association with its module standing. The subscription console. */
router.get('/', async (_req: AuthRequest, res, next) => {
  try {
    const associations = await prisma.association.findMany({
      where:   { is_active: true },
      select:  { id: true, name: true, city: true },
      orderBy: { name: 'asc' },
    });

    const data = await Promise.all(associations.map(async a => ({
      ...a,
      modules: await entitlementService.listFor(a.id),
    })));

    res.json({ data, catalog: MODULE_CATALOG, trial_days: TRIAL_DAYS });
  } catch (err) { next(err); }
});

/** Renewal chase-list — what lapses in the next N days. */
router.get('/expiring', async (req: AuthRequest, res, next) => {
  try {
    const days = Number(req.query['days'] ?? 30);
    res.json({ data: await entitlementService.expiringSoon(Number.isFinite(days) ? days : 30) });
  } catch (err) { next(err); }
});

/** Grant or renew one module for one association. */
router.post('/:associationId/:module', async (req: AuthRequest, res, next) => {
  try {
    const { associationId } = req.params;
    const moduleParam = req.params['module'];
    if (!isModuleKey(moduleParam)) throw new UnprocessableError('Unknown module.');

    const association = await prisma.association.findUnique({
      where: { id: associationId as string }, select: { id: true, name: true },
    });
    if (!association) throw new NotFoundError('Association');

    const { starts_on, expires_on, status, amount, reference, note } = req.body ?? {};

    // An open-ended paid subscription is almost always a slip. Perpetual
    // access is real, but it should be chosen, so it is only allowed when
    // expires_on is explicitly null rather than merely absent.
    if (expires_on === undefined) {
      throw new UnprocessableError(
        'Set an expiry date, or pass expires_on: null for perpetual access.',
      );
    }

    const record = await entitlementService.grant({
      associationId: association.id,
      module:        moduleParam,
      status:        status === SubscriptionStatus.TRIAL ? SubscriptionStatus.TRIAL : SubscriptionStatus.ACTIVE,
      starts_on:     starts_on ? parseDate(starts_on, 'starts_on') : new Date(),
      expires_on:    expires_on === null ? null : parseDate(expires_on, 'expires_on'),
      amount:        amount === undefined || amount === null || amount === '' ? null : Number(amount),
      reference:     reference ?? null,
      note:          note ?? null,
      grantedBy:     req.user!.id,
    });

    await auditService.record({
      entity_type: 'subscription', entity_id: record.id, action: AuditAction.UPDATE,
      performed_by: req.user!.id, association_id: association.id,
      summary: `${MODULE_CATALOG[moduleParam].name} set to ${record.status} for ${association.name}` +
               (record.expires_on ? ` until ${record.expires_on.toISOString().slice(0, 10)}` : ' (perpetual)'),
    });

    res.json({ data: record });
  } catch (err) { next(err); }
});

/** Stop a subscription. The row is kept so the association drops to read-only. */
router.delete('/:associationId/:module', async (req: AuthRequest, res, next) => {
  try {
    const { associationId } = req.params;
    const moduleParam = req.params['module'];
    if (!isModuleKey(moduleParam)) throw new UnprocessableError('Unknown module.');

    const record = await entitlementService.cancel(
      associationId as string, moduleParam, req.user!.id,
    );

    await auditService.record({
      entity_type: 'subscription', entity_id: record.id, action: AuditAction.CANCEL,
      performed_by: req.user!.id, association_id: associationId as string,
      summary: `${MODULE_CATALOG[moduleParam].name} cancelled — association is now read-only for this module`,
    });

    res.json({ data: record });
  } catch (err) { next(err); }
});

export default router;
