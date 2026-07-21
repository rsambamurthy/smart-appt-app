import { notificationQueue } from '../jobs/queue';
import { NotificationJob } from '../types';
import logger from '../utils/logger';

class NotificationService {
  async dispatch(job: NotificationJob): Promise<void> {
    try {
      await notificationQueue.add('dispatch', job, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
      });
    } catch (err) {
      logger.error('Failed to enqueue notification', { error: (err as Error).message, type: job.type });
    }
  }
}

export const notificationService = new NotificationService();
