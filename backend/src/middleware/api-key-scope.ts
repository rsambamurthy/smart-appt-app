import { Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { AuthRequest } from '../types';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

/**
 * Allows a request through if EITHER:
 *  - it's a real user whose role is in `roles` (SUPER_USER always allowed,
 *    matching requireRoles's own behaviour), or
 *  - it's an Integration API Key whose scopes include `scope`.
 *
 * Use this in place of requireRoles ONLY on the small, specific set of
 * endpoints an outside integration (the BPM/workflow tool) is allowed to
 * call directly — never as a blanket replacement. Most endpoints should
 * still reject an API key outright, which is exactly what plain requireRoles
 * already does (req.user is undefined for a key-authenticated request, so
 * requireRoles's own `!req.user` check rejects it with 401).
 */
export function requireRolesOrApiKeyScope(scope: string, ...roles: UserRole[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (req.apiKey) {
      if (req.apiKey.scopes.includes(scope)) return next();
      return next(new ForbiddenError(`This API key is not scoped for '${scope}'.`));
    }
    if (!req.user) return next(new UnauthorizedError());
    if (req.user.role === UserRole.SUPER_USER) return next();
    if (!roles.includes(req.user.role)) return next(new ForbiddenError());
    next();
  };
}
