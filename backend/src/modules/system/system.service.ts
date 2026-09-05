import prisma from '../../config/database';
import { AuditAction, MobileConfig, Prisma, UserRole } from '@prisma/client';
import { auditService } from '../../services/audit.service';
import { ForbiddenError } from '../../utils/errors';
import {
  MOBILE_AVAILABLE, MOBILE_MENU_BY_ID, resolveMenuForRole, pruneToOverrides,
  type RoleMenuOverrides, type ResolvedMenuItem,
} from './mobile-menu';

export type MobileConfigBody = Omit<MobileConfig, 'id' | 'association_id' | 'created_at' | 'updated_at'>;

/** Shape stored in the menu_items JSON column. */
export interface MenuItemConfig {
  enabled: boolean;
  can_post: boolean;
}
export type MenuItemsMap = Record<string, MenuItemConfig>;

const MOBILE_DEFAULTS: MobileConfigBody = {
  feature_bills: true,
  feature_announcements: true,
  feature_complaints: true,
  feature_visitors: true,
  feature_journal: true,
  feature_ledger: true,
  feature_pnl: true,
  feature_balance_sheet: true,
  feature_coa: true,
  feature_fy_closure: true,
  push_dues_reminder: true,
  push_announcements: true,
  push_visitor_alerts: true,
  login_mpin_enabled: true,
  login_biometric: false,
  login_otp_only: false,
  app_name: null,
  theme_color: null,
  logo_url: null,
  menu_items: null,
};

/**
 * Prisma's nullable JSON fields require `Prisma.DbNull` (not JS `null`) in
 * create/update inputs. This helper converts the output-typed body into a
 * safe Prisma input object.
 */
function toJsonInput(
  body: Partial<MobileConfigBody>,
  defaults?: MobileConfigBody,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...(defaults ?? {}), ...body };
  // For every key that is null and came from a Json? column, use Prisma.DbNull
  if ('menu_items' in result && result['menu_items'] === null) {
    result['menu_items'] = Prisma.DbNull;
  }
  return result;
}

export class SystemService {
  /**
   * Web menu overrides for one association, as role -> itemId -> enabled.
   *
   * Sparse. A missing entry means "use the default role list declared on the
   * item", which is what lets a menu item added in a later release show up for
   * the right roles without anyone touching this screen.
   */
  async getMenuConfig(associationId: string) {
    const records = await prisma.menuGroupConfig.findMany({
      where: { association_id: associationId },
    });

    const config: Record<string, Record<string, boolean>> = {};
    for (const r of records) {
      if (!config[r.role]) config[r.role] = {};
      config[r.role][r.group_id] = r.enabled;
    }
    return { data: config };
  }

