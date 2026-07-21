import Bull from 'bull';

const redisUrl = process.env.REDIS_URL!;

const makeQueue = (name: string) =>
  new Bull(name, { redis: redisUrl, defaultJobOptions: { removeOnComplete: true, removeOnFail: false } });

export const notificationQueue = makeQueue('notifications');
export const reportQueue = makeQueue('reports');
export const billQueue = makeQueue('bills');
