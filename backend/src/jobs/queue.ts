import Bull from 'bull';
import logger from '../utils/logger';

const redisUrl = process.env.REDIS_URL;

const makeQueue = (name: string): Bull.Queue => {
  if (!redisUrl) {
    // Redis not configured — return a no-op stub so Bull never initialises
    logger.warn(`REDIS_URL not set — queue "${name}" is disabled`);
    return {
      add: async () => null,
      process: () => {},
      on: () => ({} as Bull.Queue),
      close: async () => {},
    } as unknown as Bull.Queue;
  }

  const q = new Bull(name, redisUrl, {
    defaultJobOptions: { removeOnComplete: true, removeOnFail: false },
  });

  // Prevent unhandled error events from crashing the Node process
  q.on('error', (err) => {
    logger.error(`Bull queue "${name}" error`, { message: err.message });
  });

  return q;
};

export const notificationQueue = makeQueue('notifications');
export const reportQueue     = makeQueue('reports');
export const billQueue       = makeQueue('bills');
