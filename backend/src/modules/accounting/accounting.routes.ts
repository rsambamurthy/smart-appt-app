import { Router } from 'express';
import multer from 'multer';
import { accountingController }  from './accounting.controller';
import { journalController }     from './journal.controller';
import { bpMasterController }    from './bp-master.controller';
import { unitOBController }      from './unit-ob.controller';
import { serviceTypeController }  from './service-type.controller';
import { vendorUploadController } from './vendor-upload.controller';
import { bankUploadController }   from './bank-upload.controller';
import { fyClosureController }    from './fy-closure.controller';
import { authenticate }  from '../../middleware/auth';
import { requireRoles }  from '../../middleware/rbac';
import { requireModule, requireModuleFull } from '../../middleware/entitlement';
import { UserRole, ModuleKey } from '@prisma/client';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();

const managerRoles = [UserRole.MANAGER, UserRole.TREASURER, UserRole.SUPER_USER];
const viewRoles    = [UserRole.MANAGER, UserRole.TREASURER, UserRole.COMMITTEE, UserRole.SUPER_USER];

router.use(authenticate);

// Accounting is a paid module. Applied at the router so every endpoint below
// is covered — including any added later, which is the point of putting it
// here rather than on each route. Reads still work for a lapsed subscription;
// writes return 402.
router.use(requireModule(ModuleKey.ACCOUNTING));

// ── Chart of Accounts ─────────────────────────────────────────────────────────
router.get   ('/accounts',             requireRoles(...managerRoles), accountingController.listAccounts);
router.post  ('/accounts/seed',        requireRoles(...managerRoles), accountingController.seedDefaults);
router.post  ('/accounts',             requireRoles(...managerRoles), ...accountingController.createAccount);
router.patch ('/accounts/:id',         requireRoles(...managerRoles), ...accountingController.updateAccount);
router.patch ('/accounts/:id/toggle',  requireRoles(...managerRoles), accountingController.toggleActive);
router.delete('/accounts/:id',         requireRoles(...managerRoles), accountingController.deleteAccount);

// ── BP Types ──────────────────────────────────────────────────────────────────
router.get   ('/bp-types',          requireRoles(...managerRoles), accountingController.listBPTypes);
router.post  ('/bp-types',          requireRoles(...managerRoles), accountingController.createBPType);
router.patch ('/bp-types/:id/toggle', requireRoles(...managerRoles), accountingController.toggleBPType);

// ── Vendor Service Types ───────────────────────────────────────────────────────
router.get   ('/service-types',             requireRoles(...managerRoles), serviceTypeController.list);
router.post  ('/service-types',             requireRoles(...managerRoles), serviceTypeController.create);
router.patch ('/service-types/:id',         requireRoles(...managerRoles), serviceTypeController.update);
router.patch ('/service-types/:id/toggle',  requireRoles(...managerRoles), serviceTypeController.toggle);
router.delete('/service-types/:id',         requireRoles(...managerRoles), serviceTypeController.delete);

// ── BP Master ─────────────────────────────────────────────────────────────────
router.get   ('/bp-masters',             requireRoles(...managerRoles), bpMasterController.list);
router.post  ('/bp-masters',             requireRoles(...managerRoles), bpMasterController.create);
router.patch ('/bp-masters/:id',         requireRoles(...managerRoles), bpMasterController.update);
router.patch ('/bp-masters/:id/toggle',  requireRoles(...managerRoles), bpMasterController.toggle);
router.delete('/bp-masters/:id',         requireRoles(...managerRoles), bpMasterController.delete);
router.get   ('/bp-masters/units',                requireRoles(...managerRoles), bpMasterController.listUnits);
router.get   ('/bp-masters/units/with-balances',  requireRoles(...managerRoles), unitOBController.listWithBalances);
router.get   ('/bp-masters/units/template',        requireModuleFull(ModuleKey.ACCOUNTING), requireRoles(...managerRoles), unitOBController.downloadTemplate);
router.post  ('/bp-masters/units/upload/preview',  requireRoles(...managerRoles), upload.single('file'), unitOBController.previewUpload);
router.post  ('/bp-masters/units/upload/apply',    requireRoles(...managerRoles), unitOBController.applyUpload);

