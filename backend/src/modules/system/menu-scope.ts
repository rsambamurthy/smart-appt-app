import { UserRole } from '@prisma/client';
import { ForbiddenError } from '../../utils/errors';

/**
 * Who may configure whose menus.
 *
 * One place, because both the web and mobile menu screens need the identical
 * rule and a divergence between them would be silent — the kind of gap that is
 * only noticed when someone edits the association next door.
 */

const ALL_ROLES: string[] = Object.values(UserRole);

/**
 * The association whose config this request may touch.
 *
 * A super user may name any association. A manager is pinned to their own
 * regardless of what the request asks for — the id in the URL is a hint, never
 * an authority.
 */
export function scopeAssociation(
  user:      { role: UserRole; association_id: string },
  requested: string | undefined,
): string {
  if (user.role === UserRole.SUPER_USER) {
    if (!requested) throw new ForbiddenError('Choose an association.');
    return requested;
  }
  if (user.role === UserRole.MANAGER) return user.association_id;
  throw new ForbiddenError('Only a manager or super user can configure menus.');
}

/**
 * The roles this user may edit.
 *
 * A manager may configure everyone except MANAGER — including themselves would
 * let them hide the menu-configuration screen from their own role, and the
 * only way back would be a super user or a hand-written SQL statement. They
 * also may not touch SUPER_USER, which is not configurable anywhere.
 */
export function editableRolesFor(user: { role: UserRole }): string[] {
  if (user.role === UserRole.SUPER_USER) {
    return ALL_ROLES.filter(r => r !== UserRole.SUPER_USER);
  }
  return ALL_ROLES.filter(r => r !== UserRole.SUPER_USER && r !== UserRole.MANAGER);
}
