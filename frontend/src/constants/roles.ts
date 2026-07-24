/**
 * Roles that are treated as residents — they live in the complex
 * and must have all resident features in addition to any admin features.
 * GATE_STAFF is excluded because gate staff are external/operational, not residents.
 */
export const RESIDENT_ROLES = ['RESIDENT', 'MANAGER', 'COMMITTEE', 'TREASURER'] as const;

/** Returns true when the given role should have resident-level access. */
export function isResidentRole(role: string | undefined | null): boolean {
  return RESIDENT_ROLES.includes(role as typeof RESIDENT_ROLES[number]);
}
