import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { duesController } from './dues.controller';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import {
  duesConfigSchema, generateBillsSchema, rollbackBillsSchema, offlinePaymentSchema,
  initiatePaymentSchema, createLevySchema,
  oneTimeDueSchema, updateOneTimeDueSchema, generateOneTimeDueBillsSchema,
} from './dues.schema';
import feeConfigRoutes from './fee-config.routes';

const router = Router();

// ── Fee Config ───────────────────────────────────────────────────────────────
router.use('/fee-configs', feeConfigRoutes);

// Razorpay webhook — no auth, raw body
router.post('/payments/webhook', (req, res, next) =>
  duesController.webhook(req, res, next));

router.use(authenticate);

router.get('/config', requireRoles(UserRole.TREASURER), (req, res, next) =>
  duesController.getConfig(req as never, res, next));

router.put('/config', requireRoles(UserRole.TREASURER), validate(duesConfigSchema), (req, res, next) =>
  duesController.upsertConfig(req as never, res, next));

router.get('/razorpay-config', requireRoles(UserRole.TREASURER), (req, res, next) =>
  duesController.getRazorpayConfig(req as never, res, next));

router.put('/razorpay-config', requireRoles(UserRole.TREASURER), (req, res, next) =>
  duesController.saveRazorpayConfig(req as never, res, next));

router.post('/bills/generate', requireRoles(UserRole.TREASURER, UserRole.MANAGER), validate(generateBillsSchema), (req, res, next) =>
  duesController.generateBills(req as never, res, next));

router.post('/bills/rollback', requireRoles(UserRole.TREASURER, UserRole.MANAGER), validate(rollbackBillsSchema), (req, res, next) =>
  duesController.rollbackBills(req as never, res, next));

router.get('/bills', requireRoles(UserRole.TREASURER, UserRole.COMMITTEE, UserRole.MANAGER), (req, res, next) =>
  duesController.listBills(req as never, res, next));

router.get('/bills/my', requireRoles(UserRole.RESIDENT), (req, res, next) =>
  duesController.listMyBills(req as never, res, next));

router.post('/payments/initiate', requireRoles(UserRole.RESIDENT), validate(initiatePaymentSchema), (req, res, next) =>
  duesController.initiatePayment(req as never, res, next));

router.post('/payments/verify', requireRoles(UserRole.RESIDENT), (req, res, next) =>
  duesController.verifyPayment(req as never, res, next));

router.post('/payments/offline', requireRoles(UserRole.TREASURER, UserRole.MANAGER), validate(offlinePaymentSchema), (req, res, next) =>
  duesController.offlinePayment(req as never, res, next));

router.get('/arrears', requireRoles(UserRole.TREASURER, UserRole.COMMITTEE, UserRole.MANAGER), (req, res, next) =>
  duesController.arrears(req as never, res, next));

router.post('/levy', requireRoles(UserRole.TREASURER, UserRole.MANAGER), validate(createLevySchema), (req, res, next) =>
  duesController.createLevy(req as never, res, next));

router.get('/dashboard', requireRoles(UserRole.TREASURER, UserRole.COMMITTEE, UserRole.MANAGER, UserRole.RESIDENT), (req, res, next) =>
  duesController.dashboard(req as never, res, next));


// ── One-Time Dues ────────────────────────────────────────────────────────────
const treasurerOrManager = requireRoles(UserRole.TREASURER, UserRole.MANAGER);
const treasurerOrCommittee = requireRoles(UserRole.TREASURER, UserRole.COMMITTEE, UserRole.MANAGER);

router.get('/one-time-dues', treasurerOrCommittee, (req, res, next) =>
  duesController.listOneTimeDues(req as never, res, next));

router.post('/one-time-dues', treasurerOrManager, validate(oneTimeDueSchema), (req, res, next) =>
  duesController.createOneTimeDue(req as never, res, next));

router.get('/one-time-dues/:id', treasurerOrCommittee, (req, res, next) =>
  duesController.getOneTimeDue(req as never, res, next));

router.patch('/one-time-dues/:id', treasurerOrManager, validate(updateOneTimeDueSchema), (req, res, next) =>
  duesController.updateOneTimeDue(req as never, res, next));

router.delete('/one-time-dues/:id', treasurerOrManager, (req, res, next) =>
  duesController.deleteOneTimeDue(req as never, res, next));

router.post('/one-time-dues/:id/generate-bills', treasurerOrManager, validate(generateOneTimeDueBillsSchema), (req, res, next) =>
  duesController.generateOneTimeDueBills(req as never, res, next));

router.delete('/one-time-dues/:id/bills', requireRoles(UserRole.TREASURER), (req, res, next) =>
  duesController.deleteOneTimeDueBills(req as never, res, next));

router.post('/one-time-dues/:id/close', treasurerOrManager, (req, res, next) =>
  duesController.closeOneTimeDue(req as never, res, next));

export default router;
