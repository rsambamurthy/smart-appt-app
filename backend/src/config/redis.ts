import Redis from 'ioredis';
import logger from '../utils/logger';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,  // don't reject queued commands; let them wait for connection
  enableReadyCheck: false,     // don't block on PING after connect
  lazyConnect: true,           // don't connect at module import; connect explicitly in index.ts
  connectTimeout: 10000,
  retryStrategy: (times) => {
    if (times > 10) return null;  // give up after 10 retries
    return Math.min(times * 500, 5000);
  },
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.error('Redis error', { error: err.message }));

export default redis;

// ── OTP helpers ──────────────────────────────────────────────────────────────

const OTP_PREFIX = 'otp:';
const OTP_ATTEMPT_PREFIX = 'otp_attempts:';
const OTP_LOCKOUT_PREFIX = 'otp_lockout:';

export const setOtp = async (phone: string, otp: string, ttlSeconds: number): Promise<void> => {
  await redis.setex(`${OTP_PREFIX}${phone}`, ttlSeconds, otp);
  await redis.del(`${OTP_ATTEMPT_PREFIX}${phone}`);
};

export const getOtp = (phone: string): Promise<string | null> =>
  redis.get(`${OTP_PREFIX}${phone}`);

export const deleteOtp = (phone: string): Promise<number> =>
  redis.del(`${OTP_PREFIX}${phone}`);

export const incrementOtpAttempts = async (phone: string, maxAttempts: number, lockoutMinutes: number): Promise<{ attempts: number; locked: boolean }> => {
  const isLocked = await redis.exists(`${OTP_LOCKOUT_PREFIX}${phone}`);
  if (isLocked) return { attempts: maxAttempts, locked: true };

  const attempts = await redis.incr(`${OTP_ATTEMPT_PREFIX}${phone}`);
  await redis.expire(`${OTP_ATTEMPT_PREFIX}${phone}`, 600);

  if (attempts >= maxAttempts) {
    await redis.setex(`${OTP_LOCKOUT_PREFIX}${phone}`, lockoutMinutes * 60, '1');
    await redis.del(`${OTP_ATTEMPT_PREFIX}${phone}`);
    return { attempts, locked: true };
  }
  return { attempts, locked: false };
};

export const isOtpLocked = (phone: string): Promise<number> =>
  redis.exists(`${OTP_LOCKOUT_PREFIX}${phone}`);

// ── Rate limit helpers ────────────────────────────────────────────────────────

export const checkOtpRequestLimit = async (phone: string, max = 3, windowSeconds = 600): Promise<boolean> => {
  const key = `otp_req:${phone}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSeconds);
  return count > max;
};

// ── Session cache ─────────────────────────────────────────────────────────────

export const cacheSet = (key: string, value: string, ttlSeconds: number): Promise<'OK'> =>
  redis.setex(key, ttlSeconds, value);

export const cacheGet = (key: string): Promise<string | null> =>
  redis.get(key);

export const cacheDel = (key: string): Promise<number> =>
  redis.del(key);
