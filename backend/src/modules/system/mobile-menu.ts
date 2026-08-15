import { UserRole } from '@prisma/client';

/**
 * The mobile app's menu, and who sees what.
 *
 * This file is the single source of truth. Before it existed, the admin screen
 * held its own list of items and wrote a `menu_items` map that nothing read —
 * so an association could turn Journal Entries off for residents and the app
 * would keep showing it. A config screen that lies is worse than no config
 * screen, because someone acts on it.
 *
 * Two layers:
 *
 *   DEFAULTS  — what a role sees when nobody has configured anything. Chosen
 *               so a brand-new association is immediately sensible, and so a
 *               menu item added in a future release appears for the right
 *               roles without every association having to go and enable it.
 *
 *   OVERRIDES — what an association saved, stored per role. Sparse: only the
 *               cells that differ from the default are kept, so a later change
 *               to a default still reaches associations that never touched it.
 */

export interface MobileMenuItem {
  id:       string;
  label:    string;
  group:    'community' | 'dues' | 'accounting' | 'governance' | 'gate';
  /**
   * The route inside the mobile app, when one exists.
   *
   * ABSENT MEANS THERE IS NO MOBILE SCREEN, and the item is hidden from the
   * Mobile Menu by Role matrix entirely.
   *
   * This is the fix for a real defect. The matrix offered twenty-six items;
   * `App.tsx` registers eleven routes on native and wraps the rest in
   * `!IS_NATIVE`. Enabling Arrears or Ledger for a role resolved correctly on
   * the server and then had nowhere to send anyone — the catch-all bounced
   * them to Home. My Statement was already in the More page and already doing
   * exactly that.
   *
   * A switch that cannot do anything is worse than an absent one: it looks
   * like a broken app rather than a missing feature. When a mobile screen is
   * built, add its path here and the item appears in the matrix on its own.
   */
  mobilePath?: string;
  /** Shown on the More screen. Presentational, kept beside the label. */
  icon?:    string;
  /** One line under the label on the More screen. */
  hint?:    string;
  /** Whether "can post" is meaningful — a read-only report has no write side. */
  supportsPost: boolean;
  /** Roles that see it out of the box. */
  defaultRoles: UserRole[];
  /** Of those, the ones that may also act rather than only look. */
  defaultPostRoles?: UserRole[];
}

const RESIDENTS_AND_UP: UserRole[] = [
  UserRole.RESIDENT, UserRole.COMMITTEE, UserRole.TREASURER,
  UserRole.MANAGER, UserRole.SUPER_USER,
];

const OFFICERS: UserRole[] = [
  UserRole.TREASURER, UserRole.MANAGER, UserRole.SUPER_USER,
];

const COMMITTEE_AND_UP: UserRole[] = [
  UserRole.COMMITTEE, UserRole.TREASURER, UserRole.MANAGER, UserRole.SUPER_USER,
];

/**
 * Association members only — no SUPER_USER. Every other group above
 * includes SUPER_USER because a platform administrator can always reach a
 * screen if a genuine support case needs it. Chat is the one screen that
 * reasoning does not apply to: it is a conversation between residents, not
 * a report, and a platform administrator has no legitimate reason to read
 * one. The backend enforces this independently (chat.routes.ts), so even
 * a stale or hand-edited config here cannot reopen it.
 */
const ASSOCIATION_MEMBERS_ONLY: UserRole[] = [
  UserRole.RESIDENT, UserRole.COMMITTEE, UserRole.TREASURER, UserRole.MANAGER,
];

/**
 * Note what is deliberately absent: GATE_STAFF appears on nothing except the
 * gate items. Gate staff are usually contracted, share a handset, and have no
 * reason to see anyone's dues — so they start with the narrowest menu in the
 * system rather than the widest minus removals.
 */
