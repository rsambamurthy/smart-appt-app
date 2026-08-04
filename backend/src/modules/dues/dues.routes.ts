import { Router } from 'express';
import multer from 'multer';
import { UserRole } from '@prisma/client';
import { duesController } from './dues.controller';
import { statementService } from './statement.service';
import { AuthRequest } from '../../types';
import { NotFoundError } from '../../utils/errors';
import { paymentUploadController } from './payment-upload.controller';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import {
  duesConfigSchema, generateBillsSchema, rollbackBillsSchema, offlinePaymentSchema,
  initiatePaymentSchema, createLevySchema,
  oneTimeDueSchema, updateOneTimeDueSchema, generateOneTimeDueBillsSchema,
} from './dues.schema';
const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const treasurerOrManagerRoles = [UserRole.SUPER_USER, UserRole.TREASURER, UserRole.MANAGER];

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

// All authenticated users can view their own bills (mobile app — no role difference)
router.get('/bills/my', (req, res, next) =>
  duesController.listMyBills(req as never, res, next));

// All authenticated users can initiate/verify payments for their own bills
router.post('/payments/initiate', validate(initiatePaymentSchema), (req, res, next) =>
  duesController.initiatePayment(req as never, res, next));

router.post('/payments/verify', (req, res, next) =>
  duesController.verifyPayment(req as never, res, next));

router.post('/payments/offline', requireRoles(UserRole.TREASURER, UserRole.MANAGER), validate(offlinePaymentSchema), (req, res, next) =>
  duesController.offlinePayment(req as never, res, next));

// ── Bulk Payment Upload ───────────────────────────────────────────────────────
router.get('/payments/upload/template', requireRoles(...treasurerOrManagerRoles), (req, res, next) =>
  paymentUploadController.downloadTemplate(req, res, next));

router.post('/payments/upload/preview', requireRoles(...treasurerOrManagerRoles), upload.single('file'), (req, res, next) =>
  paymentUploadController.previewUpload(req as never, res, next));

router.post('/payments/upload/apply', requireRoles(...treasurerOrManagerRoles), (req, res, next) =>
  paymentUploadController.applyUpload(req as never, res, next));

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


// ── Statement of account ──────────────────────────────────────────────────────
//
// The most-asked resident question: what do I owe, and why. A running balance
// of every charge and every payment, which a bare arrears figure cannot give.

/** Every flat's balance as at a date — the arrears list. */
router.get('/statement', requireRoles(...treasurerOrManagerRoles), async (req: AuthRequest, res, next) => {
  try {
    res.json(await statementService.summary(
      req.user!.association_id, req.query['as_of'] as string,
    ));
  } catch (err) { next(err); }
});

/**
 * One flat's statement.
 *
 * A resident may fetch their own; a treasurer or manager may fetch any. The
 * check is here rather than in the service because it is about who is asking,
 * not about the data.
 */
router.get('/statement/:unitId', async (req: AuthRequest, res, next) => {
  try {
    const unitId = req.params['unitId'] as string;
    const privileged = req.user!.role === UserRole.TREASURER
                    || req.user!.role === UserRole.MANAGER
                    || req.user!.role === UserRole.COMMITTEE
                    || req.user!.role === UserRole.SUPER_USER;

    if (!privileged && req.user!.unit_id !== unitId) {
      // 404 rather than 403: confirming the flat exists tells someone probing
      // more than they should learn.
      return next(new NotFoundError('Unit'));
    }

    res.json(await statementService.forUnit(req.user!.association_id, unitId, {
      from: req.query['from'] as string,
      to:   req.query['to'] as string,
    }));
  } catch (err) { next(err); }
});

export default router;
