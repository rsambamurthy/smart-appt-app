/**
 * Shared menu structure + visibility helpers.
 *
 * Lives in its own module (no screen imports) so screens can read the menu
 * without importing MainNavigator — which would create a circular import,
 * since MainNavigator imports every screen.
 *
 * The CATEGORIES below mirror the quadrants in the webapp's
 * "Mobile App Configuration" page so the two stay in step.
 */
import type { Ionicons } from '@expo/vector-icons';
import type { MobileConfig } from '../api/types';

/** Item ids exactly as saved by the webapp's Mobile App Configuration page. */
export type MenuItemId =
  | 'dues_my_bills'
  | 'announcements_feed'
  | 'maintenance_list'
  | 'maintenance_new'
  | 'expenses_transparency'
  | 'visitors_preapprove'
  | 'announcements_docs'
  | 'journal_entries'
  | 'ledger'
  | 'pnl'
  | 'balance_sheet'
  | 'fy_closure'
  | 'dues_bills'
  | 'dues_one_time'
  | 'visitors_log'
  | 'visitors_gate';

export interface MenuEntry {
  /** menu_items key; null = always visible (not configurable) */
  itemId: MenuItemId | null;
  label: string;
  /** Registered screen name in MainNavigator */
  screen: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

export interface MenuCategory {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  items: MenuEntry[];
}

/** Mirrors the QUADRANTS in frontend/src/pages/admin/MobileConfigPage.tsx */
export const CATEGORIES: MenuCategory[] = [
  {
    id: 'community',
    label: 'Community',
    icon: 'home-outline',
    color: '#22c55e',
    items: [
      { itemId: 'dues_my_bills',      label: 'My Bills',         screen: 'MyBills',       icon: 'receipt-outline',   color: '#f59e0b' },
      { itemId: 'announcements_feed', label: 'Announcements',    screen: 'Announcements', icon: 'megaphone-outline', color: '#22c55e' },
      { itemId: 'maintenance_list',   label: 'Service Requests', screen: 'Maintenance',   icon: 'construct-outline', color: '#ef4444' },
      // 'expenses_transparency' has no mobile screen yet — omitted deliberately
      // so the config toggle never produces a dead tile.
    ],
  },
  {
    id: 'accounting',
    label: 'Accounting',
    icon: 'bar-chart-outline',
    color: '#7C3AED',
    items: [
      { itemId: 'journal_entries', label: 'Journal Entries',   screen: 'Journal',          icon: 'book-outline',        color: '#7C3AED' },
      { itemId: 'ledger',          label: 'Ledger',            screen: 'Ledger',           icon: 'list-outline',        color: '#16a34a' },
      { itemId: 'pnl',             label: 'Profit & Loss',     screen: 'PnL',              icon: 'trending-up-outline', color: '#f59e0b' },
      { itemId: 'balance_sheet',   label: 'Balance Sheet',     screen: 'BalanceSheet',     icon: 'scale-outline',       color: '#0891b2' },
      { itemId: 'fy_closure',      label: 'FY Closure',        screen: 'FYClosure',        icon: 'lock-closed-outline', color: '#dc2626' },
      { itemId: null,              label: 'Chart of Accounts', screen: 'COA',              icon: 'layers-outline',      color: '#8b5cf6' },
      { itemId: null,              label: 'Business Partners', screen: 'BusinessPartners', icon: 'briefcase-outline',   color: '#0d9488' },
    ],
  },
  {
    id: 'dues',
    label: 'Dues',
    icon: 'cash-outline',
    color: '#f59e0b',
    items: [
      { itemId: 'dues_bills', label: 'Bills & Payments', screen: 'Bills', icon: 'albums-outline', color: '#6366f1' },
    ],
  },
  {
    id: 'visitors',
    label: 'Visitors',
    icon: 'people-outline',
    color: '#0891b2',
    items: [
      { itemId: 'visitors_log', label: 'Visitor Log', screen: 'Visitors', icon: 'people-outline', color: '#0891b2' },
    ],
  },
];

/**
 * A feature is visible unless the association's config explicitly disables it.
 * No config yet (still loading / never saved) → show everything.
 */
export function isEnabled(itemId: MenuItemId | null, cfg: MobileConfig | null): boolean {
  if (itemId === null) return true;
  if (!cfg?.menu_items) return true;
  return cfg.menu_items[itemId]?.enabled !== false;
}

/** Whether residents may create records in a section (Can Post toggle). */
export function canPost(itemId: MenuItemId, cfg: MobileConfig | null): boolean {
  if (!cfg?.menu_items) return true;
  return cfg.menu_items[itemId]?.can_post !== false;
}

/** Items of a category that the current config allows. */
export function enabledItems(cat: MenuCategory, cfg: MobileConfig | null): MenuEntry[] {
  return cat.items.filter(i => isEnabled(i.itemId, cfg));
}

/** Categories that still have at least one visible item. */
export function visibleCategories(cfg: MobileConfig | null): MenuCategory[] {
  return CATEGORIES.filter(c => enabledItems(c, cfg).length > 0);
}
