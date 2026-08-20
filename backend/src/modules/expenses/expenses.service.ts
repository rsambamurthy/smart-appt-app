import prisma from '../../config/database';
import { NotFoundError, ForbiddenError, UnprocessableError } from '../../utils/errors';
import { paginatedResponse } from '../../utils/helpers';
import { notificationService } from '../../services/notification.service';
import {
  CreateExpenseBody, UpdateExpenseBody, ApproveExpenseBody, SetBudgetBody,
  RecurringExpenseBody, CategoryConfigBody, UpdateCategoryConfigBody,
} from './expenses.schema';
import { ExpenseStatus, UserRole } from '@prisma/client';
import { journalService } from '../accounting/journal.service';
import { ensureVendorBP, ensureVendorFromBusinessPartner } from '../accounting/bp-type.seed';
import logger from '../../utils/logger';

// Default categories seeded for every new association
const DEFAULT_CATEGORIES = [
  { name: 'ELECTRICITY',  display_name: 'Electricity',          color: '#f59e0b', sort_order: 0 },
  { name: 'WATER',        display_name: 'Water',                color: '#3b82f6', sort_order: 1 },
  { name: 'HOUSEKEEPING', display_name: 'Housekeeping',         color: '#10b981', sort_order: 2 },
  { name: 'SECURITY',     display_name: 'Security',             color: '#8b5cf6', sort_order: 3 },
  { name: 'REPAIRS',      display_name: 'Repairs & Maintenance',color: '#ef4444', sort_order: 4 },
  { name: 'ADMIN',        display_name: 'Administration',       color: '#6b7280', sort_order: 5 },
  { name: 'EVENTS',       display_name: 'Events',               color: '#ec4899', sort_order: 6 },
  { name: 'OTHERS',       display_name: 'Others',               color: '#9ca3af', sort_order: 7 },
];

export class ExpensesService {
  async createExpense(associationId: string, body: CreateExpenseBody, createdBy: string, invoiceKey?: string) {
    const config = await prisma.associationConfig.findUnique({ where: { association_id: associationId } });
    const threshold = Number(config?.expense_approval_threshold ?? 0);
    const needsApproval = body.amount > threshold && threshold > 0;

    const expense = await prisma.expense.create({
      data: {
        association_id: associationId,
        expense_date: new Date(body.expense_date),
        category: body.category,
        vendor_id: body.vendor_id,
        vendor_name: body.vendor_name,
        amount: body.amount,
        payment_mode: body.payment_mode,
        description: body.description,
        invoice_s3_key: invoiceKey,
        status:     needsApproval ? ExpenseStatus.PENDING_APPROVAL : ExpenseStatus.RECORDED,
        created_by: createdBy,
      },
    });

    if (needsApproval) {
      const committee = await prisma.user.findMany({
        where: { association_id: associationId, role: UserRole.COMMITTEE, is_active: true, deleted_at: null },
        select: { id: true },
      });
      await notificationService.dispatch({
        type: 'EXPENSE_PENDING_APPROVAL',
        channels: ['PUSH', 'EMAIL'],
        recipients: committee.map((c) => c.id),
        data: { expense_id: expense.id, amount: body.amount, category: body.category },
      });
    }

    await prisma.auditLog.create({
      data: {
        association_id: associationId,
        entity_type: 'expense',
        entity_id: expense.id,
        action: 'CREATE',
        performed_by: createdBy,
        new_value: body as never,
      },
    });

    // Auto-post: DR Expense account / CR Cash or Bank (only if not pending approval)
    if (!needsApproval) {
      journalService.postExpense(
        associationId,
        expense.id,
        body.amount,
        body.payment_mode,
        body.category,
        body.description ?? body.category,
      );
    }

    return { data: expense };
  }

  async listExpenses(associationId: string, query: {
    cursor?: string; limit: number; category?: string; vendor_id?: string;
    status?: string; date_from?: string; date_to?: string;
  }) {
    const where: Record<string, unknown> = { association_id: associationId, deleted_at: null };
    if (query.category) where['category'] = query.category;
    if (query.vendor_id) where['vendor_id'] = query.vendor_id;
    if (query.status) where['status'] = query.status;
    if (query.date_from || query.date_to) {
      where['expense_date'] = {};
      if (query.date_from) (where['expense_date'] as Record<string, unknown>)['gte'] = new Date(query.date_from);
      if (query.date_to) (where['expense_date'] as Record<string, unknown>)['lte'] = new Date(query.date_to);
    }
    if (query.cursor) where['id'] = { gt: query.cursor };

    const expenses = await prisma.expense.findMany({
      where: where as never,
      take: query.limit,
      include: { vendor: { select: { name: true } }, creator: { select: { name: true } } },
      orderBy: { expense_date: 'desc' },
    });

    return paginatedResponse(expenses as (typeof expenses[0] & { id: string })[], query.limit);
  }

