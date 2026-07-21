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

export type OtpRequestBody = z.infer<typeof otpRequestSchema>;
export type OtpVerifyBody = z.infer<typeof otpVerifySchema>;
export type RefreshTokenBody = z.infer<typeof refreshTokenSchema>;
