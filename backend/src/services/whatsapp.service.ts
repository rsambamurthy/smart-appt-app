import { WhatsAppStatus } from '@prisma/client';
import prisma from '../config/database';
import logger from '../utils/logger';

/**
 * WhatsApp via Meta's Cloud API.
 *
 * ONE SENDER, MANY ASSOCIATIONS. The number is Integrata's, verified once
 * against our own business documents. No housing society is going to complete
 * Meta business verification with a GST certificate and a template review
 * queue, so the alternative is nobody gets WhatsApp at all. Every template
 * therefore names the association in its body — the resident must be able to
 * tell who is asking them for money.
 *
 * The cost of that choice: a template abused by one association can get the
 * shared number rate-limited or paused for everyone. Hence the per-association
 * daily cap below, and the message log that makes volume visible before Meta
 * makes it visible for us.
 *
 * EVERYTHING FAILS SOFT. A bill run that dies because WhatsApp is down is a
 * worse outcome than a bill nobody was texted about. Every send is wrapped,
 * logged, and swallowed. The log is how you find out, not an exception.
 */

const GRAPH = 'https://graph.facebook.com/v21.0';

/** Templates we have submitted to Meta. Names must match exactly. */
export const TEMPLATES = {
  DUE_NOTICE:        'smartappt_due_notice',
  PAYMENT_CONFIRMED: 'smartappt_payment_confirmed',
  PAYMENT_REJECTED:  'smartappt_payment_rejected',
  /**
   * Reference only. The OTP path reads WHATSAPP_OTP_TEMPLATE instead, because
   * a template name that lives in an env var can be corrected without a
   * deploy — and a login that cannot be corrected without a deploy is the
   * wrong thing to hardcode.
   */
  LOGIN_OTP:         'smartappt_login_otp',
} as const;

/**
 * A crude guard against one association burning the shared number's quota.
 * Deliberately generous — it is a circuit breaker, not a billing control.
 */
const DAILY_CAP_PER_ASSOCIATION = Number(process.env.WHATSAPP_DAILY_CAP ?? 2000);

function config() {
  // Both names are read. WHATSAPP_ACCESS_TOKEN is what is already set on
  // Railway; WHATSAPP_TOKEN is what this file was originally written against.
  // Reading only the new one would have disabled WhatsApp everywhere and left
  // no error behind, because `enabled` false means every path silently skips.
  const token   = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || '';
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? '';
  return {
    token,
    phoneId,
    // The '<' check rejects a placeholder like <your-token-here> left in an
    // env file, which otherwise reads as configured and fails on every send.
    enabled: !!token && !token.startsWith('<') && !!phoneId,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? '',
  };
}

/**
 * Meta wants E.164 without the leading '+'. Indian numbers arrive here in
 * several shapes depending on how they were typed years ago, so normalise
 * rather than trusting the column.
 */
export function toWaNumber(phone: string): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `91${digits}`;          // bare Indian mobile
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  // Anything else is either already international or wrong; let Meta decide
  // rather than silently mangling a legitimate foreign number.
  return digits.length >= 10 ? digits : null;
}

interface SendArgs {
  associationId: string;
  userId?:       string | null;
  phone:         string;
  template:      string;
  /** Body variables, in order. Meta positional parameters are 1-indexed. */
  variables:     string[];
  /** Optional document header, e.g. the due notice PDF. */
  document?:     { mediaId: string; filename: string };
  referenceType?: string;
  referenceId?:   string;
  /** 'en' unless a template was localised. */
  language?:     string;
}

class WhatsAppService {

  get enabled() { return config().enabled; }

  /**
   * Upload a file to Meta and get a media id.
   *
   * Preferred over hosting the PDF ourselves: no public URL means no bill
   * readable by anyone who guesses a link, and no signed-URL expiry to get
   * wrong. Media ids last long enough to send with.
   */
  async uploadMedia(buffer: Buffer, filename: string, mimeType: string): Promise<string | null> {
    const c = config();
    if (!c.enabled) return null;

    try {
      const form = new FormData();
      form.append('messaging_product', 'whatsapp');
      form.append('type', mimeType);
      form.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), filename);

