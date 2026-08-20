import { Job } from 'bull';
import prisma from '../../config/database';
import { fcmService } from '../../services/fcm.service';
import { smsService } from '../../services/sms.service';
import { emailService } from '../../services/email.service';
import { NotificationJob } from '../../types';
import logger from '../../utils/logger';

const NOTIFICATION_MESSAGES: Record<string, { title: string; body: string }> = {
  TICKET_CREATED: { title: 'New Maintenance Request', body: 'A new maintenance ticket has been raised.' },
  TICKET_ASSIGNED: { title: 'Ticket Assigned', body: 'A maintenance ticket has been assigned.' },
  TICKET_STATUS_CHANGED: { title: 'Ticket Update', body: 'Your maintenance request status has been updated.' },
  SLA_BREACH: { title: '⚠️ SLA Breach', body: 'A maintenance ticket has breached its SLA.' },
  BILL_GENERATED: { title: 'Monthly Bill', body: 'Your monthly maintenance bill has been generated.' },
  PAYMENT_RECEIVED: { title: 'Payment Confirmed', body: 'Your payment has been received successfully.' },
  DUES_REMINDER: { title: 'Dues Reminder', body: 'Your maintenance dues are pending.' },
  EXPENSE_PENDING_APPROVAL: { title: 'Expense Needs Approval', body: 'An expense is awaiting your approval.' },
  EXPENSE_DECISION: { title: 'Expense Update', body: 'An expense has been reviewed.' },
  RECURRING_EXPENSE_DUE: { title: 'Recurring Expense Due', body: 'A recurring expense is due and needs approval.' },
  EXPENSE_PROVISIONED: { title: 'Month-End Provision Posted', body: 'A recurring expense was provisioned for this month pending the actual bill.' },
  ANNOUNCEMENT_POSTED: { title: 'New Announcement', body: 'A new announcement has been posted.' },
  URGENT_ANNOUNCEMENT: { title: '🚨 Urgent Notice', body: 'An urgent announcement has been posted.' },
  VISITOR_WALKIN: { title: 'Visitor at Gate', body: 'Someone is requesting entry to your flat.' },
  VISITOR_ENTRY: { title: 'Visitor Entered', body: 'Your visitor has entered the premises.' },
  EMERGENCY_ALERT: { title: '🚨 EMERGENCY', body: 'An emergency has been reported at the gate.' },
  CHAT_MESSAGE: { title: 'New message', body: 'You have a new message.' },
};

export const processNotificationJob = async (job: Job<NotificationJob>): Promise<void> => {
  const { type, channels, recipients, data } = job.data;
  logger.info('Processing notification', { type, recipients: recipients.length });

  // Every other notification type is one fixed title/body for the whole
  // batch. A chat message is about who sent what, which is different for
  // every recipient's inbox preview but identical for everyone receiving
  // this one job — so it's read off the job's own data rather than added
  // as a second templating system.
  const msg = type === 'CHAT_MESSAGE' && typeof data.sender_name === 'string'
    ? { title: data.sender_name, body: typeof data.preview === 'string' ? data.preview : 'sent you a message.' }
    : NOTIFICATION_MESSAGES[type] ?? { title: 'Notification', body: 'You have a new notification.' };

  const users = await prisma.user.findMany({
    where: { id: { in: recipients }, is_active: true, deleted_at: null },
    select: { id: true, fcm_token: true, phone: true, email: true, notification_prefs: true },
  });

  await Promise.all(
    channels.map(async (channel) => {
      if (channel === 'PUSH') {
        const tokens = users.map((u) => u.fcm_token).filter(Boolean) as string[];
        if (tokens.length) {
          await fcmService.sendToTokens(tokens, msg.title, msg.body, { type, ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) });
        }
      }
      if (channel === 'SMS') {
        for (const user of users) {
          if (user.phone) await smsService.sendSms(user.phone, `${msg.title}: ${msg.body}`);
        }
      }
      if (channel === 'EMAIL') {
        for (const user of users) {
          if (user.email) await emailService.send(user.email, type, { ...data, name: users.find((u) => u.id === user.id)?.id ?? '' });
        }
      }
    }),
  );
};
