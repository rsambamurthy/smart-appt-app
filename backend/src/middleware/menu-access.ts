import { Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import prisma from '../config/database';
import { AuthRequest } from '../types';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

/**
 * Gate a read endpoint on the same decision Web Menu by Role already makes
 * for the sidebar (Layout.tsx) and, on the frontend, useMenuItemEnabled.
 *
 * Before this existed, a menu item's "roles" array was really two unrelated
 * hardcoded lists that happened to usually agree: one baked into the
 * sidebar/route guard on the frontend, and a second one baked into
 * requireRoles(...) on the backend. Nothing kept them in sync — an audit
 * across the app found several places they'd already drifted (a role that
 * could reach a page whose data call then 403'd, or vice versa). And even
 * where they agreed, a Manager turning a feature off for a role via Web Menu
 * Configuration only ever hid the sidebar link; the API itself was still
 * wide open to anyone whose role was in that frozen array. This middleware
 * is what makes that Manager's decision the actual, enforced boundary,
 * instead of a cosmetic one.
 *
 * itemId must match a NAV_GROUPS item id in
 * frontend/src/components/organisms/Layout.tsx exactly. The two apps have
 * no shared package, so this is a second, hand-maintained copy of that
 * catalogue's *lookup key* only (not its role lists) — get the id wrong and
 * this silently falls through to defaultRoles with no override ever able to
 * take effect, rather than failing loudly. Keep ids in sync by hand.
 *
 * defaultRoles is the fallback applied when nobody has explicitly configured
 * this item for the caller's role yet — i.e., exactly today's behavior,
 * preserved for every association that never touches Web Menu Configuration.
 * SUPER_USER always passes, matching requireRoles' own convention.
 */
export function requireMenuFeature(itemId: string, ...defaultRoles: UserRole[]) {
  return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) return next(new UnauthorizedError());
    if (req.user.role === UserRole.SUPER_USER) return next();

    try {
      const override = await prisma.menuGroupConfig.findUnique({
        where: {
          association_id_group_id_role: {
            association_id: req.user.association_id,
            group_id: itemId,
            role: req.user.role,
          },
        },
        select: { enabled: true },
      });

      const allowed = override ? override.enabled : defaultRoles.includes(req.user.role);
      if (!allowed) {
        return next(new ForbiddenError('Not enabled for your role. Ask your Manager to enable this under Web Menu Configuration.'));
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
