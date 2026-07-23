import { Router } from 'express';
import { accountingController } from './accounting.controller';
import { journalController }    from './journal.controller';
import { authenticate }  from '../../middleware/auth';
import { requireRoles }  from '../../middleware/rbac';
import { UserRole }      from '@prisma/client';

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

// ── Journal Entries ───────────────────────────────────────────────────────────
router.get ('/journal',         requireRoles(...viewRoles),    journalController.list);
router.post('/journal',         requireRoles(...managerRoles), ...journalController.createManual);
router.get ('/journal/ledger',  requireRoles(...viewRoles),    journalController.getLedger);
router.get ('/journal/pnl',           requireRoles(...viewRoles), journalController.getPnL);
router.get ('/journal/balance-sheet', requireRoles(...viewRoles),    journalController.getBalanceSheet);
router.post('/journal/backfill',      requireRoles(...managerRoles), journalController.backfill);

export default router;
