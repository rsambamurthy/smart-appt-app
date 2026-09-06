import { Router } from 'express';
import multer from 'multer';
import { UserRole } from '@prisma/client';
import { expensesController } from './expenses.controller';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { requireMenuFeature } from '../../middleware/menu-access';
import { requireRolesOrApiKeyScope } from '../../middleware/api-key-scope';
import { validate } from '../../middleware/validate';
import {
  createExpenseSchema, approveExpenseSchema, setBudgetSchema,
  recurringExpenseSchema, categoryConfigSchema, updateCategoryConfigSchema,
} from './expenses.schema';

const router = Router();
router.use(authenticate);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ── Category Config ──────────────────────────────────────────────────────────
router.get('/categories', requireRoles(UserRole.TREASURER, UserRole.COMMITTEE, UserRole.MANAGER, UserRole.RESIDENT), (req, res, next) =>
  expensesController.listCategories(req as never, res, next));

router.post('/categories', requireRoles(UserRole.TREASURER, UserRole.MANAGER), validate(categoryConfigSchema), (req, res, next) =>
  expensesController.createCategory(req as never, res, next));

router.patch('/categories/:id', requireRoles(UserRole.TREASURER, UserRole.MANAGER), validate(updateCategoryConfigSchema), (req, res, next) =>
  expensesController.updateCategory(req as never, res, next));

router.delete('/categories/:id', requireRoles(UserRole.TREASURER, UserRole.MANAGER), (req, res, next) =>
  expensesController.deleteCategory(req as never, res, next));

// ── Expenses ─────────────────────────────────────────────────────────────────
router.post('/', requireRoles(UserRole.TREASURER), upload.single('invoice'), validate(createExpenseSchema), (req, res, next) =>
  expensesController.create(req as never, res, next));

router.get('/dashboard', requireRoles(UserRole.TREASURER, UserRole.COMMITTEE, UserRole.MANAGER), (req, res, next) =>
  expensesController.dashboard(req as never, res, next));

router.get('/total', requireRoles(UserRole.TREASURER, UserRole.COMMITTEE, UserRole.MANAGER), (req, res, next) =>
  expensesController.total(req as never, res, next));

router.get('/transparency', (req, res, next) =>
  expensesController.transparency(req as never, res, next));

// Gated by the recurring_expenses Web Menu feature — the same decision
// Layout.tsx's sidebar and useMenuItemEnabled('recurring_expenses') already
// apply on the frontend, now actually enforced here too. Every WRITE below
// (create/update/post-now) stays on its own real authorization list — menu
// visibility and "who's allowed to touch the ledger" are different
// questions.
router.get('/recurring', requireMenuFeature('recurring_expenses', UserRole.TREASURER, UserRole.MANAGER), (req, res, next) =>
  expensesController.listRecurring(req as never, res, next));

router.post('/recurring', requireRoles(UserRole.TREASURER, UserRole.MANAGER), validate(recurringExpenseSchema), (req, res, next) =>
  expensesController.createRecurring(req as never, res, next));

router.patch('/recurring/:id', requireRoles(UserRole.TREASURER, UserRole.MANAGER), (req, res, next) =>
  expensesController.updateRecurring(req as never, res, next));

// POST /expenses/recurring/:id/post-now — create today's draft expense on demand, instead of waiting for the nightly poller
router.post('/recurring/:id/post-now', requireRoles(UserRole.TREASURER, UserRole.MANAGER), (req, res, next) =>
  expensesController.postRecurringNow(req as never, res, next));

// Same feature as GET /recurring above — this feeds the same page's
// month-end accruals section.
router.get('/provisions', requireMenuFeature('recurring_expenses', UserRole.TREASURER, UserRole.MANAGER), (req, res, next) =>
  expensesController.listProvisions(req as never, res, next));

router.put('/budgets/:category', requireRoles(UserRole.TREASURER), validate(setBudgetSchema), (req, res, next) =>
  expensesController.setBudget(req as never, res, next));

router.get('/', requireRoles(UserRole.TREASURER, UserRole.COMMITTEE, UserRole.MANAGER), (req, res, next) =>
  expensesController.list(req as never, res, next));

router.get('/:id', requireRoles(UserRole.TREASURER, UserRole.COMMITTEE, UserRole.MANAGER), (req, res, next) =>
  expensesController.getOne(req as never, res, next));

router.patch('/:id', requireRoles(UserRole.TREASURER), validate(createExpenseSchema.partial()), (req, res, next) =>
  expensesController.update(req as never, res, next));

router.delete('/:id', requireRoles(UserRole.TREASURER, UserRole.MANAGER), (req, res, next) =>
  expensesController.remove(req as never, res, next));

// Also callable by a scoped Integration API Key (the BPM/workflow tool) —
// see middleware/api-key-scope.ts. A key never bypasses this: it must carry
// the 'expenses:approve' scope, same as a Committee member needing the role.
router.patch('/:id/approve', requireRolesOrApiKeyScope('expenses:approve', UserRole.COMMITTEE), validate(approveExpenseSchema), (req, res, next) =>
  expensesController.approve(req as never, res, next));

export default router;