  /**
   * Replace one association's overrides.
   *
   * The caller sends only the cells that depart from a default — the frontend
   * owns the catalogue, so it is the only side that can tell. Anything absent
   * is deleted rather than left behind, which is how "reset this role" works
   * without needing an endpoint of its own.
   *
   * `editableRoles` is the guard for managers: they may configure every role
   * except their own. A manager who hid Web Menu by Role from MANAGER would
   * lock themselves out of the screen that could undo it, and the only way
   * back would be a super user or a hand-written SQL statement.
   */
  async saveMenuConfig(
    associationId: string,
    items: Array<{ group_id: string; role: string; enabled: boolean }>,
    editableRoles: string[],
  ) {
    // The screen loads and holds the WHOLE config for the association —
    // including roles the caller cannot edit (e.g. a super user's earlier
    // overrides for MANAGER) — because that is also what a manager's own GET
    // returns. Its save button then flattens the entire draft, so any
    // pre-existing row for a role outside editableRoles rides along in
    // `items` on every save, not just ones that actually touch that role.
    //
    // Rejecting the whole batch for that meant a manager's save could fail
    // in full — silently, since the caller has no try/catch — even though
    // every change they actually made was for roles they ARE allowed to
    // edit. Filtering instead means a foreign role's rows are left exactly
    // as deleteMany already scopes them: untouched.
    const filtered = items.filter(i => editableRoles.includes(i.role));

    const before = await prisma.menuGroupConfig.findMany({
      where: { association_id: associationId },
    });

    await prisma.$transaction([
      // Only the roles this caller is allowed to touch are cleared, so a
      // manager's save cannot wipe the overrides a super user set on MANAGER.
      prisma.menuGroupConfig.deleteMany({
        where: { association_id: associationId, role: { in: editableRoles } },
      }),
      ...(filtered.length
        ? [prisma.menuGroupConfig.createMany({
            data: filtered.map(i => ({
              association_id: associationId,
              group_id:       i.group_id,
              role:           i.role,
              enabled:        i.enabled,
            })),
          })]
        : []),
    ]);

    const beforeMap = new Map(before.map(b => [`${b.group_id}|${b.role}`, b.enabled]));
    const afterMap  = new Map(filtered.map(i => [`${i.group_id}|${i.role}`, i.enabled]));
    const keys = new Set([...beforeMap.keys(), ...afterMap.keys()]);
    const changed = [...keys].filter(k => beforeMap.get(k) !== afterMap.get(k));

    await auditService.record({
      entity_type:    'menu_config',
      association_id: associationId,
      action:         AuditAction.UPDATE,
      summary:        `Updated web menu permissions (${changed.length} change${changed.length === 1 ? '' : 's'})`,
      old_value:      changed.map(k => ({ key: k, enabled: beforeMap.get(k) ?? null })),
      new_value:      changed.map(k => ({ key: k, enabled: afterMap.get(k) ?? null })),
    });

    return this.getMenuConfig(associationId);
  }

  async getMobileConfig(associationId: string) {
    const config = await prisma.mobileConfig.findUnique({
      where: { association_id: associationId },
    });
    return { data: config ?? { ...MOBILE_DEFAULTS, association_id: associationId } };
  }

  /**
   * The config for one signed-in user, with their menu already resolved.
   *
   * The device is sent only its own role's menu — not the whole matrix. A
   * resident's phone has no business holding the answer to "what can the
   * treasurer see", and shipping it would make the config a map of the app's
   * attack surface. Resolving here also means the phone cannot get the merge
   * wrong, which matters when the phone is several builds behind.
   */
  async getMobileConfigForUser(associationId: string, role: UserRole) {
    const config = await prisma.mobileConfig.findUnique({
      where: { association_id: associationId },
    });

    const overrides = (config?.menu_items ?? null) as RoleMenuOverrides | null;
    const resolved  = resolveMenuForRole(role, overrides);

    return {
      data: {
        ...(config ?? { ...MOBILE_DEFAULTS, association_id: associationId }),
        menu_items: null,
        // Whole rows, not bare ids.
        //
        // The app used to look labels up in its own hardcoded list, which is
        // how the More screen came to render six items out of a catalogue of
        // twenty-six: enabling anything else changed the resolved menu and the
        // phone had no row for it. Sending label, icon and path means a new
        // item appears on every phone without an app release.
        //
        // Filtered to items that HAVE a mobile screen. An enabled item with no
        // route sends someone to the catch-all, which reads as the app
        // forgetting where it was going.
        menu: resolved
          .filter(i => i.enabled)
          .map(i => {
            const item = MOBILE_MENU_BY_ID.get(i.id);
            if (!item?.mobilePath) return null;
            return {
              id:       i.id,
              can_post: i.can_post,
              label:    item.label,
              path:     item.mobilePath,
              icon:     item.icon ?? null,
              hint:     item.hint ?? null,
              group:    item.group,
            };
          })
          .filter(Boolean),
        role,
      },
    };
  }

