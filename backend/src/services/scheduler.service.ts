import cron from 'node-cron';
import prisma from '../config/database';
import { duesService } from '../modules/dues/dues.service';
import logger from '../utils/logger';

export function initScheduler() {
  // Run every day at 00:05 to allow for any midnight DB/clock variance
  cron.schedule('5 0 * * *', async () => {
    const today = new Date().getDate(); // day of month, 1–31
    logger.info(`[Scheduler] Auto-generate check — looking for associations scheduled on day ${today}`);

    try {
      const configs = await prisma.duesConfig.findMany({
        where: { auto_generate_bills: true, auto_generate_day: today },
        select: { association_id: true },
      });

      if (configs.length === 0) {
        logger.info('[Scheduler] No associations scheduled for today.');
        return;
      }

      const now = new Date();
      const month = now.getMonth() + 1; // 1–12
      const year = now.getFullYear();

      logger.info(`[Scheduler] Generating bills for ${configs.length} association(s) — ${month}/${year}`);

      for (const config of configs) {
        try {
          await duesService.generateBills(config.association_id, { month, year });
          logger.info(`[Scheduler] ✓ Bills generated for association ${config.association_id}`);
        } catch (err) {
          // Likely bills already exist for this month — log and continue
          logger.warn(`[Scheduler] Skipped association ${config.association_id}: ${(err as Error).message}`);
        }
      }
    } catch (err) {
      logger.error('[Scheduler] Fatal error in auto-generate cron', { error: (err as Error).message });
    }
  });

  logger.info('[Scheduler] Bill auto-generation cron initialized — runs daily at 00:05');
}
