import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { AuthRequest } from '../../types';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { analyticsService } from './analytics.service';
import logger from '../../utils/logger';

const router = Router();
router.use(authenticate);

/**
 * GET /analytics/insights?months=6
 * Association insights for office-bearers. Contains unit-level arrears and
 * vendor detail, so it is restricted to management roles.
 */
router.get(
  '/insights',
  requireRoles(UserRole.TREASURER, UserRole.MANAGER, UserRole.COMMITTEE),
  async (req: AuthRequest, res, next) => {
    try {
      const months = parseInt((req.query['months'] as string) ?? '6', 10);
      res.json(await analyticsService.getInsights(req.user!.association_id, months));
    } catch (err: any) {
      // These are hand-written SQL queries; log the real database error so a
      // failure is diagnosable instead of surfacing as an opaque 500.
      logger.error('INSIGHTS QUERY FAILED', {
        message: err?.message,
        code: err?.code,
        meta: err?.meta,
      });
      next(err);
    }
  },
);

export default router;
