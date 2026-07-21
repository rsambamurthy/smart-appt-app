import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../config/jwt';
import { UnauthorizedError } from '../utils/errors';
import { AuthRequest } from '../types';
import prisma from '../config/database';

export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedError();

    const token = header.slice(7);
    const payload = verifyToken(token);

    // Lightweight user lookup to confirm account is still active
    const user = await prisma.user.findUnique({
      where: { id: payload.sub, deleted_at: null },
      select: { id: true, association_id: true, role: true, unit_id: true, phone: true, name: true, is_active: true },
    });

    if (!user || !user.is_active) throw new UnauthorizedError('Account is inactive or deleted');

    req.user = {
      id: user.id,
      association_id: user.association_id,
      role: user.role,
      unit_id: user.unit_id,
      phone: user.phone,
      name: user.name,
    };

    next();
  } catch (err) {
    next(err instanceof UnauthorizedError ? err : new UnauthorizedError());
  }
};

/** Attach request_id to every request for tracing */
export const requestId = (req: Request, _res: Response, next: NextFunction): void => {
  req.headers['x-request-id'] ??= crypto.randomUUID();
  next();
};
