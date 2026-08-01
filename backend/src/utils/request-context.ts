import { AsyncLocalStorage } from 'node:async_hooks';
import { Request, Response, NextFunction } from 'express';

/**
 * Per-request context carried implicitly through the async call stack.
 *
 * This exists so the audit service can record WHO did something and FROM WHERE
 * without threading `(userId, ip, userAgent)` through every service signature.
 */
export interface RequestContext {
  userId?: string;
  associationId?: string;
  role?: string;
  ip?: string;
  userAgent?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Current request's context, or an empty object outside a request (e.g. cron jobs). */
export function getContext(): RequestContext {
  return storage.getStore() ?? {};
}

/**
 * Merge values into the active context.
 * Used by the auth middleware, which runs after the context is created.
 */
export function setContext(patch: Partial<RequestContext>): void {
  const store = storage.getStore();
  if (store) Object.assign(store, patch);
}

/** Run a function inside an explicit context — used by background jobs. */
export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run({ ...ctx }, fn);
}

/** Client IP, honouring the proxy header set by Railway/Vercel. */
function clientIp(req: Request): string | undefined {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0]!.trim();
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0]!.split(',')[0]!.trim();
  return req.ip ?? req.socket?.remoteAddress ?? undefined;
}

/**
 * Opens a context for the lifetime of the request.
 * Must be registered BEFORE the routers so every handler runs inside it.
 */
export function requestContext(req: Request, _res: Response, next: NextFunction): void {
  storage.run(
    {
      ip: clientIp(req),
      userAgent: (req.headers['user-agent'] ?? '').toString().slice(0, 255) || undefined,
    },
    () => next(),
  );
}
