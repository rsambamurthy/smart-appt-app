import crypto from 'crypto';
import prisma from '../../config/database';
import {
  setOtp, getOtp, deleteOtp, isOtpLocked, incrementOtpAttempts, checkOtpRequestLimit,
} from '../../config/redis';
import { signAccessToken, signRefreshToken, verifyToken } from '../../config/jwt';
import { generateOtp, generateToken, hashToken, normalisePhone } from '../../utils/helpers';
import { UnauthorizedError, ConflictError, RateLimitError, NotFoundError, UnprocessableError } from '../../utils/errors';
import { smsService } from '../../services/sms.service';
import logger from '../../utils/logger';
import { AuditAction } from '@prisma/client';
import { auditService } from '../../services/audit.service';

function hashMpin(mpin: string): string {
  return crypto.createHash('sha256').update(mpin).digest('hex');
}

export class AuthService {
  // ── OTP Request ─────────────────────────────────────────────────────────────
  async requestOtp(rawPhone: string): Promise<{
    delivery: { channel: string; sent: boolean };
    dev_otp?: string;
  }> {
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

    // Routed through smsService, not WhatsApp directly. WhatsApp is tried
    // first inside it, then Twilio. Calling WhatsApp here meant the SMS
    // fallback existed but was unreachable from the one path that needed it.
    const delivery = await smsService.sendOtp(phone, otp);

    if (delivery.sent) {
      // The code itself is never logged. It is a live credential for the next
      // five minutes, and anyone with log access should not be able to use it.
      logger.info('OTP dispatched', { phone, channel: delivery.channel });
      return { delivery: { channel: delivery.channel, sent: true } };
    }

    logger.error('OTP could not be delivered', { phone, error: delivery.error });

    // ESCAPE HATCH. Returning the code to the caller is an authentication
    // bypass: anyone who can post a phone number gets that person's login
    // code. It was previously unconditional. It is kept only so a broken
    // delivery channel cannot lock every user out of production, and it must
    // be turned off again the moment WhatsApp or Twilio is delivering.
    if (process.env.OTP_ECHO_UNSAFE === 'true') {
      logger.warn(
        'SECURITY: OTP_ECHO_UNSAFE is on — login codes are being returned in API responses. ' +
        'Anyone can obtain any user\'s code. Unset this as soon as OTP delivery works.',
        { phone },
      );
      return { delivery: { channel: 'none', sent: false }, dev_otp: otp };
    }

    throw new UnprocessableError(
      'We could not send your code. Please try again shortly, or contact your association.',
    );
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
        await auditService.record({
          entity_type: 'auth', action: AuditAction.LOGIN_FAILED,
          actor_label: phone,
          performed_by: config_user?.id ?? null,
          association_id: config_user?.association_id ?? null,
          summary: nowLocked ? 'OTP login failed — account locked' : 'OTP login failed — invalid OTP',
        });
        throw new UnauthorizedError(nowLocked ? 'Account locked due to too many failed attempts.' : 'Invalid OTP.');
      }
    }

    const user = await prisma.user.findFirst({
      where: { phone, deleted_at: null, is_active: true },
    });

    if (!user) {
      await auditService.record({
        entity_type: 'auth', action: AuditAction.LOGIN_FAILED,
        actor_label: phone, performed_by: null, association_id: null,
        summary: 'OTP login failed — no matching user',
      });
      throw new NotFoundError('User');
    }

    if (!isDevBypass) await deleteOtp(phone);

    await auditService.record({
      entity_type: 'auth', action: AuditAction.LOGIN,
      actor_label: phone, performed_by: user.id, association_id: user.association_id,
      summary: isDevBypass ? 'Signed in with OTP (dev bypass)' : 'Signed in with OTP',
    });

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

    await auditService.record({
      entity_type: 'auth', action: AuditAction.LOGOUT,
      performed_by: userId,
      summary: 'Signed out (refresh tokens revoked)',
    });
  }

  // ── M-PIN: check status ──────────────────────────────────────────────────────
  async getMpinStatus(rawPhone: string): Promise<{ has_mpin: boolean }> {
    const phone = normalisePhone(rawPhone);
    const user = await prisma.user.findFirst({ where: { phone, deleted_at: null, is_active: true } });
    return { has_mpin: !!(user?.mpin_hash) };
  }

  // ── M-PIN: verify (login) ────────────────────────────────────────────────────
  async verifyMpin(rawPhone: string, mpin: string): Promise<{ access_token: string; refresh_token: string; user: object }> {
    const phone = normalisePhone(rawPhone);
    const user = await prisma.user.findFirst({ where: { phone, deleted_at: null, is_active: true } });

    // Failed attempts are recorded with the phone as the actor label, since
    // there may be no matching user to attribute them to.
    if (!user) {
      await auditService.record({
        entity_type: 'auth', action: AuditAction.LOGIN_FAILED,
        actor_label: phone, performed_by: null, association_id: null,
        summary: 'M-PIN login failed — no matching user',
      });
      throw new NotFoundError('User');
    }
    if (!user.mpin_hash) {
      await auditService.record({
        entity_type: 'auth', action: AuditAction.LOGIN_FAILED,
        actor_label: phone, performed_by: user.id, association_id: user.association_id,
        summary: 'M-PIN login failed — no M-PIN set',
      });
      throw new UnauthorizedError('M-PIN not set. Please login with OTP.');
    }
    if (user.mpin_hash !== hashMpin(mpin)) {
      await auditService.record({
        entity_type: 'auth', action: AuditAction.LOGIN_FAILED,
        actor_label: phone, performed_by: user.id, association_id: user.association_id,
        summary: 'M-PIN login failed — incorrect M-PIN',
      });
      throw new UnauthorizedError('Incorrect M-PIN.');
    }

    await auditService.record({
      entity_type: 'auth', action: AuditAction.LOGIN,
      actor_label: phone, performed_by: user.id, association_id: user.association_id,
      summary: 'Signed in with M-PIN',
    });

    return this.issueTokenPair(user);
  }

  // ── M-PIN: set (after OTP verify, authenticated) ─────────────────────────────
  async setMpin(userId: string, mpin: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { mpin_hash: hashMpin(mpin) },
    });

    // Credential change — record the event only, never the M-PIN itself.
    await auditService.record({
      entity_type: 'auth', action: AuditAction.MPIN_SET,
      performed_by: userId,
      summary: 'M-PIN set',
    });
  }

  // ── M-PIN: reset via OTP ──────────────────────────────────────────────────────
  async resetMpin(rawPhone: string, otp: string, newMpin: string): Promise<void> {
    const phone = normalisePhone(rawPhone);
    const storedOtp = await getOtp(phone);
    if (!storedOtp || storedOtp !== otp) throw new UnauthorizedError('Invalid or expired OTP.');
    const user = await prisma.user.findFirst({ where: { phone, deleted_at: null, is_active: true } });
    if (!user) throw new NotFoundError('User');
    await prisma.user.update({ where: { id: user.id }, data: { mpin_hash: hashMpin(newMpin) } });
    await deleteOtp(phone);

    await auditService.record({
      entity_type: 'auth', action: AuditAction.MPIN_RESET,
      actor_label: phone, performed_by: user.id, association_id: user.association_id,
      summary: 'M-PIN reset via OTP',
    });
  }

  // ── M-PIN: change (authenticated, requires current M-PIN) ────────────────────
  async changeMpin(userId: string, currentMpin: string, newMpin: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User');
    if (!user.mpin_hash) throw new UnauthorizedError('No M-PIN set. Use set M-PIN instead.');

    if (user.mpin_hash !== hashMpin(currentMpin)) {
      // A wrong current M-PIN is a failed credential-change attempt.
      await auditService.record({
        entity_type: 'auth', action: AuditAction.LOGIN_FAILED,
        actor_label: user.phone, performed_by: user.id, association_id: user.association_id,
        summary: 'M-PIN change failed — current M-PIN incorrect',
      });
      throw new UnauthorizedError('Current M-PIN is incorrect.');
    }

    await prisma.user.update({ where: { id: userId }, data: { mpin_hash: hashMpin(newMpin) } });

    await auditService.record({
      entity_type: 'auth', action: AuditAction.MPIN_RESET,
      actor_label: user.phone, performed_by: user.id, association_id: user.association_id,
      summary: 'M-PIN changed (with current M-PIN)',
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

    // Fetch association name + unit flat number for display in mobile header
    const [config, unit] = await Promise.all([
      prisma.associationConfig.findUnique({
        where: { association_id: user.association_id },
        select: { association_name: true },
      }),
      user.unit_id
        ? prisma.unit.findUnique({ where: { id: user.unit_id }, select: { flat_number: true, block: true } })
        : null,
    ]);

    const unitNumber = unit
      ? (unit.block ? `${unit.block}-${unit.flat_number}` : unit.flat_number)
      : null;

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
        unit_number: unitNumber,
      },
    };
  }
}

export const authService = new AuthService();
