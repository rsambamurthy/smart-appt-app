import { Router } from 'express';
import { accountingController } from './accounting.controller';
import { authenticate } from '../../middleware/authenticate';
import { requireRoles } from '../../middleware/requireRoles';
import { UserRole } from '@prisma/client';

const router = Router();

const managerRoles = [UserRole.MANAGER, UserRole.TREASURER, UserRole.SUPER_USER];

router.use(authenticate);

// Chart of Accounts
router.get  ('/accounts',              requireRoles(...managerRoles), accountingController.listAccounts);
router.post ('/accounts/seed',         requireRoles(...managerRoles), accountingController.seedDefaults);
router.post ('/accounts',              requireRoles(...managerRoles), ...accountingController.createAccount);
router.patch('/accounts/:id',          requireRoles(...managerRoles), ...accountingController.updateAccount);
router.patch('/accounts/:id/toggle',   requireRoles(...managerRoles), accountingController.toggleActive);
router.delete('/accounts/:id',         requireRoles(...managerRoles), accountingController.deleteAccount);

export default router;
