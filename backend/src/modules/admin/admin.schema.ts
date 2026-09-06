import { z } from 'zod';
import { OnboardingMode } from '@prisma/client';

/**
 * Whitelist for PUT /admin/config.
 *
 * Before this, the route did `prisma.associationConfig.upsert({ update: req.body, ... })`
 * — an unvalidated passthrough of the raw request body. That was two bugs, not
 * one: (1) it let a caller write ANY column on this table, including ones no
 * settings screen should ever touch (association_id, timestamps, and so on),
 * and (2) since the row is always created at association registration
 * (associations.service.ts), the "create" branch of that upsert never
 * actually runs, but Prisma's client still validates that create payload can
 * be constructed — the required `association_name` field was missing from a
 * partial body, so it threw a client-side validation error and crashed with a
 * generic 500 on every partial update. `.strict()` here rejects unknown keys
 * outright instead of silently writing them, and the route now does a plain
 * `update` (see admin.routes.ts) since the row is guaranteed to exist.
 */
export const updateAssociationConfigSchema = z
  .object({
    onboarding_mode: z.nativeEnum(OnboardingMode).optional(),
    registration_unit_code: z.string().trim().max(50).nullable().optional(),
    require_manager_approval: z.boolean().optional(),
    invite_expiry_hours: z.number().int().min(1).max(720).optional(),
    invite_max_resends: z.number().int().min(0).max(20).optional(),
    otp_length: z.number().int().min(4).max(10).optional(),
    otp_ttl_seconds: z.number().int().min(30).max(3600).optional(),
    otp_max_attempts: z.number().int().min(1).max(20).optional(),
    otp_lockout_minutes: z.number().int().min(1).max(1440).optional(),
    otp_resend_cooldown_sec: z.number().int().min(10).max(600).optional(),
    assistant_voice_language: z.string().trim().min(2).max(10).optional(),
    session_idle_timeout_min: z.number().int().min(1).max(1440).optional(),
    max_concurrent_sessions: z.number().int().min(1).max(50).optional(),
    // Decimal(10,2) column — 0 disables approval-gating entirely (see
    // expenses.service.ts's needsApproval check), which is a legitimate,
    // deliberate value, not a mistake to reject.
    expense_approval_threshold: z.number().min(0).max(99999999.99).optional(),
    financial_year_start_month: z.number().int().min(1).max(12).optional(),
  })
  .strict();

export type UpdateAssociationConfigBody = z.infer<typeof updateAssociationConfigSchema>;
