import { z } from 'zod';
import { PaymentMode } from '@prisma/client';

export const RECEIPT_CATEGORIES = ['Interest', 'Parking', 'Event Fee', 'Donation', 'Rental', 'Other'] as const;

export const createReceiptSchema = z.object({
  receipt_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  amount:        z.number().positive(),
  category:      z.enum(RECEIPT_CATEGORIES),
  description:   z.string().max(1000).optional(),
  received_from: z.string().max(255).optional(),
  payment_mode:  z.nativeEnum(PaymentMode),
});

export type CreateReceiptBody = z.infer<typeof createReceiptSchema>;