// ── Vendor Bulk Upload ────────────────────────────────────────────────────────
router.get ('/vendors/template',        requireModuleFull(ModuleKey.ACCOUNTING), requireRoles(...managerRoles), vendorUploadController.downloadTemplate);
router.post('/vendors/upload/preview',  requireRoles(...managerRoles), upload.single('file'), vendorUploadController.previewUpload);
router.post('/vendors/upload/apply',    requireRoles(...managerRoles), vendorUploadController.applyUpload);

// ── Bank Bulk Upload ──────────────────────────────────────────────────────────
router.get ('/banks/template',        requireModuleFull(ModuleKey.ACCOUNTING), requireRoles(...managerRoles), bankUploadController.downloadTemplate);
router.post('/banks/upload/preview',  requireRoles(...managerRoles), upload.single('file'), bankUploadController.previewUpload);
router.post('/banks/upload/apply',    requireRoles(...managerRoles), bankUploadController.applyUpload);

// ── Financial Year Config & Closure ───────────────────────────────────────────
router.get  ('/fy/config',    requireRoles(...viewRoles),    fyClosureController.getConfig);
router.patch('/fy/config',    requireRoles(...managerRoles), fyClosureController.updateConfig);
router.get  ('/fy/list',      requireRoles(...viewRoles),    fyClosureController.listFYs);
router.get  ('/fy/preview',   requireRoles(...managerRoles), fyClosureController.previewClosure);
router.post ('/fy/close',     requireRoles(...managerRoles), fyClosureController.closeFY);
router.post ('/fy/reopen',    requireRoles(...managerRoles), fyClosureController.reopenFY);

// ── Journal Entries ───────────────────────────────────────────────────────────
router.get ('/journal',         requireRoles(...viewRoles),    journalController.list);
router.post('/journal',         requireRoles(...managerRoles), ...journalController.createManual);
router.get ('/journal/ledger',     requireModuleFull(ModuleKey.ACCOUNTING), requireRoles(...viewRoles), journalController.getLedger);
router.get ('/journal/ledger/all', requireModuleFull(ModuleKey.ACCOUNTING), requireRoles(...viewRoles), journalController.getAllLedger);
router.get ('/journal/ledger/sub', requireModuleFull(ModuleKey.ACCOUNTING), requireRoles(...viewRoles), journalController.getSubLedger);
router.get ('/journal/pnl',           requireModuleFull(ModuleKey.ACCOUNTING), requireRoles(...viewRoles), journalController.getPnL);
router.get ('/journal/balance-sheet', requireModuleFull(ModuleKey.ACCOUNTING), requireRoles(...viewRoles),    journalController.getBalanceSheet);
router.get ('/journal/trial-balance', requireModuleFull(ModuleKey.ACCOUNTING), requireRoles(...viewRoles),    journalController.getTrialBalance);
router.get ('/journal/day-book',      requireModuleFull(ModuleKey.ACCOUNTING), requireRoles(...viewRoles),    journalController.getDayBook);
router.get ('/journal/cash-book',     requireModuleFull(ModuleKey.ACCOUNTING), requireRoles(...viewRoles),    journalController.getCashBook);
router.get ('/journal/receipts-payments', requireModuleFull(ModuleKey.ACCOUNTING), requireRoles(...viewRoles), journalController.getReceiptsAndPayments);
router.get ('/journal/income-expenditure', requireModuleFull(ModuleKey.ACCOUNTING), requireRoles(...viewRoles), journalController.getIncomeExpenditure);
router.post('/journal/backfill',         requireRoles(...managerRoles), journalController.backfill);
router.post('/journal/backfill-bp-tags', requireRoles(...managerRoles), journalController.backfillBPTags);
// Supporting document for a voucher — invoice, receipt, bank slip.
router.post  ('/journal/:id/attachment', requireRoles(...managerRoles), upload.single('file'), journalController.uploadAttachment);
router.get   ('/journal/:id/attachment', requireModuleFull(ModuleKey.ACCOUNTING), requireRoles(...viewRoles),    journalController.downloadAttachment);
router.delete('/journal/:id/attachment', requireRoles(...managerRoles), journalController.deleteAttachment);

router.patch('/journal/:id',          requireRoles(...managerRoles), ...journalController.updateEntry);

export default router;
