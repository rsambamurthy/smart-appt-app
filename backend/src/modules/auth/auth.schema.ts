import { z } from 'zod';

export const otpRequestSchema = z.object({
  phone: z.string().min(10).max(15),
});

export const otpVerifySchema = z.object({
  phone: z.string().min(10).max(15),
  otp: z.string().min(4).max(8),
});

export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1),
});

const mpinField = z.string().length(4).regex(/^\d{4}$/, 'M-PIN must be 4 digits');

export const mpinVerifySchema = z.object({
  phone: z.string().min(10).max(15),
  mpin: mpinField,
});

export const mpinSetSchema = z.object({
  mpin: mpinField,
});

export const mpinResetSchema = z.object({
  phone: z.string().min(10).max(15),
  otp: z.string().min(4).max(8),
  new_mpin: mpinField,
});

export const mpinChangeSchema = z.object({
  current_mpin: mpinField,
  new_mpin: mpinField,
});

export const mpinStatusSchema = z.object({
  phone: z.string().min(10).max(15),
});

export type OtpRequestBody = z.infer<typeof otpRequestSchema>;
export type OtpVerifyBody = z.infer<typeof otpVerifySchema>;
export type RefreshTokenBody = z.infer<typeof refreshTokenSchema>;
export type MpinVerifyBody = z.infer<typeof mpinVerifySchema>;
export type MpinSetBody = z.infer<typeof mpinSetSchema>;
export type MpinResetBody = z.infer<typeof mpinResetSchema>;
export type MpinChangeBody = z.infer<typeof mpinChangeSchema>;
