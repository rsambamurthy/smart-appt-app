import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { integrationsController } from './integrations.controller';
import { authenticate } from '../../middleware/auth';
import { requireMenuFeature } from '../../middleware/menu-access';
import { validate } from '../../middleware/validate';
import { createApiKeySchema } from './integrations.schema';

const router = Router();
router.use(authenticate);

// Manager-only, same posture as every other System admin screen (Web Menu,
// Mobile Menu, Audit Trail) — gated through the Web Menu by Role config via
// requireMenuFeature so a Manager can further restrict or delegate it later,
// with today's coded default (Manager only) preserved until they do.
router.get('/api-keys', requireMenuFeature('system_integration_keys', UserRole.MANAGER), (req, res, next) =>
  integrationsController.list(req as never, res, next));

router.post('/api-keys', requireMenuFeature('system_integration_keys', UserRole.MANAGER), validate(createApiKeySchema), (req, res, next) =>
  integrationsController.create(req as never, res, next));

router.post('/api-keys/:id/revoke', requireMenuFeature('system_integration_keys', UserRole.MANAGER), (req, res, next) =>
  integrationsController.revoke(req as never, res, next));

export default router;
