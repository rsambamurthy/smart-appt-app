import prisma from '../config/database';
import { ModuleKey, SubscriptionStatus, UserRole } from '@prisma/client';

/**
 * Module entitlement.
 *
 * Three levels, and the middle one is the point of the whole design:
 *
 *   FULL       — subscribed and current. Everything works.
 *   READ_ONLY  — the subscription has lapsed or been cancelled. Existing
 *                records stay visible and exportable; nothing new can be
 *                created. A committee locked out of its own AGM minutes
 *                blames the vendor, not itself.
 *   NONE       — never subscribed. The module is not part of their product.
 *
 * Access is computed from dates on every check rather than read from `status`,
 * because a stored status is only correct until the next midnight.
 */
export type ModuleAccess = 'FULL' | 'READ_ONLY' | 'NONE';

export interface ModuleEntitlement {
  module:     ModuleKey;
  name:       string;
  access:     ModuleAccess;
  status:     SubscriptionStatus | null;
  starts_on:  Date | null;
  expires_on: Date | null;
  /** Negative once expired. Null when perpetual. */
  days_left:  number | null;
  /**
   * True inside the warning window — the signal the UI uses to show a banner.
   * Computed here rather than in the frontend so the threshold is defined once
   * and the app cannot quietly disagree with the renewal report.
   */
  expiring_soon: boolean;
}

/** Display metadata. Lives in code because it ships with the features it names. */
export const MODULE_CATALOG: Record<ModuleKey, { name: string; description: string }> = {
  ACCOUNTING: {
    name:        'Accounting',
    description: 'Double-entry ledger, trial balance, receipts & payments, income & expenditure, balance sheet and year-end close.',
  },
  GOVERNANCE: {
    name:        'Governance',
    description: 'Meetings and AGMs, agendas, notices, quorum, resolutions with in-app voting, and minutes.',
  },
  ASSISTANT: {
    name:        'Assistant',
    description: 'In-app chat that answers questions about dues, statements, complaints and visitors from live data, and drafts actions for confirmation.',
  },
};

export const ALL_MODULES = Object.keys(MODULE_CATALOG) as ModuleKey[];

/**
 * The rule, in one place.
 *
 * Kept as a pure function of a row so it can be reasoned about and tested
 * without a database, and so the API, the middleware and the admin screen can
 * never disagree about what "lapsed" means.
 */
export function resolveAccess(row: {
  status:     SubscriptionStatus;
  expires_on: Date | null;
} | null, today = new Date()): ModuleAccess {
  if (!row) return 'NONE';

  // Cancelled: they had it and stopped paying. Data stays readable.
  if (row.status === SubscriptionStatus.CANCELLED) return 'READ_ONLY';

  // Perpetual — the reference association and anyone grandfathered in.
  if (!row.expires_on) return 'FULL';

  // Compare by date, not timestamp: a subscription expiring on the 31st is
  // valid for the whole of the 31st.
  const endOfExpiry = new Date(row.expires_on);
  endOfExpiry.setHours(23, 59, 59, 999);

  return today <= endOfExpiry ? 'FULL' : 'READ_ONLY';
}

function daysLeft(expires_on: Date | null, today = new Date()): number | null {
  if (!expires_on) return null;
  const ms = new Date(expires_on).setHours(23, 59, 59, 999) - today.getTime();
  return Math.ceil(ms / 86_400_000);
}

/** How many days before expiry the warning starts. */
export const WARN_WINDOW_DAYS = { TRIAL: 14, PAID: 30 } as const;

/** Free trial length for a newly registered association. */
export const TRIAL_DAYS = 90;

export class EntitlementService {
  /**
   * Access to one module.
   *
   * SUPER_USER is exempt: they administer every association, including the
   * screen that grants subscriptions, and cannot be locked out of the thing
   * they use to fix a lockout.
   */
  async accessFor(
    associationId: string,
    module: ModuleKey,
    role?: UserRole,
  ): Promise<ModuleAccess> {
    return (await this.accessDetailFor(associationId, module, role)).access;
  }

  /**
   * Access plus whether this was a trial, which changes the wording the user
   * sees. "Your subscription has ended" told to someone who never bought one
   * reads as a billing error and generates a support call.
   */
  async accessDetailFor(
    associationId: string,
    module: ModuleKey,
    role?: UserRole,
  ): Promise<{ access: ModuleAccess; wasTrial: boolean }> {
    if (role === UserRole.SUPER_USER) return { access: 'FULL', wasTrial: false };

    const row = await prisma.associationModule.findUnique({
      where:  { association_id_module: { association_id: associationId, module } },
      select: { status: true, expires_on: true },
    });

    return {
      access:   resolveAccess(row),
      wasTrial: row?.status === SubscriptionStatus.TRIAL,
    };
  }

