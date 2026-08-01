/**
 * Shared menu-visibility helpers.
 *
 * Lives in its own module (no screen imports) so screens can check feature
 * visibility without importing MainTabNavigator — which would create a
 * circular import, since MainTabNavigator imports every screen.
 */
import type { Ionicons } from '@expo/vector-icons';
import type { MobileConfig } from '../api/types';

/** Item ids as saved by the webapp's Mobile App Configuration page. */
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

/** Tab metadata shared between the navigator and the "More" screen. */
export interface TabDef {
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: React.ComponentType<any>;
  /** menu_items key controlling visibility; null = always shown */
  itemId: MenuItemId | null;
}

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
