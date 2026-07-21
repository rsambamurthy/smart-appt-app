import prisma from '../../config/database';
import {
  setOtp, getOtp, deleteOtp, isOtpLocked, incrementOtpAttempts, checkOtpRequestLimit,
} from '../../config/redis';
import { signAccessToken, signRefreshToken, verifyToken } from '../../config/jwt';
import { generateOtp, generateToken, hashToken, normalisePhone } from '../../utils/helpers';
import { UnauthorizedError, ConflictError, RateLimitError, NotFoundError, UnprocessableError } from '../../utils/errors';
import { whatsAppService } from '../../services/whatsapp.service';
import logger from '../../utils/logger';

export class AuthService {
  // ── OTP Request ─────────────────────────────────────────────────────────────
  async requestOtp(rawPhone: string): Promise<{ wa_status?: object; dev_otp?: string }> {
    const phone = normalisePhone(rawPhone);

    // Rate limit: 3 OTP requests per phone per 10 minutes
    const limited = await checkOtpRequestLimit(phone);
    if (limited) throw new RateLimitError('Too many OTP requests. Please wait before retrying.');

    // Config lookup (use defaults if no association found — multi-tenant lookup by phone)
    const user = await prisma.user.findFirst({ where: { phone, deleted_at: null } });
    const config = user
      ? await prisma.associationConfig.findUnique({ where: { association_id: user.association_id } })
      : null;

    const ttl = config?.otp_ttl_seconds ?? 300;
    const otpLength = config?.otp_length ?? 6;
    const otp = generateOtp(otpLength);

    await setOtp(phone, otp, ttl);
    const waResult = await whatsAppService.sendOtp(phone, otp);

    if (process.env.NODE_ENV === 'development') {
      logger.info(`DEV OTP for ${phone}: ${otp}`);
      return { wa_status: waResult, dev_otp: otp };
    }

    return { wa_status: waResult };
  }

  // ── OTP Verify ──────────────────────────────────────────────────────────────
  async verifyOtp(rawPhone: string, otp: string): Promise<{ access_token: string; refresh_token: string; user: object }> {
    const phone = normalisePhone(rawPhone);

    // Dev bypass: accept '000000' or '123456' as master OTPs in development.
    // MUST be checked BEFORE rate-limit gates so a locked account can still be bypassed.
    const isDevBypass = process.env.NODE_ENV === 'development' && (otp === '000000' || otp === '123456');

    if (!isDevBypass) {
      const locked = await isOtpLocked(phone);
      if (locked) throw new RateLimitError('Account is temporarily locked due to too many failed attempts.');
      const storedOtp = await getOtp(phone);
      if (!storedOtp) throw new UnauthorizedError('OTP has expired. Please request a new one.');

      // Get config for attempt limits
      const config_user = await prisma.user.findFirst({
        where: { phone, deleted_at: null, is_active: true },
      });
      const config = config_user
        ? await prisma.associationConfig.findUnique({ where: { association_id: config_user.association_id } })
        : null;
      const maxAttempts = config?.otp_max_attempts ?? 3;
      const lockoutMinutes = config?.otp_lockout_minutes ?? 15;

      if (storedOtp !== otp) {
        const { locked: nowLocked } = await incrementOtpAttempts(phone, maxAttempts, lockoutMinutes);
        throw new UnauthorizedError(nowLocked ? 'Account locked due to too many failed attempts.' : 'Invalid OTP.');
      }
    }

    const user = await prisma.user.findFirst({
      where: { phone, deleted_at: null, is_active: true },
    });

    if (!user) throw new NotFoundError('User');

    if (!isDevBypass) await deleteOtp(phone);

    return this.issueTokenPair(user);
  }

  // ── Google OAuth callback ────────────────────────────────────────────────────
  async handleGoogleCallback(googleSub: string, email: string, name: string): Promise<{ access_token: string; refresh_token: string; user: object }> {
    let user = await prisma.user.findFirst({
      where: { google_sub: googleSub, deleted_at: null },
    });

    if (!user && email) {
      user = await prisma.user.findFirst({
        where: { email, deleted_at: null },
      });
      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { google_sub: googleSub },
        });
      }
    }

    if (!user) throw new NotFoundError('User — please contact your association manager to get access');
    if (!user.is_active) throw new UnprocessableError('Account is inactive.');

    return this.issueTokenPair(user);
  }

  // ── Token Refresh ────────────────────────────────────────────────────────────
  async refreshToken(rawToken: string): Promise<{ access_token: string }> {
    const tokenHash = hashToken(rawToken);
    const stored = await prisma.refreshToken.findFirst({
      where: { token_hash: tokenHash, revoked_at: null },
      include: { user: { select: { id: true, association_id: true, role: true, unit_id: true, phone: true, name: true, is_active: true } } },
    });

    if (!stored || stored.expires_at < new Date()) {
      throw new UnauthorizedError('Refresh token is invalid or expired.');
    }
    if (!stored.user.is_active) throw new UnauthorizedError('Account is inactive.');

    // Rotate: revoke old, issue new access token
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked_at: new Date() } });

    const access_token = signAccessToken({
      sub: stored.user.id,
      aid: stored.user.association_id,
      role: stored.user.role,
      unit_id: stored.user.unit_id,
    });

    return { access_token };
  }

  // ── Logout ───────────────────────────────────────────────────────────────────
  async logout(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { user_id: userId, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }

  // ── Private helpers ──────────────────────────────────────────────────────────
  private async issueTokenPair(user: { id: string; association_id: string; role: string; unit_id: string | null; phone: string; name: string }) {
    const payload = {
      sub: user.id,
      aid: user.association_id,
      role: user.role as never,
      unit_id: user.unit_id,
    };

    const access_token = signAccessToken(payload);
    const rawRefresh = generateToken(32);
    const tokenHash = hashToken(rawRefresh);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Fetch association name for display in dashboard/header
    const config = await prisma.associationConfig.findUnique({
      where: { association_id: user.association_id },
      select: { association_name: true },
    });

    await prisma.refreshToken.create({
      data: {
        association_id: user.association_id,
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    });

    return {
      access_token,
      refresh_token: rawRefresh,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        association_id: user.association_id,
        association_name: config?.association_name ?? null,
        unit_id: user.unit_id,
      },
    };
  }
}

export const authService = new AuthService();
