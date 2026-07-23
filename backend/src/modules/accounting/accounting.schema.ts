import { z } from 'zod';
import { AccountType } from '@prisma/client';

export const createAccountSchema = z.object({
  code:        z.string().min(1).max(20),
  name:        z.string().min(1).max(120),
  type:        z.nativeEnum(AccountType),
  sub_type:    z.string().max(60).optional().nullable(),
  description: z.string().max(255).optional().nullable(),
  sort_order:  z.number().int().optional().default(0),
});

export const updateAccountSchema = createAccountSchema.partial();

export type CreateAccountBody = z.infer<typeof createAccountSchema>;
export type UpdateAccountBody = z.infer<typeof updateAccountSchema>;
