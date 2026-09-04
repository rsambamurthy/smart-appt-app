// Guard against any unhandled rejections / exceptions crashing the server
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
  // log but do NOT exit — healthcheck must keep responding
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

import 'dotenv/config';
import { httpServer } from './app';
import prisma from './config/database';
import redis from './config/redis';
import logger from './utils/logger';
import cron from 'node-cron';
import { initScheduler } from './services/scheduler.service';
import { notificationQueue } from './jobs/queue';
import { processNotificationJob } from './jobs/workers/notification-dispatcher';
import { runRecurringExpensePoller } from './jobs/workers/recurring-expense-poller';
import { runExpenseProvisioner } from './jobs/workers/expense-provisioner';
import { runDuesReminder } from './jobs/workers/dues-reminder';
import { runSlaBreachChecker } from './jobs/workers/sla-breach-checker';
import { runVisitorQrExpiry } from './jobs/workers/visitor-qr-expiry';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

// ── Notification queue consumer ────────────────────────────────────────────
//
// This used to run ONLY in a separate `npm run worker` process
// (jobs/worker-entry.ts) — a process that Railway never actually had a
// service for. Every notification (bills, payments, announcements, and now
// chat) has been enqueuing into Redis since the day that file was written,
// with nothing ever consuming the queue: the job just sat there. A user
// would only ever see a message by opening the app and fetching it directly,
// never as a push, which is exactly the symptom that surfaced this.
//
// Bull queues support multiple concurrent consumers safely — a job is
// claimed by whichever consumer picks it up first, never processed twice —
// so this is harmless to run alongside a dedicated worker service if one is
// ever added later.
notificationQueue.process('dispatch', 5, processNotificationJob);
notificationQueue.on('failed', (job, err) =>
  logger.error('Notification job failed', { job_id: job?.id, error: err.message }));

// ── Cron jobs (recurring expenses, dues reminders, SLA, visitor QR) ─────────
//
// Same root cause as the notification queue above: these lived ONLY in
// jobs/worker-entry.ts, a `npm run worker` process Railway never had a
// service for, so they have never actually run — a recurring expense's
// "next due" date just sits there forever, dues reminders never go out,
// breached SLAs are never flagged, expired visitor QR codes never get
// marked expired. Wiring them into this process (the only one Railway
// deploys) fixes that, the same way the queue consumer above was fixed.
//
// NOT included: runBillGenerator (jobs/workers/bill-generator.ts). It
// overlaps with services/scheduler.service.ts's own bill-generation cron
// below (initScheduler) on a different trigger (`due_day` on every config,
// vs. opt-in `auto_generate_bills`+`auto_generate_day`) — running both risks
// generating duplicate bills for associations that satisfy both. Needs
// reconciling into one code path before it's safe to enable.
cron.schedule('0 6 * * *', () =>
  runRecurringExpensePoller().catch((err) => logger.error('Recurring expense poller error', { error: err.message })));
cron.schedule('30 23 * * *', () =>
  runExpenseProvisioner().catch((err) => logger.error('Expense provisioner error', { error: err.message })));
cron.schedule('0 9 * * *', () =>
  runDuesReminder().catch((err) => logger.error('Dues reminder error', { error: err.message })));
cron.schedule('*/15 * * * *', () =>
  runSlaBreachChecker().catch((err) => logger.error('SLA breach checker error', { error: err.message })));
cron.schedule('0 * * * *', () =>
  runVisitorQrExpiry().catch((err) => logger.error('Visitor QR expiry error', { error: err.message })));

const start = async () => {
  // Start listening FIRST — health check must respond immediately
  await new Promise<void>((resolve) => {
    httpServer.listen(PORT, () => {
      logger.info(`API server running on port ${PORT}`, { env: process.env.NODE_ENV });
      resolve();
    });
  });

  // Connect to DB — log failure but don't crash
  try {
    await prisma.$connect();
    logger.info('Database connected');
  } catch (err: any) {
    logger.error('Database connection failed', { error: err.message });
  }

  // ── Audit trail self-test ──────────────────────────────────────────────────
  // Audit writes are intentionally non-fatal, which means a broken audit table
  // fails silently. This writes one row at boot and reports the outcome loudly,
  // so a misconfiguration is obvious in the deploy log instead of invisible.
  try {
    const before = await prisma.auditLog.count();
    await prisma.auditLog.create({
      data: {
        entity_type: 'system',
        action: 'CREATE',
        summary: `Backend started (${process.env.NODE_ENV ?? 'unknown'})`,
      },
    });
    const after = await prisma.auditLog.count();
    logger.info(`AUDIT SELF-TEST OK — audit_logs rows: ${before} -> ${after}`);
  } catch (err: any) {
    logger.error('AUDIT SELF-TEST FAILED — audit trail is NOT recording', {
      error: err?.message ?? String(err),
      code: err?.code,
      meta: err?.meta,
    });
  }

  // Initialize scheduled jobs
  initScheduler();

  // Connect to Redis explicitly (lazyConnect: true means no auto-connect at import)
  try {
    await redis.connect();
    logger.info('Redis connected');
  } catch (err: any) {
    // Already connected (EISCONN) is fine; log anything else
    if ((err as any).message?.includes('EISCONN')) {
      logger.info('Redis already connected');
    } else {
      logger.error('Redis connection failed', { error: err.message });
    }
  }
};

const shutdown = async () => {
  logger.info('Shutting down...');
  httpServer.close();
  await prisma.$disconnect();
  try { await redis.quit(); } catch { /* ignore */ }
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start().catch((err) => {
  logger.error('Failed to start server', { error: err.message });
  process.exit(1);
});
