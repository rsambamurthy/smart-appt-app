import prisma from '../../config/database';
import logger from '../../utils/logger';
import { whatsappService, TEMPLATES } from '../../services/whatsapp.service';
import { renderNoticePdf } from './notice-pdf.service';

/**
 * Telling residents things over WhatsApp.
 *
 * Everything here is best-effort and returns quietly. These are called from a
 * bill run and from a treasurer clicking Confirm; neither should fail because
 * Meta rate-limited us or a resident blocked the sender. What went wrong is in
 * `whatsapp_messages`, which is the point of that table.
 *
 * Consent is checked here rather than in the transport, so there is exactly one
 * place that decides whether a person may be messaged.
 */

const money = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

/**
 * Who to message for a flat, and whether we are allowed to.
 *
 * Returns null rather than throwing when there is nobody, because a flat with
 * no registered resident is normal — vacant units exist — and is not an error
 * worth interrupting a bill run for.
 */
async function recipientForUnit(unitId: string) {
  const user = await prisma.user.findFirst({
    where: {
      unit_id: unitId, is_active: true, deleted_at: null,
      whatsapp_opt_in: true,
    },
    select: { id: true, name: true, phone: true, whatsapp_phone: true },
    orderBy: [{ is_owner: 'desc' }, { created_at: 'asc' }],
  });
  if (!user) return null;
  return { ...user, sendTo: user.whatsapp_phone ?? user.phone };
}

class DuesNotifyService {

  /**
   * Send a bill as a WhatsApp document, with the payment QR inside the PDF.
   *
   * This is the whole point of the integration: a resident who never opens
   * SmartAppt can still see what they owe and pay it, because the notice and
   * the means to pay arrive in the same message.
   */
  async sendDueNotice(associationId: string, billId: string): Promise<void> {
    if (!whatsappService.enabled) return;

    try {
      const bill = await prisma.bill.findFirst({
        where:  { id: billId, association_id: associationId },
        select: { id: true, unit_id: true },
      });
      if (!bill) return;

      const to = await recipientForUnit(bill.unit_id);
      if (!to) return;                     // nobody, or nobody who opted in

      // Imported lazily to break a genuine cycle: upi.service calls this file
      // on confirm/reject, and this file needs upi.service for the notice
      // payload. A top-level import leaves one of the two singletons undefined
      // depending on which module Node loads first — it happens to work until
      // an import order changes, and then fails at runtime rather than build.
      const { upiService } = await import('./upi.service');

      // Reuses the endpoint's own payload, so the PDF cannot disagree with the
      // screen about the amount or the payee. `notice` needs a caller identity
      // for its resident check; the recipient is the resident of this flat, so
      // passing them is both true and the narrowest choice.
      const { data } = await upiService.notice(
        associationId, bill.id, to.id, 'RESIDENT' as never,
      );
      if (data.amounts.due <= 0) return;   // nothing owed, nothing to chase

      const pdf = await renderNoticePdf(data);
      const filename = `Due-${data.bill.flat_number}-${data.bill.reference}.pdf`;
      const mediaId = await whatsappService.uploadMedia(pdf, filename, 'application/pdf');
      if (!mediaId) return;                // upload logged its own failure

      await whatsappService.sendTemplate({
        associationId,
        userId:   to.id,
        phone:    to.sendTo,
        template: TEMPLATES.DUE_NOTICE,
        document: { mediaId, filename },
        variables: [
          data.association.name,
          `${data.bill.flat_number}${data.bill.block ? ` ${data.bill.block}` : ''}`,
          data.bill.label,
          money(data.amounts.due),
          fmtDate(data.bill.due_date),
        ],
        referenceType: 'DUES_BILL',
        referenceId:   bill.id,
      });
    } catch (err) {
      logger.error('Due notice WhatsApp failed', { billId, error: (err as Error).message });
    }
  }

  /** Send notices for a whole run. Sequential on purpose — see below. */
  async sendDueNoticesForBills(associationId: string, billIds: string[]): Promise<void> {
    if (!whatsappService.enabled) return;
    // One at a time rather than Promise.all: a hundred simultaneous sends is
    // how a fresh WhatsApp number gets flagged, and the run is not urgent.
    for (const id of billIds) {
      await this.sendDueNotice(associationId, id);
    }
  }

  /** The treasurer accepted the payment. Tell them, so they stop wondering. */
  async paymentConfirmed(
    associationId: string,
    opts: { unitId: string; amount: number; reference: string; billLabel: string; billId: string },
  ): Promise<void> {
    if (!whatsappService.enabled) return;
    try {
      const to = await recipientForUnit(opts.unitId);
      if (!to) return;

      const assoc = await prisma.association.findUnique({
        where: { id: associationId }, select: { name: true },
      });

      await whatsappService.sendTemplate({
        associationId,
        userId:   to.id,
        phone:    to.sendTo,
        template: TEMPLATES.PAYMENT_CONFIRMED,
        variables: [
          assoc?.name ?? 'Your association',
          money(opts.amount),
          opts.billLabel,
          opts.reference,
        ],
        referenceType: 'DUES_BILL',
        referenceId:   opts.billId,
      });
    } catch (err) {
      logger.error('Payment confirmed WhatsApp failed', { error: (err as Error).message });
    }
  }

  /**
   * The treasurer could not match it. The reason travels with the message —
   * a rejection the resident cannot act on just produces a phone call.
   */
  async paymentRejected(
    associationId: string,
    opts: { unitId: string; amount: number; reference: string; reason: string; billId: string },
  ): Promise<void> {
    if (!whatsappService.enabled) return;
    try {
      const to = await recipientForUnit(opts.unitId);
      if (!to) return;

      const assoc = await prisma.association.findUnique({
        where: { id: associationId }, select: { name: true },
      });

      await whatsappService.sendTemplate({
        associationId,
        userId:   to.id,
        phone:    to.sendTo,
        template: TEMPLATES.PAYMENT_REJECTED,
        variables: [
          assoc?.name ?? 'Your association',
          money(opts.amount),
          opts.reference,
          // Templates reject newlines in parameters, and a 1024-char body cap
          // applies across all of them.
          opts.reason.replace(/\s+/g, ' ').slice(0, 300),
        ],
        referenceType: 'DUES_BILL',
        referenceId:   opts.billId,
      });
    } catch (err) {
      logger.error('Payment rejected WhatsApp failed', { error: (err as Error).message });
    }
  }
}

export const duesNotifyService = new DuesNotifyService();