  async getExpense(associationId: string, expenseId: string) {
    const expense = await prisma.expense.findFirst({
      where: { id: expenseId, association_id: associationId, deleted_at: null },
      include: { vendor: true, creator: { select: { name: true } }, approver: { select: { name: true } } },
    });
    if (!expense) throw new NotFoundError('Expense');
    return { data: expense };
  }

  async updateExpense(associationId: string, expenseId: string, body: Partial<CreateExpenseBody>, userId: string) {
    const expense = await prisma.expense.findFirst({ where: { id: expenseId, association_id: associationId, deleted_at: null } });
    if (!expense) throw new NotFoundError('Expense');
    if (!([ExpenseStatus.PENDING_APPROVAL, ExpenseStatus.RECORDED] as string[]).includes(expense.status)) {
      throw new UnprocessableError('Only PENDING_APPROVAL or RECORDED expenses can be edited.');
    }

    const updated = await prisma.expense.update({ where: { id: expenseId }, data: body as never });

    await prisma.auditLog.create({
      data: {
        association_id: associationId, entity_type: 'expense', entity_id: expenseId,
        action: 'UPDATE', performed_by: userId, old_value: expense as never, new_value: body as never,
      },
    });

    return { data: updated };
  }

  async deleteExpense(associationId: string, expenseId: string, userId: string) {
    const expense = await prisma.expense.findFirst({ where: { id: expenseId, association_id: associationId, deleted_at: null } });
    if (!expense) throw new NotFoundError('Expense');

    await prisma.expense.update({ where: { id: expenseId }, data: { deleted_at: new Date() } });

    await prisma.auditLog.create({
      data: {
        association_id: associationId, entity_type: 'expense', entity_id: expenseId,
        action: 'DELETE', performed_by: userId, old_value: expense as never,
      },
    });

    return { data: { message: 'Expense deleted' } };
  }

  async approveExpense(associationId: string, expenseId: string, body: ApproveExpenseBody, approvedBy: string) {
    const expense = await prisma.expense.findFirst({ where: { id: expenseId, association_id: associationId, deleted_at: null } });
    if (!expense) throw new NotFoundError('Expense');
    if (expense.status !== ExpenseStatus.PENDING_APPROVAL) throw new UnprocessableError('Expense is not pending approval.');

    const newStatus = body.decision === 'APPROVED' ? ExpenseStatus.APPROVED : ExpenseStatus.REJECTED;
    const updated = await prisma.expense.update({
      where: { id: expenseId },
      data: { status: newStatus, approved_by: approvedBy, approved_at: new Date(), approval_note: body.note },
    });

    // Recurring expenses always come in as PENDING_APPROVAL (see the
    // recurring-expense poller), so this is the first moment a recurring
    // item is confirmed real. If it was already provisioned at month-end,
    // reverse that accrual instead of booking the expense a second time.
    // Scoped to is_recurring only — this doesn't touch the (separate,
    // pre-existing) approval path for one-off expenses over the threshold.
    if (newStatus === ExpenseStatus.APPROVED && expense.is_recurring && expense.recurring_id) {
      const expenseDate = expense.expense_date;
      const openProvision = await prisma.expenseProvision.findFirst({
        where: {
          recurring_expense_id: expense.recurring_id,
          period_year:  expenseDate.getFullYear(),
          period_month: expenseDate.getMonth() + 1,
          status: 'OPEN',
        },
      });

      try {
        if (openProvision) {
          // The recurring item is the authoritative source of which vendor
          // this accrual belongs to (auto_provision requires one — see
          // ensureVendorForProvisioning) — not expense.vendor_id, which is a
          // separately-editable field on the individual expense.
          const recurring = await prisma.recurringExpense.findUnique({
            where: { id: expense.recurring_id },
            include: { vendor: true },
          });
          if (!recurring?.vendor) {
            throw new UnprocessableError('This recurring expense was provisioned but no longer has a vendor linked — cannot settle the accrual.');
          }
          const businessPartnerId = await ensureVendorBP(associationId, recurring.vendor);

          const settlementEntryId = await journalService.reverseExpenseProvision(
            associationId,
            openProvision.id,
            Number(openProvision.amount),
            Number(expense.amount),
            expense.category,
            businessPartnerId,
            expense.payment_mode,
            expense.description ?? expense.category,
            expenseDate,
          );
          await prisma.expenseProvision.update({
            where: { id: openProvision.id },
            data: {
              status: 'SETTLED',
              settled_expense_id: expenseId,
              settlement_journal_entry_id: settlementEntryId,
              settled_at: new Date(),
            },
          });
        } else {
          await journalService.postExpense(
            associationId,
            expenseId,
            Number(expense.amount),
            expense.payment_mode,
            expense.category,
            expense.description ?? expense.category,
          );
        }
      } catch (err) {
        logger.error('Auto-post failed (recurring expense approval)', { expenseId, error: err });
      }
    }

    await notificationService.dispatch({
      type: 'EXPENSE_DECISION',
      channels: ['PUSH'],
      recipients: [expense.created_by],
      data: { expense_id: expenseId, decision: body.decision },
    });

    await prisma.auditLog.create({
      data: {
        association_id: associationId, entity_type: 'expense', entity_id: expenseId,
        action: body.decision === 'APPROVED' ? 'APPROVE' : 'REJECT',
        performed_by: approvedBy, old_value: { status: expense.status } as never, new_value: { status: newStatus, note: body.note } as never,
      },
    });

    return { data: updated };
  }

