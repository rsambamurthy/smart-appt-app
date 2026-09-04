import 'dotenv/config';
import cron from 'node-cron';
import { notificationQueue } from './queue';
import { processNotificationJob } from './workers/notification-dispatcher';
import { runBillGenerator } from './workers/bill-generator';
import prisma from '../config/database';
import redis from '../config/redis';
import logger from '../utils/logger';

// ── Bull queue processor ──────────────────────────────────────────────────────
// Harmless to run alongside src/index.ts's own consumer of the same queue —
// Bull guarantees a job is claimed by whichever consumer picks it up first,
// never processed twice.
notificationQueue.process('dispatch', 5, processNotificationJob);
notificationQueue.on('failed', (job, err) => logger.error('Notification job failed', { job_id: job.id, error: err.message }));
logger.info('Notification worker started');

// ── Cron jobs ─────────────────────────────────────────────────────────────────
//
// runDuesReminder, runSlaBreachChecker, runRecurringExpensePoller and
// runExpenseProvisioner moved to src/index.ts (see the comment there) —
// Railway has never run this file as its own service, so scheduling them
// only here meant they never ran at all. They are deliberately NOT
// re-registered below: if this file ever IS deployed as a separate service
// alongside the main API, duplicating them here would double-fire — extra
// draft expenses, duplicate accrual entries, duplicate reminder pushes.
//
// runBillGenerator is left registered here (and nowhere else) since it's
// currently dead code on either path — see the "NOT included" note in
// src/index.ts for why it isn't safe to turn on yet.
cron.schedule('0 7 * * *', () => runBillGenerator().catch((e) => logger.error('Bill generator error', { error: e.message })));

logger.info('Cron jobs scheduled (see comment above for what intentionally is NOT registered here)');

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
