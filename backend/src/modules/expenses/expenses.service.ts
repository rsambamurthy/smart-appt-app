import prisma from '../../config/database';
import { NotFoundError, ForbiddenError, UnprocessableError, ConflictError } from '../../utils/errors';
import { paginatedResponse, nextRecurringDueDate } from '../../utils/helpers';
import { notificationService } from '../../services/notification.service';
import {
  CreateExpenseBody, UpdateExpenseBody, ApproveExpenseBody, SetBudgetBody,
  RecurringExpenseBody, CategoryConfigBody, UpdateCategoryConfigBody,
} from './expenses.schema';
import { ExpenseStatus, JournalStatus, UserRole, Prisma } from '@prisma/client';
import { journalService } from '../accounting/journal.service';
import { fyClosureService } from '../accounting/fy-closure.service';
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

    // Resolves to the internal Vendor bridge row (Expense.vendor_id's actual
    // FK target) — see ensureVendorFromBusinessPartner. Only set when the
    // partner genuinely exists under this association as a VENDOR; a bad id
    // just means no vendor gets linked rather than a hard failure, since it's
    // an optional field on an otherwise-valid expense.
    const vendorId = body.business_partner_id
      ? (await ensureVendorFromBusinessPartner(associationId, body.business_partner_id, createdBy)) ?? undefined
      : undefined;

    const expense = await prisma.expense.create({
      data: {
        association_id: associationId,
        expense_date: new Date(body.expense_date),
        category: body.category,
        vendor_id: vendorId,
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
        vendorId ? body.business_partner_id : undefined,
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
      include: { vendor: { select: { name: true, business_partner_id: true } }, creator: { select: { name: true } } },
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

    // Editing is only ever allowed before the expense is posted (the guard
    // above), so there's no live journal line to keep in sync here — unlike
    // createExpense, changing the vendor at this stage is just data.
    const { business_partner_id, ...rest } = body;
    const vendorId = business_partner_id
      ? (await ensureVendorFromBusinessPartner(associationId, business_partner_id, userId)) ?? undefined
      : undefined;

    const updated = await prisma.expense.update({
      where: { id: expenseId },
      data: { ...rest, ...(business_partner_id ? { vendor_id: vendorId } : {}) } as never,
    });

    await prisma.auditLog.create({
      data: {
        association_id: associationId, entity_type: 'expense', entity_id: expenseId,
        action: 'UPDATE', performed_by: userId, old_value: expense as never, new_value: body as never,
      },
    });

    return { data: updated };
  }

  /**
   * Delete an expense — and, if it was already posted to the ledger
   * (APPROVED/RECORDED, so journalService.postExpense already ran), cancel
   * that JournalEntry in the same transaction.
   *
   * This used to only ever soft-delete the Expense row itself, regardless of
   * status. For a still-PENDING_APPROVAL expense that's harmless — nothing
   * has been posted yet. But for one already approved, the posted
   * JournalEntry (real debit/credit lines, counted in every balance sheet
   * and P&L) was left behind with no Expense row left to trace it back to:
   * deleting looked like it undid the expense, but the ledger impact stayed.
   * That's exactly the gap that made a duplicate recurring-expense posting
   * impossible to clean up safely — see postRecurringNow's own idempotency
   * gap for how the duplicate could arise in the first place.
   *
   * Follows the same cancel-don't-hard-delete convention already used for
   * undoing a payment (dues.service.ts undoPayment): the JournalEntry is
   * marked CANCELLED (kept for audit; every report already excludes
   * non-POSTED entries) rather than removed, and a closed financial year
   * blocks it the same way.
   */
  async deleteExpense(associationId: string, expenseId: string, userId: string, reason?: string) {
    const expense = await prisma.expense.findFirst({ where: { id: expenseId, association_id: associationId, deleted_at: null } });
    if (!expense) throw new NotFoundError('Expense');

    const entry = await prisma.journalEntry.findFirst({
      where: { association_id: associationId, reference_type: 'EXPENSE', reference_id: expenseId },
    });
    const needsCancel = !!entry && entry.status !== JournalStatus.CANCELLED;

    if (needsCancel && await fyClosureService.isYearClosed(associationId, entry!.financial_year)) {
      throw new UnprocessableError(
        `Financial year ${entry!.financial_year} is closed. Reopen it to delete this expense.`,
      );
    }

    await prisma.$transaction(async (tx) => {
      if (needsCancel) {
        await tx.journalEntry.update({
          where: { id: entry!.id },
          data: {
            status:              JournalStatus.CANCELLED,
            cancelled_at:        new Date(),
            cancelled_by_id:     userId,
            cancellation_reason: reason?.trim() || 'Expense deleted from the Expenses screen.',
          },
        });
      }
      await tx.expense.update({ where: { id: expenseId }, data: { deleted_at: new Date() } });
    });

    await prisma.auditLog.create({
      data: {
        association_id: associationId, entity_type: 'expense', entity_id: expenseId,
        action: 'DELETE', performed_by: userId, old_value: expense as never,
      },
    });

    return {
      data: {
        message: needsCancel
          ? 'Expense deleted and its posted ledger entry cancelled'
          : 'Expense deleted',
      },
    };
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
          // resolveVendorForProvisioning) — not expense.vendor_id, which is a
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
          // No accrual to settle — first time this recurring item is
          // approved for this period. Still worth tagging the vendor on the
          // expense line if one's linked, same as the settlement path above.
          const recurring = await prisma.recurringExpense.findUnique({
            where: { id: expense.recurring_id },
            include: { vendor: true },
          });
          const businessPartnerId = recurring?.vendor
            ? await ensureVendorBP(associationId, recurring.vendor)
            : undefined;

          await journalService.postExpense(
            associationId,
            expenseId,
            Number(expense.amount),
            expense.payment_mode,
            expense.category,
            expense.description ?? expense.category,
            businessPartnerId,
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
    // Inactive items are still returned — the admin screen shows them dimmed
    // with an "Activate" button, which only works if a deactivated item can
    // still be found again. Filtering them out here (as this used to do) means
    // pausing one made it disappear for good, with no way back short of
    // re-creating it from scratch.
    const items = await prisma.recurringExpense.findMany({
      where: { association_id: associationId },
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

  /**
   * "Post Now" — create today's draft expense for a recurring item on demand,
   * instead of waiting for the nightly poller to reach its next_due_date.
   *
   * Only usable once the item is actually due (next_due_date <= today) — it
   * is NOT a "pay early" button. Posting advances next_due_date to the next
   * cycle (see below), so once used, the button has nothing left to do until
   * that next date arrives; this guard is what makes that true on the server
   * as well as in the UI, rather than trusting the button's disabled state
   * alone.
   *
   * Mirrors jobs/workers/recurring-expense-poller.ts exactly (same status,
   * same idempotency guard, same schedule-advance logic) so a manual post and
   * an automatic one are indistinguishable afterwards — including advancing
   * next_due_date from its own prior value rather than from today, so a
   * late catch-up post never drags the schedule's day-of-month with it.
   */
  async postRecurringNow(associationId: string, recurringId: string, userId: string) {
    const rec = await prisma.recurringExpense.findFirst({
      where: { id: recurringId, association_id: associationId },
    });
    if (!rec) throw new NotFoundError('Recurring expense');
    if (!rec.is_active) throw new UnprocessableError('This recurring expense is inactive — activate it first.');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86400000);

    // `next_due_date` is a DB DATE column — Prisma reads it back as UTC
    // midnight of that calendar date, which sits a few hours *after*
    // `today`'s own local (IST) midnight. Comparing against `tomorrow`
    // rather than `today` is what keeps "due today" actually passing this
    // check — the exact same boundary the poller's own query already uses,
    // for the exact same reason.
    if (rec.next_due_date >= tomorrow) {
      throw new UnprocessableError(
        `Not due yet — next due ${rec.next_due_date.toLocaleDateString('en-IN')}.`,
      );
    }

    const existing = await prisma.expense.findFirst({
      where: { recurring_id: rec.id, expense_date: { gte: today, lt: tomorrow } },
    });
    if (existing) throw new ConflictError('Already posted today for this recurring expense.');

    // The findFirst above is a check, not a lock — a same-second click of
    // this button (or a race with the nightly poller, which runs the same
    // check) can both pass it before either insert commits. The partial
    // unique index expenses_recurring_one_per_day (migration
    // 20260906000001_expense_recurring_one_per_day) is the real guarantee;
    // this catch turns the loser's raw constraint violation into the same
    // friendly message the check above already gives the common case.
    let expense;
    try {
      expense = await prisma.expense.create({
        data: {
          association_id: associationId,
          expense_date: today,
          category: rec.category,
          vendor_id: rec.vendor_id,
          amount: rec.amount,
          payment_mode: 'CASH',
          description: rec.description,
          status: ExpenseStatus.PENDING_APPROVAL,
          is_recurring: true,
          recurring_id: rec.id,
          created_by: userId,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError('Already posted today for this recurring expense.');
      }
      throw err;
    }

    await prisma.recurringExpense.update({
      where: { id: rec.id },
      data: { next_due_date: nextRecurringDueDate(rec.next_due_date, rec.frequency) },
    });

    const committee = await prisma.user.findMany({
      where: { association_id: associationId, role: UserRole.COMMITTEE, is_active: true, deleted_at: null },
      select: { id: true },
    });
    await notificationService.dispatch({
      type: 'EXPENSE_PENDING_APPROVAL',
      channels: ['PUSH', 'EMAIL'],
      recipients: committee.map((c) => c.id),
      data: { expense_id: expense.id, amount: Number(rec.amount), category: rec.category },
    });

    return { data: expense };
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
