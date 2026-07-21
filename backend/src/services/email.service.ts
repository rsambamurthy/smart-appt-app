import sgMail from '@sendgrid/mail';
import logger from '../utils/logger';

// Only initialise SendGrid when a real API key is present
const sgApiKey = process.env.SENDGRID_API_KEY ?? '';
const sgEnabled = sgApiKey && !sgApiKey.startsWith('<');
if (sgEnabled) {
  sgMail.setApiKey(sgApiKey);
} else {
  logger.warn('SENDGRID_API_KEY not configured — email sending disabled');
}

const FROM = { email: process.env.SENDGRID_FROM_EMAIL!, name: process.env.SENDGRID_FROM_NAME! };

// Template IDs defined in SendGrid dashboard
const TEMPLATES: Record<string, string> = {
  BILL_GENERATED: 'd-bill-generated',
  PAYMENT_RECEIVED: 'd-payment-received',
  TICKET_CREATED: 'd-ticket-created',
  ANNOUNCEMENT_POSTED: 'd-announcement',
  EXPENSE_PENDING_APPROVAL: 'd-expense-approval',
};

class EmailService {
  async send(to: string, type: string, dynamicData: Record<string, unknown>): Promise<void> {
    if (process.env.NODE_ENV === 'development' || !sgEnabled) {
      logger.info(`[EMAIL-DEV] to ${to} type ${type}`, dynamicData);
      return;
    }
    const templateId = TEMPLATES[type];
    if (!templateId) { logger.warn('No email template for type', { type }); return; }

    try {
      await sgMail.send({ to, from: FROM, templateId, dynamicTemplateData: dynamicData });
    } catch (err) {
      logger.error('SendGrid send failed', { to, type, error: (err as Error).message });
    }
  }
}

export const emailService = new EmailService();
