import { z } from 'zod';
import { ExpensePaymentMode, ExpenseFrequency } from '@prisma/client';

export const createExpenseSchema = z.object({
  expense_date: z.string().datetime(),
  category: z.string().min(1).max(100),
  vendor_id: z.string().uuid().optional(),
  vendor_name: z.string().max(255).optional(),
  amount: z.number().positive(),
  payment_mode: z.nativeEnum(ExpensePaymentMode),
  description: z.string().optional(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export const approveExpenseSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  note: z.string().optional(),
});

export const setBudgetSchema = z.object({
  budget_amount: z.number().positive(),
  financial_year: z.number().int().min(2020).max(2100),
});

export const recurringExpenseSchema = z.object({
  description: z.string().min(1).max(255),
  category: z.string().min(1).max(100),
  // The vendor picked from the Business Partners (VENDOR category) list —
  // the one vendor list associations actually maintain. The service layer
  // resolves this to the internal, lightweight Vendor row the schema's FK
  // actually points at (see ensureVendorFromBusinessPartner); callers never
  // deal with that row directly.
  business_partner_id: z.string().uuid().optional(),
  amount: z.number().positive(),
  frequency: z.nativeEnum(ExpenseFrequency),
  next_due_date: z.string().datetime(),
  reminder_days: z.number().int().min(0).max(30).optional().default(3),
  // Opt-in month-end accrual. Only meaningful for MONTHLY items; the service
  // layer ignores it for other frequencies rather than rejecting the request,
  // so flipping frequency later doesn't require also clearing the flag.
  // Requires a vendor: the accrual posts to Accounts Payable against that
  // vendor's own sub-ledger card, so there's no such thing as an anonymous
  // accrual — see journal.service.ts's postExpenseProvision.
  auto_provision: z.boolean().optional().default(false),
}).superRefine((data, ctx) => {
  if (data.auto_provision && !data.business_partner_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['business_partner_id'],
      message: 'A vendor is required to turn on month-end provisioning — the accrual posts against the vendor\'s Accounts Payable card.',
    });
  }
});

export const listProvisionsQuerySchema = z.object({
  status: z.enum(['OPEN', 'SETTLED', 'REVERSED']).optional(),
});

export const listExpensesQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.string().optional(),
  vendor_id: z.string().uuid().optional(),
  status: z.string().optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
});

export const categoryConfigSchema = z.object({
  name: z.string().min(1).max(100),
  display_name: z.string().min(1).max(100),
  color: z.string().max(20).optional(),
  sort_order: z.number().int().min(0).optional(),
});

export const updateCategoryConfigSchema = categoryConfigSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export type CreateExpenseBody = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseBody = z.infer<typeof updateExpenseSchema>;
export type ApproveExpenseBody = z.infer<typeof approveExpenseSchema>;
export type SetBudgetBody = z.infer<typeof setBudgetSchema>;
export type RecurringExpenseBody = z.infer<typeof recurringExpenseSchema>;
export type ListProvisionsQuery = z.infer<typeof listProvisionsQuerySchema>;
export type CategoryConfigBody = z.infer<typeof categoryConfigSchema>;
export type UpdateCategoryConfigBody = z.infer<typeof updateCategoryConfigSchema>;
