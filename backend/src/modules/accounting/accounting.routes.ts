import { Router } from 'express';
import multer from 'multer';
import { accountingController } from './accounting.controller';
import { journalController }    from './journal.controller';
import { bpMasterController }   from './bp-master.controller';
import { unitOBController }     from './unit-ob.controller';
import { authenticate }  from '../../middleware/auth';
import { requireRoles }  from '../../middleware/rbac';
import { UserRole }      from '@prisma/client';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();

const managerRoles = [UserRole.MANAGER, UserRole.TREASURER, UserRole.SUPER_USER];
const viewRoles    = [UserRole.MANAGER, UserRole.TREASURER, UserRole.COMMITTEE, UserRole.SUPER_USER];

router.use(authenticate);

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

// ── BP Master ─────────────────────────────────────────────────────────────────
router.get   ('/bp-masters',             requireRoles(...managerRoles), bpMasterController.list);
router.post  ('/bp-masters',             requireRoles(...managerRoles), bpMasterController.create);
router.patch ('/bp-masters/:id',         requireRoles(...managerRoles), bpMasterController.update);
router.patch ('/bp-masters/:id/toggle',  requireRoles(...managerRoles), bpMasterController.toggle);
router.delete('/bp-masters/:id',         requireRoles(...managerRoles), bpMasterController.delete);
router.get   ('/bp-masters/units',                requireRoles(...managerRoles), bpMasterController.listUnits);
router.get   ('/bp-masters/units/with-balances',  requireRoles(...managerRoles), unitOBController.listWithBalances);
router.get   ('/bp-masters/units/template',        requireRoles(...managerRoles), unitOBController.downloadTemplate);
router.post  ('/bp-masters/units/upload/preview',  requireRoles(...managerRoles), upload.single('file'), unitOBController.previewUpload);
router.post  ('/bp-masters/units/upload/apply',    requireRoles(...managerRoles), unitOBController.applyUpload);

// ── Journal Entries ───────────────────────────────────────────────────────────
router.get ('/journal',         requireRoles(...viewRoles),    journalController.list);
router.post('/journal',         requireRoles(...managerRoles), ...journalController.createManual);
router.get ('/journal/ledger',  requireRoles(...viewRoles),    journalController.getLedger);
router.get ('/journal/pnl',           requireRoles(...viewRoles), journalController.getPnL);
router.get ('/journal/balance-sheet', requireRoles(...viewRoles),    journalController.getBalanceSheet);
router.post('/journal/backfill',      requireRoles(...managerRoles), journalController.backfill);
router.patch('/journal/:id',          requireRoles(...managerRoles), ...journalController.updateEntry);

export default router;
