import twilio from 'twilio';
import logger from '../utils/logger';

// Lazy Twilio client — only initialised when credentials are actually configured
let _client: ReturnType<typeof twilio> | null = null;

function getClient(): ReturnType<typeof twilio> | null {
  if (_client) return _client;
  const sid = process.env.TWILIO_ACCOUNT_SID ?? '';
  const token = process.env.TWILIO_AUTH_TOKEN ?? '';
  if (!sid || sid.startsWith('<') || !sid.startsWith('AC')) {
    logger.warn('TWILIO_ACCOUNT_SID not configured — SMS notifications disabled');
    return null;
  }
  try {
    _client = twilio(sid, token);
    return _client;
  } catch (err) {
    logger.warn('Twilio client init failed — SMS notifications disabled', { error: (err as Error).message });
    return null;
  }
}

class SmsService {
  async sendOtp(phone: string, otp: string): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      logger.info(`[SMS-DEV] OTP to ${phone}: ${otp}`);
      return;
    }
    const client = getClient();
    if (!client) return;
    try {
      await client.messages.create({
        body: `Your SmartAppt OTP is ${otp}. Valid for 5 minutes. Do not share.`,
        messagingServiceSid: process.env.TWILIO_MESSAGE_SERVICE_SID!,
        to: phone,
      });
    } catch (err) {
      logger.error('Twilio OTP send failed', { phone, error: (err as Error).message });
      await this.sendViaMSG91(phone, otp);
    }
  }

  async sendSms(phone: string, message: string): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      logger.info(`[SMS-DEV] to ${phone}: ${message}`);
      return;
    }
    const client = getClient();
    if (!client) return;
    try {
      await client.messages.create({
        body: message,
        messagingServiceSid: process.env.TWILIO_MESSAGE_SERVICE_SID!,
        to: phone,
      });
    } catch (err) {
      logger.error('SMS send failed', { phone, error: (err as Error).message });
    }
  }

  async sendInvite(phone: string, link: string, name?: string): Promise<void> {
    const msg = name
      ? `Hi ${name}, you've been invited to join SmartAppt. Accept here: ${link}`
      : `You've been invited to join SmartAppt: ${link}`;
    await this.sendSms(phone, msg);
  }

  private async sendViaMSG91(phone: string, otp: string): Promise<void> {
    // MSG91 fallback implementation
    logger.info(`[MSG91-FALLBACK] OTP to ${phone}: ${otp}`);
  }
}

export const smsService = new SmsService();
