import { Router } from 'express';
import multer from 'multer';
import { UserRole } from '@prisma/client';
import { duesController } from './dues.controller';
import { statementService } from './statement.service';
import { penaltyService } from './penalty.service';
import { upiService } from './upi.service';
import { AuthRequest } from '../../types';
import { NotFoundError, UnprocessableError } from '../../utils/errors';
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


// ── Late-payment penalties ────────────────────────────────────────────────────
//
// Charging and reversing are both treasurer/manager work. Nothing here is
// exposed to a resident: a resident sees the result on their statement, which
// is the honest place for it.

/** What would be charged if the run were applied now. Charges nothing. */
router.get('/penalties/preview', requireRoles(...treasurerOrManagerRoles), async (req: AuthRequest, res, next) => {
  try {
    res.json(await penaltyService.preview(
      req.user!.association_id, req.query['as_of'] as string,
    ));
  } catch (err) { next(err); }
});

/** Charge the listed bills. Omission is how the review screen excludes a flat. */
router.post('/penalties/apply', requireRoles(...treasurerOrManagerRoles), async (req: AuthRequest, res, next) => {
  try {
    const billIds = req.body?.bill_ids;
    if (!Array.isArray(billIds) || billIds.some((b: unknown) => typeof b !== 'string')) {
      throw new UnprocessableError('Select at least one bill to charge.');
    }
    res.json(await penaltyService.apply(
      req.user!.association_id, req.user!.id, billIds, req.body?.as_of,
    ));
  } catch (err) { next(err); }
});

/** Every penalty on one flat, charged and waived alike. */
router.get('/penalties/unit/:unitId', requireRoles(...treasurerOrManagerRoles), async (req: AuthRequest, res, next) => {
  try {
    res.json(await penaltyService.history(
      req.user!.association_id, req.params['unitId'] as string,
    ));
  } catch (err) { next(err); }
});

/** Reverse one penalty in full. The reason is not optional. */
router.post('/penalties/:id/waive', async (req: AuthRequest, res, next) => {
  try {
    // The role check lives in the service: it is part of the rule, not part of
    // the routing, and the service is what the test harness will call.
    res.json(await penaltyService.waive(
      req.user!.association_id, req.user!.id, req.user!.role,
      req.params['id'] as string, req.body?.reason ?? '',
    ));
  } catch (err) { next(err); }
});


// ── Pay by UPI ────────────────────────────────────────────────────────────────
//
// The app can open PhonePe/GPay but never learns whether the money moved. So a
// resident lodges a CLAIM with the UTR their app showed them, and a treasurer
// confirms it against the bank. Only confirmation creates a payment.

/** Is UPI set up, and who is the payee. Any signed-in user. */
router.get('/upi/config', async (req: AuthRequest, res, next) => {
  try { res.json(await upiService.config(req.user!.association_id)); }
  catch (err) { next(err); }
});

/** Bank accounts that could collect UPI, and which one is selected. */
router.get('/upi/accounts', requireRoles(...treasurerOrManagerRoles), async (req: AuthRequest, res, next) => {
  try { res.json(await upiService.collectionAccounts(req.user!.association_id)); }
  catch (err) { next(err); }
});

/** Set the UPI ID and payee name on one bank account. */
router.put('/upi/accounts/:bpId', requireRoles(...treasurerOrManagerRoles), async (req: AuthRequest, res, next) => {
  try {
    res.json(await upiService.saveBankUpi(
      req.user!.association_id, req.params['bpId'] as string, req.body ?? {}, req.user!.id,
    ));
  } catch (err) { next(err); }
});

/** Choose which bank account collects dues by UPI. */
router.put('/upi/config', requireRoles(...treasurerOrManagerRoles), async (req: AuthRequest, res, next) => {
  try {
    res.json(await upiService.selectCollectionAccount(
      req.user!.association_id, req.body?.bank_bp_id ?? null, req.user!.id,
    ));
  } catch (err) { next(err); }
});

/** The deep link for one bill. Residents get their own flat's bills only. */
router.get('/upi/intent/:billId', async (req: AuthRequest, res, next) => {
  try {
    res.json(await upiService.intentForBill(
      req.user!.association_id, req.params['billId'] as string,
      req.user!.id, req.user!.role,
    ));
  } catch (err) { next(err); }
});

/** "I have paid." Settles nothing on its own. */
router.post('/upi/claims', async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await upiService.claim(
      req.user!.association_id, req.user!.id, req.user!.role, req.body ?? {},
    ));
  } catch (err) { next(err); }
});

/** A resident's own claims, for showing "Paid, to be confirmed". */
router.get('/upi/claims/mine', async (req: AuthRequest, res, next) => {
  try {
    res.json(await upiService.myClaims(req.user!.association_id, req.user!.unit_id ?? null));
  } catch (err) { next(err); }
});

/** The treasurer's queue. */
router.get('/upi/claims', requireRoles(...treasurerOrManagerRoles), async (req: AuthRequest, res, next) => {
  try {
    const status = req.query['status'] as string | undefined;
    res.json(await upiService.pending(
      req.user!.association_id,
      (status as never) ?? undefined,
    ));
  } catch (err) { next(err); }
});

router.post('/upi/claims/:id/confirm', async (req: AuthRequest, res, next) => {
  try {
    // Role checked in the service: it is part of the rule, not the routing,
    // and the service is what a test harness calls.
    res.json(await upiService.confirm(
      req.user!.association_id, req.user!.id, req.user!.role, req.params['id'] as string,
    ));
  } catch (err) { next(err); }
});

router.post('/upi/claims/:id/reject', async (req: AuthRequest, res, next) => {
  try {
    res.json(await upiService.reject(
      req.user!.association_id, req.user!.id, req.user!.role,
      req.params['id'] as string, req.body?.note ?? '',
    ));
  } catch (err) { next(err); }
});

export default router;