      const res = await fetch(`${GRAPH}/${c.phoneId}/media`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${c.token}` },
        body:    form,
      });
      const json = await res.json() as { id?: string; error?: { message?: string } };
      if (!res.ok || !json.id) {
        logger.error('WhatsApp media upload failed', { error: json.error?.message ?? res.statusText });
        return null;
      }
      return json.id;
    } catch (err) {
      logger.error('WhatsApp media upload threw', { error: (err as Error).message });
      return null;
    }
  }

  /**
   * Send one template message.
   *
   * Returns the log row id, never throws. Callers are billing runs and login
   * flows; neither should fall over because Meta had a bad minute.
   */
  async sendTemplate(args: SendArgs): Promise<string | null> {
    const c = config();
    const to = toWaNumber(args.phone);

    // Logged even when we cannot send, so "why did nobody get it" has an
    // answer that is not "no idea".
    const row = await prisma.whatsAppMessage.create({
      data: {
        association_id: args.associationId,
        user_id:        args.userId ?? null,
        to_phone:       to ?? args.phone,
        template:       args.template,
        variables:      args.variables as never,
        reference_type: args.referenceType ?? null,
        reference_id:   args.referenceId ?? null,
        status:         WhatsAppStatus.QUEUED,
      },
      select: { id: true },
    });

    const fail = async (code: string, message: string) => {
      await prisma.whatsAppMessage.update({
        where: { id: row.id },
        data:  {
          status: WhatsAppStatus.FAILED, error_code: code,
          error_message: message, failed_at: new Date(),
        },
      });
      logger.warn('WhatsApp not sent', { id: row.id, code, message });
      return row.id;
    };

    if (!c.enabled)  return fail('NOT_CONFIGURED', 'WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID is not set.');
    if (!to)         return fail('BAD_NUMBER', `Could not read "${args.phone}" as a phone number.`);

    // Shared-number protection. Checked per association, per day.
    const since = new Date(); since.setHours(0, 0, 0, 0);
    const sentToday = await prisma.whatsAppMessage.count({
      where: {
        association_id: args.associationId,
        created_at:     { gte: since },
        status:         { in: [WhatsAppStatus.SENT, WhatsAppStatus.DELIVERED, WhatsAppStatus.READ] },
      },
    });
    if (sentToday >= DAILY_CAP_PER_ASSOCIATION) {
      return fail('DAILY_CAP', `This association has already sent ${sentToday} messages today.`);
    }

    const components: unknown[] = [];
    if (args.document) {
      components.push({
        type: 'header',
        parameters: [{
          type: 'document',
          document: { id: args.document.mediaId, filename: args.document.filename },
        }],
      });
    }
    if (args.variables.length) {
      components.push({
        type: 'body',
        parameters: args.variables.map(v => ({ type: 'text', text: v })),
      });
    }

    try {
      const res = await fetch(`${GRAPH}/${c.phoneId}/messages`, {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${c.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: args.template,
            language: { code: args.language ?? 'en' },
            ...(components.length ? { components } : {}),
          },
        }),
      });

      const json = await res.json() as {
        messages?: Array<{ id: string }>;
        error?: { message?: string; code?: number; error_data?: { details?: string } };
      };

      if (!res.ok || !json.messages?.[0]?.id) {
        const e = json.error;
        return fail(
          String(e?.code ?? res.status),
          e?.error_data?.details ?? e?.message ?? res.statusText,
        );
      }

      await prisma.whatsAppMessage.update({
        where: { id: row.id },
        data:  {
          status: WhatsAppStatus.SENT,
          wa_message_id: json.messages[0].id,
          sent_at: new Date(),
        },
      });
      return row.id;
    } catch (err) {
      return fail('NETWORK', (err as Error).message);
    }
  }

  /**
   * OTP over WhatsApp.
   *
   * Not routed through sendTemplate: an OTP has no association and no user row
   * yet at first login, and it must not be logged with its code in the
   * variables column. Losing the delivery record is the right trade for not
   * storing a live credential.
   *
   * The template NAME comes from WHATSAPP_OTP_TEMPLATE rather than the
   * TEMPLATES table, and falls back to a plain text message when it is unset.
   * That is the behaviour this method already had before the file was
   * rewritten, and login is the one path that must not change underneath a
   * working deployment. A hardcoded name would silently break every login the
   * moment it disagreed with what is approved in Meta.
   *
   * Returns the shape auth.service expects; never throws.
   */
  async sendOtp(phone: string, otp: string): Promise<{ sent: boolean; error?: string; meta_response?: unknown }> {
    const c  = config();
    const to = toWaNumber(phone);

    if (!c.enabled) {
      logger.info(`[WA-SKIP] WhatsApp not configured — OTP for ${phone}: ${otp}`);
      return { sent: false, error: 'WhatsApp not configured' };
    }
    if (!to) return { sent: false, error: `Could not read "${phone}" as a phone number.` };

    const templateName = process.env.WHATSAPP_OTP_TEMPLATE;
    const templateLang = process.env.WHATSAPP_OTP_TEMPLATE_LANG ?? 'en';

    // An authentication-category template needs the code on the button too;
    // that is what produces the one-tap copy. Utility templates have no
    // button, and sending a button component to one is rejected — hence the
    // opt-in switch rather than always sending it.
    const withButton = process.env.WHATSAPP_OTP_TEMPLATE_BUTTON === 'true';

    const payload = templateName
      ? {
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: templateName,
            language: { code: templateLang },
            components: [
              { type: 'body', parameters: [{ type: 'text', text: otp }] },
              ...(withButton
                ? [{ type: 'button', sub_type: 'url', index: '0',
                     parameters: [{ type: 'text', text: otp }] }]
                : []),
            ],
          },
        }
      : {
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: `Your SmartAppt OTP is *${otp}*. Valid for 5 minutes. Do not share this code.` },
        };

    try {
      const res  = await fetch(`${GRAPH}/${c.phoneId}/messages`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const body = await res.json() as { error?: { message?: string; code?: number } };

      // The full response is logged deliberately: delivery problems here are
      // invisible otherwise, and this is how the previous version was debugged.
      logger.info('WhatsApp API response', { phone, status: res.status, body: JSON.stringify(body) });

      if (!res.ok) {
        const error = body?.error?.message ?? `HTTP ${res.status}`;
        logger.error('WhatsApp OTP send failed', { phone, error });
        return { sent: false, error };
      }
      return { sent: true, meta_response: body };
    } catch (err) {
      const error = (err as Error).message;
      logger.error('WhatsApp OTP send failed', { phone, error });
      return { sent: false, error };
    }
  }

  /** Boolean form, for the SMS fallback chain in sms.service. */
  async sendOtpTemplate(phone: string, otp: string): Promise<boolean> {
    const { sent } = await this.sendOtp(phone, otp);
    return sent;
  }

  /** Plain text message. Kept because it predates this file's rewrite. */
  async sendMessage(phone: string, message: string): Promise<void> {
    const c  = config();
    const to = toWaNumber(phone);
    if (!c.enabled || !to) {
      logger.info(`[WA-SKIP] WhatsApp not configured — message to ${phone}`);
      return;
    }
    try {
      const res = await fetch(`${GRAPH}/${c.phoneId}/messages`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: message } }),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: { message?: string } };
        logger.error('WhatsApp message send failed', { phone, error: json.error?.message ?? res.statusText });
      }
    } catch (err) {
      logger.error('WhatsApp message send failed', { phone, error: (err as Error).message });
    }
  }

  /**
   * Meta's webhook verification handshake. Returns the challenge to echo, or
   * null when the token does not match.
   */
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    const c = config();
    if (mode === 'subscribe' && c.verifyToken && token === c.verifyToken) return challenge;
    return null;
  }

  /**
   * Delivery receipts.
   *
   * Meta resends statuses and delivers them out of order, so this only ever
   * moves a message forward — a late "sent" must not overwrite a "read", or
   * the log would report worse delivery than actually happened.
   */
  async handleStatusWebhook(body: unknown): Promise<void> {
    const RANK: Record<string, number> = { QUEUED: 0, SENT: 1, DELIVERED: 2, READ: 3, FAILED: 3 };

    try {
      const entries = (body as {
        entry?: Array<{ changes?: Array<{ value?: {
          statuses?: Array<{
            id: string; status: string; timestamp: string;
            errors?: Array<{ code?: number; title?: string; message?: string }>;
          }>;
        } }> }>;
      }).entry ?? [];

      for (const entry of entries) {
        for (const change of entry.changes ?? []) {
          for (const st of change.value?.statuses ?? []) {
            const existing = await prisma.whatsAppMessage.findUnique({
              where:  { wa_message_id: st.id },
              select: { id: true, status: true },
            });
            if (!existing) continue;

            const next = st.status.toUpperCase();
            if (!(next in RANK)) continue;
            if (RANK[next] <= RANK[existing.status]) continue;

            const at = new Date(Number(st.timestamp) * 1000);
            const err = st.errors?.[0];

            await prisma.whatsAppMessage.update({
              where: { id: existing.id },
              data: {
                status: next as WhatsAppStatus,
                ...(next === 'DELIVERED' ? { delivered_at: at } : {}),
                ...(next === 'READ'      ? { read_at: at } : {}),
                ...(next === 'FAILED'    ? {
                  failed_at: at,
                  error_code: err?.code ? String(err.code) : 'FAILED',
                  error_message: err?.message ?? err?.title ?? null,
                } : {}),
              },
            });
          }
        }
      }
    } catch (err) {
      // A malformed webhook must not 500 back at Meta — they retry, and
      // repeated failures get the endpoint disabled.
      logger.error('WhatsApp webhook parse failed', { error: (err as Error).message });
    }
  }
}

export const whatsappService = new WhatsAppService();

/**
 * The name this service was exported under before the rewrite. Kept as an
 * alias so an import that predates it does not fail at build — or, worse,
 * get "fixed" by pointing it somewhere that behaves differently.
 */
export const whatsAppService = whatsappService;
