import { z } from 'zod';

export const journalLineSchema = z.object({
  account_id: z.string().uuid('Invalid account ID'),
  debit:      z.number().min(0).default(0),
  credit:     z.number().min(0).default(0),
  narration:  z.string().max(255).optional().nullable(),
});

export const createJournalEntrySchema = z.object({
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'entry_date must be YYYY-MM-DD'),
  narration:  z.string().min(1).max(255),
  lines:      z.array(journalLineSchema).min(2, 'At least 2 lines required'),
});

export type JournalLineBody         = z.infer<typeof journalLineSchema>;
export type CreateJournalEntryBody  = z.infer<typeof createJournalEntrySchema>;
