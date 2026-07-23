import { z } from 'zod';
import { PenaltyType, PaymentMode, ChargeType } from '@prisma/client';

export const duesConfigSchema = z.object({
  charge_type: z.nativeEnum(ChargeType),
  monthly_charge: z.number().nonnegative(),
  rate_per_sqft: z.number().positive().optional().nullable(),
  due_day: z.number().int().min(1).max(28),
  penalty_type: z.nativeEnum(PenaltyType),
  penalty_value: z.number().nonnegative(),
  penalty_grace_days: z.number().int().nonnegative(),
  cash_balance: z.number().nonnegative().optional().nullable(),
  cash_balance_as_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

export const generateBillsSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  unit_ids: z.array(z.string().uuid()).optional(),
});

export const rollbackBillsSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
});

export const offlinePaymentSchema = z.object({
  bill_id: z.string().uuid(),
  amount: z.number().positive(),
  mode: z.nativeEnum(PaymentMode),
  reference_no: z.string().optional(),
  payment_date: z.string().datetime(),
});

export const initiatePaymentSchema = z.object({
  bill_id: z.string().uuid(),
});

export const createLevySchema = z.object({
  unit_ids: z.array(z.string().uuid()).min(1),
  amount: z.number().positive(),
  due_date: z.string().datetime(),
  description: z.string().min(1),
});

export const oneTimeDueSchema = z.object({
  title:           z.string().min(2).max(255),
  description:     z.string().max(1000).optional(),
  charge_type:     z.nativeEnum(ChargeType).default('FIXED'),
  amount:          z.number().positive(),
  due_date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'due_date must be YYYY-MM-DD'),
  target_unit_ids: z.array(z.string().uuid()).optional().default([]),
});

export const updateOneTimeDueSchema = oneTimeDueSchema.partial();

export const generateOneTimeDueBillsSchema = z.object({
  unit_ids: z.array(z.string().uuid()).optional(),
});

export type DuesConfigBody = z.infer<typeof duesConfigSchema>;
export type GenerateBillsBody = z.infer<typeof generateBillsSchema>;
export type RollbackBillsBody = z.infer<typeof rollbackBillsSchema>;
export type OfflinePaymentBody = z.infer<typeof offlinePaymentSchema>;
export type InitiatePaymentBody = z.infer<typeof initiatePaymentSchema>;
export type CreateLevyBody = z.infer<typeof createLevySchema>;
export type OneTimeDueBody = z.infer<typeof oneTimeDueSchema>;
export type UpdateOneTimeDueBody = z.infer<typeof updateOneTimeDueSchema>;
export type GenerateOneTimeDueBillsBody = z.infer<typeof generateOneTimeDueBillsSchema>;
