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
  WARN_WINDOW_DAYS, resolveAccess,
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

/**
 * The subscription console: associations with their module standing.
 *
 * Searched, filtered and paged in the database. The first version fetched
 * every association and then queried modules once per association — fine for
 * a dozen, an N+1 and an unscrollable page at a few hundred.
 *
 * `?q=` name or city · `?filter=` see FILTERS · `?page=` 1-based · `?limit=`
 */
type Filter = 'ALL' | 'EXPIRING' | 'LAPSED' | 'TRIAL' | 'UNSUBSCRIBED';

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const q      = String(req.query['q'] ?? '').trim();
    const filter = String(req.query['filter'] ?? 'ALL').toUpperCase() as Filter;
    const limit  = Math.min(Math.max(Number(req.query['limit'] ?? 25), 1), 100);
    const page   = Math.max(Number(req.query['page'] ?? 1), 1);

    const today = new Date();
    const soon  = new Date();
    soon.setDate(soon.getDate() + WARN_WINDOW_DAYS.PAID);

    // Filters are expressed against the modules relation so the database does
    // the work. UNSUBSCRIBED is the awkward one: "has at least one module it
    // has never been granted" cannot be written as a simple `some`, so it is
    // the absence of a full set.
    const moduleFilter: Record<Filter, object> = {
      ALL: {},
      EXPIRING: {
        modules: { some: { status: 'ACTIVE', expires_on: { not: null, gte: today, lte: soon } } },
      },
      LAPSED: {
        OR: [
          { modules: { some: { status: SubscriptionStatus.CANCELLED } } },
          { modules: { some: { expires_on: { not: null, lt: today } } } },
        ],
      },
      TRIAL: {
        modules: { some: { status: SubscriptionStatus.TRIAL, expires_on: { gte: today } } },
      },
      UNSUBSCRIBED: {
        modules: { none: {} },
      },
    };

    const where = {
      is_active: true,
      ...(q ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { city: { contains: q, mode: 'insensitive' as const } },
        ],
      } : {}),
      ...(moduleFilter[filter] ?? {}),
    };

    // One query for the page, one for the count, one for the summary tiles.
    const [associations, total, allModules] = await Promise.all([
      prisma.association.findMany({
        where,
        select: {
          id: true, name: true, city: true,
          modules: {
            select: { module: true, status: true, starts_on: true, expires_on: true },
          },
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.association.count({ where }),
      // Summary counts are over EVERY association, not the filtered page —
      // the tiles are a dashboard, not a description of what you filtered to.
      prisma.associationModule.findMany({
        where:  { association: { is_active: true } },
        select: { status: true, expires_on: true },
      }),
    ]);

    const data = associations.map(a => ({
      id: a.id, name: a.name, city: a.city,
      modules: entitlementService.buildEntitlements(a.modules),
    }));

    const summary = { active: 0, trial: 0, expiring: 0, lapsed: 0 };
    for (const m of allModules) {
      const access = resolveAccess(m);
      if (access === 'READ_ONLY') { summary.lapsed++; continue; }
      if (m.status === SubscriptionStatus.TRIAL) summary.trial++;
      else summary.active++;
      if (m.expires_on && m.expires_on >= today && m.expires_on <= soon) summary.expiring++;
    }

    res.json({
      data,
      meta: { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) },
      summary,
      catalog: MODULE_CATALOG,
      trial_days: TRIAL_DAYS,
    });
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
