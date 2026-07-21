import { Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { AuthRequest } from '../types';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

export const requireRoles =
  (...roles: UserRole[]) =>
  (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new UnauthorizedError());
    // SUPER_USER bypasses all role restrictions
    if (req.user.role === UserRole.SUPER_USER) return next();
    if (!roles.includes(req.user.role)) return next(new ForbiddenError());
    next();
  };

export const requireSameUnit = (req: AuthRequest, _res: Response, next: NextFunction): void => {
  if (!req.user) return next(new UnauthorizedError());
  // SUPER_USER has unrestricted access across all units
  if (req.user.role === UserRole.SUPER_USER) return next();
  if (req.user.role !== UserRole.RESIDENT) return next();
  // Unit check is done at the service level; this is a marker for routes
  next();
};