  async getDashboard(associationId: string) {
    const currentYear = new Date().getFullYear();
    const budgets = await prisma.expenseBudget.findMany({
      where: { association_id: associationId, financial_year: currentYear },
    });
    const actuals = await prisma.expense.groupBy({
      by: ['category'],
      where: {
        association_id: associationId,
        deleted_at: null,
        status: { in: [ExpenseStatus.APPROVED, ExpenseStatus.RECORDED] },
        expense_date: {
          gte: new Date(currentYear, 3, 1),
          lt: new Date(currentYear + 1, 3, 1),
        },
      },
      _sum: { amount: true },
    });

    const categoryData = budgets.map((b) => {
      const actual = actuals.find((a) => a.category === b.category);
      const spent = Number(actual?._sum.amount ?? 0);
      return {
        category: b.category,
        budget: Number(b.budget_amount),
        spent,
        surplus: Number(b.budget_amount) - spent,
      };
    });

    return { data: { categories: categoryData } };
  }

  async getTotal(associationId: string) {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [total, month] = await Promise.all([
      prisma.expense.aggregate({
        where: { association_id: associationId, deleted_at: null, status: { in: [ExpenseStatus.APPROVED, ExpenseStatus.RECORDED] } },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { association_id: associationId, deleted_at: null, status: { in: [ExpenseStatus.APPROVED, ExpenseStatus.RECORDED] }, expense_date: { gte: monthStart } },
        _sum: { amount: true },
      }),
    ]);
    return { data: { total_expenses: total._sum.amount ?? 0, month_expenses: month._sum.amount ?? 0 } };
  }

  async getTransparencyView(associationId: string) {
    const expenses = await prisma.expense.findMany({
      where: {
        association_id: associationId,
        deleted_at: null,
        status: { in: [ExpenseStatus.APPROVED, ExpenseStatus.RECORDED] },
      },
      orderBy: { expense_date: 'desc' },
      select: {
        id: true,
        expense_date: true,
        category: true,
        vendor_name: true,
        amount: true,
        payment_mode: true,
        description: true,
      },
    });
    return { data: expenses };
  }

  async setBudget(associationId: string, category: string, body: SetBudgetBody, updatedBy: string) {
    const budget = await prisma.expenseBudget.upsert({
      where: { association_id_category_financial_year: { association_id: associationId, category, financial_year: body.financial_year } },
      update: { budget_amount: body.budget_amount, updated_by: updatedBy },
      create: { association_id: associationId, category, financial_year: body.financial_year, budget_amount: body.budget_amount, updated_by: updatedBy },
    });
    return { data: budget };
  }

  async createRecurring(associationId: string, body: RecurringExpenseBody, createdBy: string) {
    const { business_partner_id, ...rest } = body;
    const vendorId = business_partner_id
      ? await this.resolveVendorForProvisioning(associationId, business_partner_id, createdBy, /* required */ body.auto_provision)
      : undefined;
    if (body.auto_provision && !vendorId) {
      throw new UnprocessableError(
        'A vendor is required to turn on month-end provisioning — the accrual posts against the vendor\'s Accounts Payable card.'
      );
    }

    const recurring = await prisma.recurringExpense.create({
      data: {
        association_id: associationId,
        ...rest,
        vendor_id: vendorId,
        next_due_date: new Date(body.next_due_date),
        created_by: createdBy,
      },
    });
    return { data: recurring };
  }

  async listRecurring(associationId: string) {
    const items = await prisma.recurringExpense.findMany({
      where: { association_id: associationId, is_active: true },
      include: { vendor: { select: { name: true } } },
      orderBy: { next_due_date: 'asc' },
    });
    return { data: items };
  }

