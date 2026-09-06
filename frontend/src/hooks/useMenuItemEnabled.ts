import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { useGetMenuConfigQuery } from '../store/api/systemApi';
import { NAV_GROUPS } from '../components/organisms/Layout';

/**
 * Resolves whether a Web Menu item is enabled for the current user, using the
 * exact same precedence Layout.tsx's sidebar already uses to decide whether
 * to render that item's nav link: a per-association override saved in Web
 * Menu Configuration always wins; only when nothing is configured for this
 * role does the item's coded default `roles` array apply. SUPER_USER always
 * sees everything, same as the sidebar.
 *
 * Why this exists: hiding a nav link via Web Menu Configuration only ever
 * hid the *link*. The page underneath was still reachable by direct URL
 * (RoleRoute) and its API calls still allowed (backend requireRoles) for any
 * role those hardcoded checks let in — the menu config had no say over
 * actual access, only sidebar visibility. This hook is the fix, applied
 * inside the page component itself so the Web Menu setting becomes the real
 * decider for that page, without touching RoleRoute or requireRoles (and
 * therefore without changing access for every other page in the app).
 *
 * Deliberately scoped: call this from a specific page (e.g.
 * RecurringExpensesPage, ExpenseListPage) that wants its menu-config setting
 * enforced, not as a blanket replacement for route guards everywhere.
 *
 * @param itemId a NAV_GROUPS item id (e.g. 'recurring_expenses', 'expenses_list')
 */
export function useMenuItemEnabled(itemId: string): { enabled: boolean; isLoading: boolean } {
  const role = useSelector((s: RootState) => s.auth.user?.role ?? '');
  const { data, isLoading } = useGetMenuConfigQuery();
  const menuConfig = data?.data;

  const item = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.id === itemId);

  if (role === 'SUPER_USER') return { enabled: true, isLoading };
  if (!item) return { enabled: true, isLoading }; // unknown id — fail open, not a lockout mechanism

  const stored = menuConfig?.[role]?.[item.id];
  const enabled = stored !== undefined ? stored : item.roles.includes(role);
  return { enabled, isLoading };
}
