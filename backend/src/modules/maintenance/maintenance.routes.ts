import { Router } from 'express';
import multer from 'multer';
import { UserRole } from '@prisma/client';
import { maintenanceController } from './maintenance.controller';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import {
  createTicketSchema, assignTicketSchema, updateStatusSchema,
  feedbackSchema, listTicketsQuerySchema,
} from './maintenance.schema';

const router = Router();
router.use(authenticate);

// Multer: memory storage; swap for S3 multer-s3 in production
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 3, fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// POST /maintenance — all authenticated users can raise a service request (mobile: no role difference)
router.post(
  '/',
  upload.array('files', 3),
  validate(createTicketSchema),
  (req, res, next) => maintenanceController.create(req as never, res, next),
);

// GET /maintenance/dashboard
router.get('/dashboard', requireRoles(UserRole.MANAGER, UserRole.COMMITTEE), (req, res, next) =>
  maintenanceController.dashboard(req as never, res, next));

// GET /maintenance/my — all authenticated users can view their own tickets
router.get('/my', (req, res, next) =>
  maintenanceController.listMine(req as never, res, next));

// GET /maintenance
router.get(
  '/',
  requireRoles(UserRole.MANAGER, UserRole.COMMITTEE),
  validate(listTicketsQuerySchema, 'query'),
  (req, res, next) => maintenanceController.list(req as never, res, next),
);

// GET /maintenance/:id
router.get('/:id', (req, res, next) =>
  maintenanceController.getOne(req as never, res, next));

// PATCH /maintenance/:id/assign
router.patch(
  '/:id/assign',
  requireRoles(UserRole.MANAGER),
  validate(assignTicketSchema),
  (req, res, next) => maintenanceController.assign(req as never, res, next),
);

// PATCH /maintenance/:id/status
router.patch(
  '/:id/status',
  requireRoles(UserRole.MANAGER, UserRole.GATE_STAFF),
  validate(updateStatusSchema),
  (req, res, next) => maintenanceController.updateStatus(req as never, res, next),
);

// POST /maintenance/:id/feedback — all authenticated users can submit feedback
router.post(
  '/:id/feedback',
  validate(feedbackSchema),
  (req, res, next) => maintenanceController.feedback(req as never, res, next),
);

export default router;
