import { AuthRequest } from '../types';

// A request that reaches a route handler has authenticated as EITHER a real
// user (req.user) OR an Integration API Key (req.apiKey) — never both, and
// never neither (middleware/auth.ts's authenticate throws before that point).
// These two helpers let a controller stay agnostic about which one it got,
// for the small set of endpoints an API key is allowed to call at all (see
// middleware/api-key-scope.ts's requireRolesOrApiKeyScope).

/** The association a request acts within, whichever way it authenticated. */
export function actorAssociationId(req: AuthRequest): string {
  return req.user?.association_id ?? req.apiKey!.association_id;
}

/** The acting user's id, or null when this request authenticated via an
 * Integration API Key rather than a real user login. Every column this can
 * be written into (approved_by, waived_by, changed_by, ...) must accept null
 * for exactly this reason. */
export function actorUserId(req: AuthRequest): string | null {
  return req.user?.id ?? null;
}