  /**
   * Start the free trial for a new association. Called when an association is
   * registered, so nobody has to remember to do it by hand — an association
   * that silently gets no trial looks like a broken product on day one.
   */
  async startTrial(associationId: string, modules: ModuleKey[] = ALL_MODULES) {
    const starts = new Date();
    const expires = new Date();
    expires.setDate(expires.getDate() + TRIAL_DAYS);

    await prisma.associationModule.createMany({
      data: modules.map(module => ({
        association_id: associationId,
        module,
        status:     SubscriptionStatus.TRIAL,
        starts_on:  starts,
        expires_on: expires,
        note:       `${TRIAL_DAYS}-day free trial`,
      })),
      skipDuplicates: true,
    });
  }

  /** Every module's standing, for the entitlements endpoint and the admin screen. */
  async listFor(associationId: string, role?: UserRole): Promise<ModuleEntitlement[]> {
    const rows = await prisma.associationModule.findMany({
      where:  { association_id: associationId },
      select: { module: true, status: true, starts_on: true, expires_on: true },
    });

    return this.buildEntitlements(rows, role);
  }

  /**
   * The same shaping, from rows already in hand.
   *
   * The subscription console loads a page of associations WITH their modules
   * in one query; calling listFor per association would put it straight back
   * into an N+1.
   */
  buildEntitlements(
    rows: { module: ModuleKey; status: SubscriptionStatus; starts_on: Date; expires_on: Date | null }[],
    role?: UserRole,
  ): ModuleEntitlement[] {
    const byModule = new Map(rows.map(r => [r.module, r]));

    return ALL_MODULES.map(module => {
      const row  = byModule.get(module) ?? null;
      const left = daysLeft(row?.expires_on ?? null);
      const window = row?.status === SubscriptionStatus.TRIAL
        ? WARN_WINDOW_DAYS.TRIAL
        : WARN_WINDOW_DAYS.PAID;

      return {
        module,
        name:       MODULE_CATALOG[module].name,
        access:     role === UserRole.SUPER_USER ? 'FULL' : resolveAccess(row),
        status:     row?.status     ?? null,
        starts_on:  row?.starts_on  ?? null,
        expires_on: row?.expires_on ?? null,
        days_left:  left,
        // Only warn while there is still something to save. Once it has
        // lapsed the 402 messages take over and a countdown banner would just
        // be noise on top of a blocked screen.
        expiring_soon: left !== null && left >= 0 && left <= window,
      };
    });
  }

  /**
   * Grant or renew. One row per association per module, so renewing updates
   * the dates rather than stacking rows nobody can reconcile later.
   */
  async grant(input: {
    associationId: string;
    module:        ModuleKey;
    status?:       SubscriptionStatus;
    starts_on:     Date;
    expires_on?:   Date | null;
    amount?:       number | null;
    reference?:    string | null;
    note?:         string | null;
    grantedBy:     string;
  }) {
    const data = {
      status:     input.status ?? SubscriptionStatus.ACTIVE,
      starts_on:  input.starts_on,
      expires_on: input.expires_on ?? null,
      amount:     input.amount     ?? null,
      reference:  input.reference  ?? null,
      note:       input.note       ?? null,
      granted_by_id: input.grantedBy,
    };

    return prisma.associationModule.upsert({
      where:  { association_id_module: { association_id: input.associationId, module: input.module } },
      create: { association_id: input.associationId, module: input.module, ...data },
      update: data,
    });
  }

  /**
   * Stop a subscription. The row is kept and marked CANCELLED rather than
   * deleted, so the association drops to read-only instead of losing sight of
   * its own records, and so you retain the history of what they once had.
   */
  async cancel(associationId: string, module: ModuleKey, cancelledBy: string) {
    return prisma.associationModule.update({
      where: { association_id_module: { association_id: associationId, module } },
      data:  { status: SubscriptionStatus.CANCELLED, granted_by_id: cancelledBy },
    });
  }

  /** Subscriptions expiring within `days`. The renewal chase-list. */
  async expiringSoon(days = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);

    return prisma.associationModule.findMany({
      where: {
        status:     SubscriptionStatus.ACTIVE,
        expires_on: { not: null, lte: cutoff },
      },
      select: {
        module: true, expires_on: true, amount: true,
        association: { select: { id: true, name: true } },
      },
      orderBy: { expires_on: 'asc' },
    });
  }
}

export const entitlementService = new EntitlementService();
