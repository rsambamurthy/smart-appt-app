import 'dotenv/config';
import cron from 'node-cron';
import { notificationQueue } from './queue';
import { processNotificationJob } from './workers/notification-dispatcher';
import { runBillGenerator } from './workers/bill-generator';
import { runSlaBreachChecker } from './workers/sla-breach-checker';
import { runDuesReminder } from './workers/dues-reminder';
import { runRecurringExpensePoller } from './workers/recurring-expense-poller';
import { runExpenseProvisioner } from './workers/expense-provisioner';
import { runVisitorQrExpiry } from './workers/visitor-qr-expiry';
import prisma from '../config/database';
import redis from '../config/redis';
import logger from '../utils/logger';

// ── Bull queue processor ──────────────────────────────────────────────────────
notificationQueue.process('dispatch', 5, processNotificationJob);
notificationQueue.on('failed', (job, err) => logger.error('Notification job failed', { job_id: job.id, error: err.message }));
logger.info('Notification worker started');

// ── Cron jobs ─────────────────────────────────────────────────────────────────
cron.schedule('0 7 * * *', () => runBillGenerator().catch((e) => logger.error('Bill generator error', { error: e.message })));
cron.schedule('0 9 * * *', () => runDuesReminder().catch((e) => logger.error('Dues reminder error', { error: e.message })));
cron.schedule('*/15 * * * *', () => runSlaBreachChecker().catch((e) => logger.error('SLA checker error', { error: e.message })));
cron.schedule('0 6 * * *', () => runRecurringExpensePoller().catch((e) => logger.error('Recurring expense error', { error: e.message })));
// 23:30 daily — the job itself is a no-op on every day except the last of
// the month, same shape as runRecurringExpensePoller's daily "is anything
// due" query.
cron.schedule('30 23 * * *', () => runExpenseProvisioner().catch((e) => logger.error('Expense provisioner error', { error: e.message })));
cron.schedule('0 * * * *', () => runVisitorQrExpiry().catch((e) => logger.error('Visitor QR expiry error', { error: e.message })));

logger.info('All cron jobs scheduled');

// Graceful shutdown
const shutdown = async () => {
  logger.info('Worker shutting down');
  await notificationQueue.close();
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