export const MOBILE_MENU: MobileMenuItem[] = [
  // ── Community ──────────────────────────────────────────────────────────────
  { id: 'dues_my_bills',         label: 'My Bills',            group: 'community', mobilePath: '/mobile/bills',                icon: '🧾', hint: 'View and pay dues',                    supportsPost: false, defaultRoles: RESIDENTS_AND_UP },
  { id: 'dues_my_statement',     label: 'My Statement',        group: 'community', mobilePath: '/mobile/statement',            icon: '📄', hint: 'Every charge and payment on your flat',supportsPost: false, defaultRoles: RESIDENTS_AND_UP },
  { id: 'dues_pay_upi',          label: 'Pay by UPI',          group: 'community',                                                                                                        supportsPost: true,  defaultRoles: RESIDENTS_AND_UP, defaultPostRoles: RESIDENTS_AND_UP },
  { id: 'announcements_feed',    label: 'Announcements',       group: 'community', mobilePath: '/announcements',               icon: '📢', hint: 'Community notices and updates',        supportsPost: false, defaultRoles: [...RESIDENTS_AND_UP, UserRole.GATE_STAFF] },
  { id: 'announcements_docs',    label: 'Documents',           group: 'community', mobilePath: '/documents',                   icon: '📁', hint: 'Bye-laws, circulars and minutes',      supportsPost: false, defaultRoles: RESIDENTS_AND_UP },
  { id: 'maintenance_list',      label: 'Service Requests',    group: 'community', mobilePath: '/maintenance',                 icon: '🔧', hint: 'Raise and track maintenance requests', supportsPost: true,  defaultRoles: RESIDENTS_AND_UP, defaultPostRoles: OFFICERS },
  { id: 'maintenance_new',       label: 'Raise Request',       group: 'community', mobilePath: '/maintenance/new',             icon: '➕', hint: 'Report something that needs fixing',   supportsPost: true,  defaultRoles: RESIDENTS_AND_UP, defaultPostRoles: RESIDENTS_AND_UP },
  { id: 'expenses_transparency', label: 'Transparency',        group: 'community',                                                                                                        supportsPost: false, defaultRoles: RESIDENTS_AND_UP },
  // supportsPost: false — unlike Maintenance, there is no read-only mode for
  // chat to distinguish from. Anyone who can open it can send in it; the
  // matrix would otherwise offer a "Can act" toggle that nothing enforces.
  { id: 'chat',                  label: 'Chat',                 group: 'community', mobilePath: '/mobile/chat',                 icon: '💬', hint: 'Message other residents and the office', supportsPost: false, defaultRoles: ASSOCIATION_MEMBERS_ONLY },

  // ── Visitors and gate ──────────────────────────────────────────────────────
  { id: 'visitors_preapprove',   label: 'Pre-Approve Visitor', group: 'gate',      mobilePath: '/mobile/visitors/preapprove',   icon: '🚪', hint: 'Tell the gate someone is coming',      supportsPost: true,  defaultRoles: RESIDENTS_AND_UP, defaultPostRoles: RESIDENTS_AND_UP },
  { id: 'visitors_approvals',    label: 'Visitor Approvals',   group: 'gate',      mobilePath: '/mobile/visitors/requests',     icon: '✅', hint: 'Approve or decline visitors',          supportsPost: true,  defaultRoles: RESIDENTS_AND_UP, defaultPostRoles: RESIDENTS_AND_UP },
  { id: 'visitors_log',          label: 'Visitor Log',         group: 'gate',      mobilePath: '/mobile/visitors/log',          icon: '📋', hint: 'Who came and when',                    supportsPost: false, defaultRoles: RESIDENTS_AND_UP },
  { id: 'gate_console',          label: 'Gate Console',        group: 'gate',      mobilePath: '/mobile/gate',                  icon: '🛡️', hint: 'Log entries, exits and deliveries',    supportsPost: true,  defaultRoles: [UserRole.GATE_STAFF, UserRole.MANAGER, UserRole.SUPER_USER], defaultPostRoles: [UserRole.GATE_STAFF, UserRole.MANAGER, UserRole.SUPER_USER] },

  // ── Dues ───────────────────────────────────────────────────────────────────
  { id: 'dues_bills',            label: 'All Bills',           group: 'dues',      supportsPost: true,  defaultRoles: OFFICERS, defaultPostRoles: OFFICERS },
  { id: 'dues_arrears',          label: 'Arrears',             group: 'dues',      supportsPost: false, defaultRoles: COMMITTEE_AND_UP },
  { id: 'dues_statement',        label: 'Statement of Account',group: 'dues',      supportsPost: false, defaultRoles: COMMITTEE_AND_UP },
  { id: 'dues_payment_record',   label: 'Record Payment',      group: 'dues',      supportsPost: true,  defaultRoles: OFFICERS, defaultPostRoles: OFFICERS },
  { id: 'dues_upi_claims',       label: 'UPI Payments',        group: 'dues',      supportsPost: true,  defaultRoles: OFFICERS, defaultPostRoles: OFFICERS },

  // ── Accounting ─────────────────────────────────────────────────────────────
  // Off for residents by default. Transparency is served by the Transparency
  // screen, which is built for it; the raw ledger is not.
  { id: 'journal_entries',       label: 'Journal Entries',     group: 'accounting', supportsPost: true,  defaultRoles: OFFICERS, defaultPostRoles: OFFICERS },
  { id: 'ledger',                label: 'Ledger',              group: 'accounting', supportsPost: false, defaultRoles: OFFICERS },
  { id: 'pnl',                   label: 'Income & Expenditure',group: 'accounting', supportsPost: false, defaultRoles: COMMITTEE_AND_UP },
  { id: 'balance_sheet',         label: 'Balance Sheet',       group: 'accounting', supportsPost: false, defaultRoles: COMMITTEE_AND_UP },
  { id: 'fy_closure',            label: 'FY Closure',          group: 'accounting', supportsPost: true,  defaultRoles: OFFICERS, defaultPostRoles: [UserRole.TREASURER, UserRole.SUPER_USER] },

  // ── Governance ─────────────────────────────────────────────────────────────
  { id: 'gov_my_meetings',       label: 'My Meetings',         group: 'governance', supportsPost: true,  defaultRoles: RESIDENTS_AND_UP, defaultPostRoles: RESIDENTS_AND_UP },
  { id: 'gov_meetings',          label: 'Meetings & AGM',      group: 'governance', supportsPost: true,  defaultRoles: COMMITTEE_AND_UP, defaultPostRoles: OFFICERS },
  { id: 'gov_elections',         label: 'Elections',           group: 'governance', supportsPost: true,  defaultRoles: RESIDENTS_AND_UP, defaultPostRoles: RESIDENTS_AND_UP },
];

