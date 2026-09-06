import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../config/jwt';
import { UnauthorizedError } from '../utils/errors';
import { AuthRequest } from '../types';
import prisma from '../config/database';
import { setContext } from '../utils/request-context';
import { hashApiKeySecret } from '../utils/api-key';

export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const header = req.headers.authorization;

    // An Integration API Key (see IntegrationApiKey / requireApiKeyScope) is
    // a separate, additive auth path — checked only when there is no Bearer
    // token, so every existing route (which only ever sends one) is
    // completely unaffected. A request authenticates as either a real user
    // or a key, never both.
    if (!header?.startsWith('Bearer ')) {
      const apiKeyHeader = req.headers['x-api-key'];
      if (typeof apiKeyHeader === 'string' && apiKeyHeader.length > 0) {
        const key = await prisma.integrationApiKey.findUnique({
          where: { key_hash: hashApiKeySecret(apiKeyHeader) },
          select: { id: true, association_id: true, name: true, scopes: true, is_active: true, revoked_at: true },
        });
        if (!key || !key.is_active || key.revoked_at) throw new UnauthorizedError('Invalid or revoked API key');

        req.apiKey = { id: key.id, association_id: key.association_id, name: key.name, scopes: key.scopes };
        setContext({ associationId: key.association_id, actorLabel: `Integration API Key: ${key.name}` });

        // Best-effort — a failed timestamp write should never block the
        // actual request this key was sent to make.
        prisma.integrationApiKey.update({ where: { id: key.id }, data: { last_used_at: new Date() } }).catch(() => {});

        return next();
      }
      throw new UnauthorizedError();
    }

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

    // Publish the identified actor so the audit trail can attribute actions
    // without every service needing the user passed in.
    setContext({
      userId: user.id,
      associationId: user.association_id,
      role: user.role,
    });

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
