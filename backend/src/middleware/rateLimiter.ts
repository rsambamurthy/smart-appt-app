import rateLimit from 'express-rate-limit';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import redis from '../config/redis';
import { RateLimitError } from '../utils/errors';
import { AuthRequest } from '../types';

/** Per-IP rate limiter (unauthenticated) */
export const ipLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_PER_IP ?? '500', 10),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => next(new RateLimitError('IP rate limit exceeded')),
});

/** Per-user rate limiter (authenticated) */
const userRateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl_user',
  points: parseInt(process.env.RATE_LIMIT_MAX_PER_USER ?? '100', 10),
  duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10) / 1000,
});

export const userLimiter = async (req: AuthRequest, _res: unknown, next: (err?: unknown) => void): Promise<void> => {
  if (!req.user) return next();
  try {
    await userRateLimiter.consume(req.user.id);
    next();
  } catch {
    next(new RateLimitError('User rate limit exceeded'));
  }
};
