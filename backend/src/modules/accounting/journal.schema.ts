import { z } from 'zod';

export const journalLineSchema = z.object({
  account_id:          z.string().uuid('Invalid account ID'),
  business_partner_id: z.string().uuid('Invalid business partner ID').optional().nullable(),
  debit:               z.number().min(0).default(0),
  credit:              z.number().min(0).default(0),
  narration:           z.string().max(255).optional().nullable(),
});

// The three categories a treasurer chooses between. Omitted for backwards
// compatibility, in which case the type is inferred from the accounts used.
export const voucherTypeSchema = z.enum(['BV', 'CV', 'JV']);

export const createJournalEntrySchema = z.object({
  entry_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'entry_date must be YYYY-MM-DD'),
  narration:    z.string().min(1).max(255),
  voucher_type: voucherTypeSchema.optional(),
  lines:        z.array(journalLineSchema).min(2, 'At least 2 lines required'),
});

export type JournalLineBody         = z.infer<typeof journalLineSchema>;
export type CreateJournalEntryBody  = z.infer<typeof createJournalEntrySchema>;