export const MOBILE_MENU_BY_ID = new Map(MOBILE_MENU.map(i => [i.id, i]));

/**
 * The items a phone can actually open.
 *
 * Everything the Mobile Menu by Role matrix shows, and everything sent to a
 * device, is filtered through this. An item with no `mobilePath` is a screen
 * that exists only on the web; offering it as a mobile toggle configures
 * nothing.
 */
export const MOBILE_AVAILABLE = MOBILE_MENU.filter(i => !!i.mobilePath);

/** True when this item has a screen on the phone. */
export const hasMobileScreen = (id: string) => !!MOBILE_MENU_BY_ID.get(id)?.mobilePath;

export interface ResolvedMenuItem {
  id:       string;
  enabled:  boolean;
  can_post: boolean;
}

/** Saved overrides: role → itemId → partial config. Sparse by design. */
export type RoleMenuOverrides = Record<string, Record<string, Partial<ResolvedMenuItem>>>;

/** What an item defaults to for a role, before any override. */
export function defaultFor(item: MobileMenuItem, role: UserRole): ResolvedMenuItem {
  const enabled = item.defaultRoles.includes(role);
  return {
    id:       item.id,
    enabled,
    // can_post never survives without enabled: a role that cannot see a screen
    // certainly cannot post from it, and storing otherwise invites a bug the
    // day someone flips visibility back on.
    can_post: enabled && item.supportsPost && (item.defaultPostRoles?.includes(role) ?? false),
  };
}

/**
 * The menu one role actually gets. Pure — no database, no request — so the
 * admin screen's preview and the app's real menu come from the same function
 * and cannot disagree.
 */
export function resolveMenuForRole(
  role:      UserRole,
  overrides: RoleMenuOverrides | null | undefined,
): ResolvedMenuItem[] {
  const forRole = overrides?.[role] ?? {};

  return MOBILE_MENU.map(item => {
    const base = defaultFor(item, role);
    const o    = forRole[item.id];
    if (!o) return base;

    const enabled = o.enabled ?? base.enabled;
    return {
      id:       item.id,
      enabled,
      can_post: enabled && item.supportsPost && (o.can_post ?? base.can_post),
    };
  });
}

/**
 * Drop any override that matches the default, so the stored map holds only
 * genuine decisions.
 *
 * This is what keeps defaults useful over time: if an association saves the
 * whole matrix verbatim, every future change to a default would be frozen out
 * for them, and a menu item added next year would never appear. Storing only
 * the differences means a default improvement still reaches everyone who never
 * expressed an opinion.
 */
export function pruneToOverrides(incoming: RoleMenuOverrides): RoleMenuOverrides {
  const out: RoleMenuOverrides = {};

  for (const [role, items] of Object.entries(incoming)) {
    if (!Object.values(UserRole).includes(role as UserRole)) continue;

    for (const [itemId, cfg] of Object.entries(items ?? {})) {
      const item = MOBILE_MENU_BY_ID.get(itemId);
      if (!item) continue;                       // unknown id — a stale client

      const base    = defaultFor(item, role as UserRole);
      const enabled = cfg.enabled  ?? base.enabled;
      const canPost = enabled && item.supportsPost && (cfg.can_post ?? base.can_post);

      if (enabled === base.enabled && canPost === base.can_post) continue;

      if (!out[role]) out[role] = {};
      out[role][itemId] = { enabled, can_post: canPost };
    }
  }

  return out;
}
