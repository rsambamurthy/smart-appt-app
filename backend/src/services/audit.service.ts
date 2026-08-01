import { AuditAction, Prisma } from '@prisma/client';
import prisma from '../config/database';
import logger from '../utils/logger';
import { getContext } from '../utils/request-context';

/**
 * Central audit trail.
 *
 * Design rules:
 *  1. Recording an audit entry must NEVER break the business operation — every
 *     failure is caught and logged, never re-thrown.
 *  2. Actor, IP and user-agent come from the request context automatically, so
 *     callers only describe WHAT happened.
 *  3. Secrets are redacted before anything is persisted.
 */

/** Field names whose values must never reach the audit table. */
const REDACTED_KEYS = [
  'password', 'password_hash',
  'mpin', 'mpin_hash', 'new_mpin', 'old_mpin',
  'razorpay_key_secret', 'key_secret', 'secret',
  'access_token', 'refresh_token', 'token', 'authorization',
  'otp',
];

/** Deep-clone a value, replacing sensitive fields with '***redacted***'. */
export function redact(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value !== 'object') return value;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = REDACTED_KEYS.includes(k.toLowerCase())
      ? '***redacted***'
      : redact(v);
  }
  return out;
}

export interface AuditInput {
  /** e.g. 'journal_entry', 'account', 'mobile_config', 'auth' */
  entity_type: string;
  action: AuditAction;
  /** Row id when the event concerns one record. */
  entity_id?: string | null;
  /** Short human-readable line shown in the viewer. */
  summary?: string;
  old_value?: unknown;
  new_value?: unknown;
  /** Override the actor — used for auth events before/without a session. */
  actor_label?: string;
  /** Override association — needed for events outside a request. */
  association_id?: string | null;
  /** Override actor id — for background jobs or pre-session events. */
  performed_by?: string | null;
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return redact(value) as Prisma.InputJsonValue;
}

class AuditService {
  /**
   * Write one audit entry. Safe to await — it never throws.
   */
  async record(input: AuditInput): Promise<void> {
    try {
      const ctx = getContext();

      await prisma.auditLog.create({
        data: {
          association_id: input.association_id !== undefined
            ? input.association_id
            : (ctx.associationId ?? null),
          entity_type:  input.entity_type.slice(0, 50),
          entity_id:    input.entity_id ?? null,
          action:       input.action,
          performed_by: input.performed_by !== undefined
            ? input.performed_by
            : (ctx.userId ?? null),
          actor_label:  input.actor_label?.slice(0, 120) ?? null,
          ip_address:   ctx.ip?.slice(0, 45) ?? null,
          user_agent:   ctx.userAgent?.slice(0, 255) ?? null,
          summary:      input.summary?.slice(0, 255) ?? null,
          old_value:    toJson(input.old_value),
          new_value:    toJson(input.new_value),
        },
      });
    } catch (err) {
      // Never let auditing break the caller — but make the failure visible.
      logger.error('AUDIT WRITE FAILED', {
        entity_type: input.entity_type,
        action: input.action,
        entity_id: input.entity_id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /** Convenience wrapper for create events. */
  create(entity_type: string, entity_id: string, newValue: unknown, summary?: string) {
    return this.record({ entity_type, entity_id, action: AuditAction.CREATE, new_value: newValue, summary });
  }

  /** Convenience wrapper for update events (records both sides). */
  update(entity_type: string, entity_id: string, oldValue: unknown, newValue: unknown, summary?: string) {
    return this.record({ entity_type, entity_id, action: AuditAction.UPDATE, old_value: oldValue, new_value: newValue, summary });
  }

  /** Convenience wrapper for deletions — the old value is the evidence. */
  delete(entity_type: string, entity_id: string, oldValue: unknown, summary?: string) {
    return this.record({ entity_type, entity_id, action: AuditAction.DELETE, old_value: oldValue, summary });
  }
}

export const auditService = new AuditService();
