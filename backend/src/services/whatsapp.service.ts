import https from 'https';
import logger from '../utils/logger';

const WA_HOST = 'graph.facebook.com';
const WA_API_PATH = '/v21.0';

class WhatsAppService {
  private get phoneNumberId(): string {
    return process.env.WHATSAPP_PHONE_NUMBER_ID ?? '';
  }

  private get accessToken(): string {
    return process.env.WHATSAPP_ACCESS_TOKEN ?? '';
  }

  private isConfigured(): boolean {
    return !!(this.phoneNumberId && this.accessToken && !this.accessToken.startsWith('<'));
  }

  // Meta requires E.164 without leading '+'
  private toMetaPhone(phone: string): string {
    return phone.startsWith('+') ? phone.slice(1) : phone;
  }

  // Low-level HTTPS POST using Node's built-in https module (avoids fetch issues in Alpine)
  private post(path: string, payload: object): Promise<{ ok: boolean; status: number; body: unknown }> {
    return new Promise((resolve, reject) => {
      const bodyStr = JSON.stringify(payload);
      const options: https.RequestOptions = {
        hostname: WA_HOST,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
          Authorization: `Bearer ${this.accessToken}`,
        },
        timeout: 10000,
      };

      const req = https.request(options, (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try {
            const body = JSON.parse(raw);
            resolve({ ok: (res.statusCode ?? 500) < 300, status: res.statusCode ?? 500, body });
          } catch {
            resolve({ ok: false, status: res.statusCode ?? 500, body: raw });
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
      req.write(bodyStr);
      req.end();
    });
  }

  // Send OTP via WhatsApp — uses template if configured, falls back to text
  async sendOtp(phone: string, otp: string): Promise<{ sent: boolean; error?: string; meta_response?: unknown }> {
    if (!this.isConfigured()) {
      logger.info(`[WA-SKIP] WhatsApp not configured — OTP for ${phone}: ${otp}`);
      return { sent: false, error: 'WhatsApp not configured' };
    }

    const templateName = process.env.WHATSAPP_OTP_TEMPLATE;
    const templateLang = process.env.WHATSAPP_OTP_TEMPLATE_LANG ?? 'en';
    const to = this.toMetaPhone(phone);

    // Prefer template message (works outside 24h window; required for non-initiated conversations)
    const payload = templateName
      ? {
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: templateName,
            language: { code: templateLang },
            components: [
              {
                type: 'body',
                parameters: [{ type: 'text', text: otp }],
              },
            ],
          },
        }
      : {
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: {
            body: `Your SmartAppt OTP is *${otp}*. Valid for 5 minutes. Do not share this code.`,
          },
        };

    try {
      const res = await this.post(`${WA_API_PATH}/${this.phoneNumberId}/messages`, payload);

      // Always log the full Meta response so we can debug delivery issues
      logger.info('WhatsApp API response', { phone, status: res.status, body: JSON.stringify(res.body) });

      if (!res.ok) {
        const errMsg = (res.body as { error?: { message?: string; code?: number } })?.error?.message ?? `HTTP ${res.status}`;
        throw new Error(errMsg);
      }

      logger.info(`WhatsApp OTP sent to ${phone} via ${templateName ? `template "${templateName}"` : 'text'}`);
      return { sent: true, meta_response: res.body };
    } catch (err) {
      const error = (err as Error).message;
      logger.error('WhatsApp OTP send failed', { phone, error });
      return { sent: false, error };
    }
  }

  // Send a plain text WhatsApp message
  async sendMessage(phone: string, message: string): Promise<void> {
    if (!this.isConfigured()) {
      logger.info(`[WA-SKIP] WhatsApp not configured — message to ${phone}: ${message}`);
      return;
    }

    try {
      const payload = {
        messaging_product: 'whatsapp',
        to: this.toMetaPhone(phone),
        type: 'text',
        text: { body: message },
      };

      const res = await this.post(`${WA_API_PATH}/${this.phoneNumberId}/messages`, payload);

      if (!res.ok) {
        const errMsg = (res.body as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
        throw new Error(errMsg);
      }

      logger.info(`WhatsApp message sent to ${phone}`);
    } catch (err) {
      logger.error('WhatsApp message send failed', { phone, error: (err as Error).message });
    }
  }
}

export const whatsAppService = new WhatsAppService();