  async updateRecurring(associationId: string, recurringId: string, body: Partial<RecurringExpenseBody>, updatedBy: string) {
    const item = await prisma.recurringExpense.findFirst({ where: { id: recurringId, association_id: associationId } });
    if (!item) throw new NotFoundError('Recurring expense');

    const { business_partner_id, ...rest } = body;
    const willProvision = body.auto_provision ?? item.auto_provision;
    let vendorId = item.vendor_id ?? undefined;
    if (business_partner_id) {
      vendorId = await this.resolveVendorForProvisioning(associationId, business_partner_id, updatedBy, /* required */ willProvision) ?? undefined;
    }

    if (willProvision && !vendorId) {
      throw new UnprocessableError(
        'A vendor is required to turn on month-end provisioning — the accrual posts against the vendor\'s Accounts Payable card.'
      );
    }

    const updated = await prisma.recurringExpense.update({
      where: { id: recurringId },
      data: { ...rest, ...(business_partner_id ? { vendor_id: vendorId } : {}) } as never,
    });
    return { data: updated };
  }

  // ── Ledger-card wiring for month-end provisioning ─────────────────────────
  // The user picks a Business Partner (the single vendor list associations
  // actually maintain, under Configuration → Business Partners) — this
  // resolves it to the internal Vendor row that RecurringExpense.vendor_id
  // actually points at, creating the bridge row transparently on first use,
  // then makes sure that vendor has an Accounts Payable ledger card (also
  // created on first use — see ensureVendorBP).
  private async resolveVendorForProvisioning(
    associationId: string,
    businessPartnerId: string,
    userId: string,
    required: boolean,
  ) {
    const vendorId = await ensureVendorFromBusinessPartner(associationId, businessPartnerId, userId);
    if (!vendorId) {
      if (required) throw new NotFoundError('Business partner');
      return undefined;
    }
    if (required) {
      const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
      if (vendor) await ensureVendorBP(associationId, vendor);
    }
    return vendorId;
  }

  // ── Month-end provisions — review screen for treasurers ──────────────────
  async listProvisions(associationId: string, status?: string) {
    const items = await prisma.expenseProvision.findMany({
      where: { association_id: associationId, ...(status ? { status: status as never } : {}) },
      include: {
        recurring_expense: { select: { description: true, category: true, frequency: true } },
      },
      orderBy: [{ period_year: 'desc' }, { period_month: 'desc' }],
    });
    return { data: items };
  }

  // ── Expense Category Config ──────────────────────────────────────────────────
  async listCategories(associationId: string) {
    let categories = await prisma.expenseCategoryConfig.findMany({
      where: { association_id: associationId },
      orderBy: [{ sort_order: 'asc' }, { display_name: 'asc' }],
    });

    // Auto-seed defaults if none exist yet
    if (categories.length === 0) {
      await prisma.expenseCategoryConfig.createMany({
        data: DEFAULT_CATEGORIES.map((c) => ({ ...c, association_id: associationId })),
        skipDuplicates: true,
      });
      categories = await prisma.expenseCategoryConfig.findMany({
        where: { association_id: associationId },
        orderBy: [{ sort_order: 'asc' }, { display_name: 'asc' }],
      });
    }

    return { data: categories };
  }

  async createCategory(associationId: string, body: CategoryConfigBody) {
    const existing = await prisma.expenseCategoryConfig.findFirst({
      where: { association_id: associationId, name: body.name.toUpperCase() },
    });
    if (existing) {
      throw new Error(`Category "${body.name}" already exists.`);
    }
    const category = await prisma.expenseCategoryConfig.create({
      data: { association_id: associationId, name: body.name.toUpperCase(), display_name: body.display_name, color: body.color, sort_order: body.sort_order ?? 99 },
    });
    return { data: category };
  }

  async updateCategory(associationId: string, categoryId: string, body: UpdateCategoryConfigBody) {
    const existing = await prisma.expenseCategoryConfig.findFirst({ where: { id: categoryId, association_id: associationId } });
    if (!existing) throw new NotFoundError('Category');
    const updated = await prisma.expenseCategoryConfig.update({
      where: { id: categoryId },
      data: {
        ...(body.display_name && { display_name: body.display_name }),
        ...(body.color !== undefined && { color: body.color }),
        ...(body.sort_order !== undefined && { sort_order: body.sort_order }),
        ...(body.is_active !== undefined && { is_active: body.is_active }),
      },
    });
    return { data: updated };
  }

  async deleteCategory(associationId: string, categoryId: string) {
    const existing = await prisma.expenseCategoryConfig.findFirst({ where: { id: categoryId, association_id: associationId } });
    if (!existing) throw new NotFoundError('Category');
    // Check if any expense uses this category
    const inUse = await prisma.expense.count({ where: { association_id: associationId, category: existing.name, deleted_at: null } });
    if (inUse > 0) throw new Error(`Cannot delete: ${inUse} expense(s) use this category. Deactivate it instead.`);
    await prisma.expenseCategoryConfig.delete({ where: { id: categoryId } });
    return { data: { message: 'Category deleted' } };
  }
}

export const expensesService = new ExpensesService();
