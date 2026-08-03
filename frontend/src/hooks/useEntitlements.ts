import { useMemo } from 'react';
import {
  useGetMyEntitlementsQuery, ModuleKey, ModuleAccess, ModuleEntitlement,
} from '../store/api/subscriptionsApi';

/**
 * The signed-in association's module entitlements.
 *
 * This is for PRESENTATION ONLY — hiding menu items an association cannot use,
 * and showing the renewal warning. It is not security. The server enforces
 * entitlement in middleware and returns 402; if this hook were the only guard,
 * anyone who typed the URL would have the module for free.
 *
 * While loading, `access` reports FULL. Flashing "not subscribed" at a paying
 * customer on every page load is worse than a brief moment of optimism, and
 * the server refuses anything they should not be doing anyway.
 */
export function useEntitlements() {
  const { data, isLoading } = useGetMyEntitlementsQuery();

  return useMemo(() => {
    const modules: ModuleEntitlement[] = data?.data.modules ?? [];
    const byKey = new Map(modules.map(m => [m.module, m]));

    const accessTo = (module: ModuleKey): ModuleAccess =>
      isLoading ? 'FULL' : (byKey.get(module)?.access ?? 'NONE');

    return {
      isLoading,
      modules,
      accessTo,
      /** Should the module appear at all? Read-only still appears. */
      canSee:  (module: ModuleKey) => accessTo(module) !== 'NONE',
      /** Can they create, edit, or produce a report? */
      canUse:  (module: ModuleKey) => accessTo(module) === 'FULL',
      /** Modules inside the warning window, for the banner. */
      expiring: modules.filter(m => m.expiring_soon),
      /** Lapsed but still visible — drives the read-only notice. */
      lapsed:   modules.filter(m => m.access === 'READ_ONLY'),
    };
  }, [data, isLoading]);
}
