import { z } from 'zod';
import { AccountType, BalanceType } from '@prisma/client';

export const createAccountSchema = z.object({
  code:                 z.string().min(1).max(20),
  name:                 z.string().min(1).max(120),
  type:                 z.nativeEnum(AccountType),
  sub_type:             z.string().max(60).optional().nullable(),
  description:          z.string().max(255).optional().nullable(),
  sort_order:           z.number().int().optional().default(0),
  // Hierarchy
  parent_id:            z.string().uuid().optional().nullable(),
  is_group:             z.boolean().optional().default(false),
  // Control account / sub-ledger
  is_control_account:   z.boolean().optional().default(false),
  bp_type_id:           z.string().uuid().optional().nullable(),
  // Opening balance
  opening_balance:      z.number().optional().nullable(),
  opening_balance_type: z.nativeEnum(BalanceType).optional().nullable(),
  opening_balance_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

export const updateAccountSchema = createAccountSchema.partial();

export type CreateAccountBody = z.infer<typeof createAccountSchema>;
export type UpdateAccountBody = z.infer<typeof updateAccountSchema>;