  /** The full matrix for the admin screen, defaults filled in per role. */
  async getMobileMenuMatrix(associationId: string) {
    const config = await prisma.mobileConfig.findUnique({
      where:  { association_id: associationId },
      select: { menu_items: true },
    });
    const overrides = (config?.menu_items ?? null) as RoleMenuOverrides | null;

    const roles = Object.values(UserRole);
    const matrix: Record<string, Record<string, ResolvedMenuItem>> = {};
    for (const role of roles) {
      matrix[role] = Object.fromEntries(
        resolveMenuForRole(role, overrides).map(i => [i.id, i]),
      );
    }

    return {
      data: {
        // The catalogue travels with the matrix so the admin screen never
        // holds its own copy of the item list. That duplication is how the
        // old screen came to offer items the app had never heard of.
        //
        // MOBILE_AVAILABLE, not MOBILE_MENU: only items with a mobile screen.
        // The matrix previously listed all twenty-six, including screens that
        // exist on the web alone — so a super user could switch on Arrears or
        // Ledger for a role and nothing would change, because the phone has no
        // route to send them to. A toggle that configures nothing is a support
        // call, not a feature.
        items: MOBILE_AVAILABLE.map(i => ({
          id: i.id, label: i.label, group: i.group, supports_post: i.supportsPost,
        })),
        roles,
        matrix,
        overrides: overrides ?? {},
      },
    };
  }

  /**
   * Save the matrix, keeping only genuine departures from the defaults.
   * See pruneToOverrides for why storing the whole thing would be a trap.
   */
  async saveMobileMenu(
    associationId: string,
    incoming:      RoleMenuOverrides,
    editableRoles: string[],
  ) {
    const pruned = pruneToOverrides(incoming ?? {});

    // A manager may not change what MANAGER sees; see menu-scope.ts. Their
    // save must also leave any existing MANAGER overrides alone rather than
    // dropping them, so the roles they cannot edit are carried over untouched.
    const existing = await prisma.mobileConfig.findUnique({
      where:  { association_id: associationId },
      select: { menu_items: true },
    });
    const prior = (existing?.menu_items ?? {}) as RoleMenuOverrides;

    for (const role of Object.keys(pruned)) {
      if (!editableRoles.includes(role)) {
        throw new ForbiddenError(`You cannot change what the ${role} role sees.`);
      }
    }
    for (const [role, cells] of Object.entries(prior)) {
      if (!editableRoles.includes(role)) pruned[role] = cells;
    }
    const config = await prisma.mobileConfig.upsert({
      where:  { association_id: associationId },
      create: { association_id: associationId, ...MOBILE_DEFAULTS, menu_items: pruned },
      update: { menu_items: pruned },
    });

    await auditService.record({
      entity_type:    'mobile_config',
      entity_id:      config.id,
      action:         existing ? AuditAction.UPDATE : AuditAction.CREATE,
      association_id: associationId,
      summary:        'Updated mobile menu by role',
      old_value:      (existing?.menu_items ?? undefined) as object | undefined,
      new_value:      pruned,
    });

    return this.getMobileMenuMatrix(associationId);
  }

  async saveMobileConfig(associationId: string, body: Partial<MobileConfigBody>) {
    const before = await prisma.mobileConfig.findUnique({
      where: { association_id: associationId },
    });

    const createData = toJsonInput(body, MOBILE_DEFAULTS);
    const updateData = toJsonInput(body);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = await (prisma.mobileConfig.upsert as any)({
      where:  { association_id: associationId },
      create: { association_id: associationId, ...createData },
      update: updateData,
    });

    await auditService.record({
      entity_type:    'mobile_config',
      entity_id:      config.id,
      action:         before ? AuditAction.UPDATE : AuditAction.CREATE,
      association_id: associationId,
      summary:        'Updated mobile app configuration',
      old_value:      before ?? undefined,
      new_value:      body,
    });

    return { data: config };
  }
}

export const systemService = new SystemService();
