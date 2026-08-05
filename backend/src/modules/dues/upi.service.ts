import { AuditAction, BPCategory, BillStatus, PaymentClaimStatus, PaymentMode, Prisma, UserRole } from '@prisma/client';
import prisma from '../../config/database';
import { NotFoundError, UnprocessableError, ForbiddenError, ConflictError } from '../../utils/errors';
import { journalService } from '../accounting/journal.service';
import { auditService } from '../../services/audit.service';

/**
 * Paying by UPI, without a payment gateway.
 *
 * The app opens PhonePe/GPay with the amount and payee filled in. That is all
 * it can do: a `upi://pay` link produces no callback to a WebView, and even a
 * native UPI intent response is documented as untrustworthy. So the app never
 * learns whether the money moved.
 *
 * The design follows from that honestly rather than pretending otherwise:
 *
 *   1. The resident pays, then types the UTR their UPI app showed them.
 *   2. That becomes a CLAIM — visible to them as "Paid, to be confirmed" —
 *      which changes no balance and touches no ledger.
 *   3. A treasurer matches the UTR against the bank statement and confirms.
 *      Only then does a Payment exist, with a journal entry behind it.
 *
 * The alternative — trusting the resident — would let anyone clear their own
 * arrears with a button, and would put money in the accounts that the bank
 * never received. Neither is recoverable by a committee six months later.
 */

const num = (d: unknown) => Number(d ?? 0);
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Roles that may confirm money has arrived. */
const REVIEWER_ROLES: UserRole[] = [UserRole.TREASURER, UserRole.MANAGER, UserRole.SUPER_USER];

/**
 * A UPI address is `something@handle`. Validated because a typo here means
 * every resident's money goes to a stranger, or nowhere, and the association
 * finds out weeks later.
 */
const VPA_RE = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9.]{1,30}$/;

export function isValidVpa(vpa: string): boolean {
  return VPA_RE.test(vpa.trim());
}

/**
 * UTRs are 12 digits for most UPI transfers, but banks and apps show other
 * forms — some alphanumeric, some longer. Rejecting anything but 12 digits
 * would block honest residents holding a valid receipt, so this stays loose
 * and leaves the real check to the treasurer, who has the bank statement.
 */
export function isPlausibleUtr(ref: string): boolean {
  const r = ref.trim();
  return r.length >= 6 && r.length <= 35 && /^[A-Za-z0-9]+$/.test(r);
}

/**
 * Build a `upi://pay` deep link.
 *
 * Pure, and exported, so the exact string can be tested without a database —
 * this is the one piece where a wrong character sends money to the wrong place.
 *
 * `tr` is our own reference. Whether it survives into the association's bank
 * statement narration depends on the bank, so it is a convenience for matching
 * rather than something to depend on.
 */
export function buildUpiUri(opts: {
  vpa: string; payeeName: string; amount: number; note: string; ref: string;
}): string {
  const p = new URLSearchParams({
    pa: opts.vpa,
    pn: opts.payeeName,
    am: opts.amount.toFixed(2),
    cu: 'INR',
    tn: opts.note.slice(0, 50),
    tr: opts.ref,
  });
  // URLSearchParams encodes spaces as '+', which some UPI apps pass through
  // literally into the payee name. %20 is understood everywhere.
  return `upi://pay?${p.toString().replace(/\+/g, '%20')}`;
}

export class UpiService {

  /**
   * Is UPI set up, and which bank account collects it?
   *
   * The VPA lives on the bank record rather than here, because a UPI address
   * credits exactly one bank account. Reading it from anywhere else would let
   * the two drift, and the symptom of that drift is money arriving somewhere
   * the books do not expect.
   */
  async config(associationId: string) {
    const cfg = await prisma.duesConfig.findUnique({
      where:  { association_id: associationId },
      select: {
        upi_bank_bp_id: true,
        upi_bank: {
          select: {
            id: true, name: true, code: true, is_active: true,
            upi_vpa: true, upi_payee_name: true,
            account_number: true,
          },
        },
      },
    });

    const bank = cfg?.upi_bank;
    // A deactivated bank must not keep collecting money.
    const usable = !!bank?.upi_vpa && bank.is_active;

    return {
      data: {
        enabled:      usable,
        bank_bp_id:   bank?.id ?? null,
        bank_name:    bank?.name ?? null,
        upi_vpa:      usable ? bank!.upi_vpa : null,
        // Falls back to the bank's own name — never to the association's,
        // since the whole point is that they can differ.
        payee_name:   bank?.upi_payee_name ?? bank?.name ?? '',
        account_hint: bank?.account_number
          ? `••••${bank.account_number.slice(-4)}`
          : null,
      },
    };
  }

  /** Bank accounts that could collect UPI, for the treasurer to choose from. */
  async collectionAccounts(associationId: string) {
    const banks = await prisma.businessPartner.findMany({
      where:  { association_id: associationId, bp_category: BPCategory.BANK },
      select: {
        id: true, code: true, name: true, is_active: true,
        upi_vpa: true, upi_payee_name: true, account_number: true,
      },
      orderBy: [{ is_active: 'desc' }, { name: 'asc' }],
    });
    const cfg = await prisma.duesConfig.findUnique({
      where:  { association_id: associationId },
      select: { upi_bank_bp_id: true },
    });
    return {
      data: banks.map(b => ({
        ...b,
        selected: b.id === cfg?.upi_bank_bp_id,
      })),
    };
  }

  /** Set or clear the UPI details on one bank account. */
  async saveBankUpi(
    associationId: string,
    bpId: string,
    body: { upi_vpa: string | null; upi_payee_name?: string | null },
    updatedBy: string,
  ) {
    const vpa = (body.upi_vpa ?? '').trim();
    if (vpa && !isValidVpa(vpa)) {
      throw new UnprocessableError(
        'That does not look like a UPI ID. It should read like name@bank, for example parkavenue@okhdfcbank.',
      );
    }

    const bank = await prisma.businessPartner.findFirst({
      where:  { id: bpId, association_id: associationId, bp_category: BPCategory.BANK },
      select: { id: true, name: true, upi_vpa: true },
    });
    if (!bank) throw new NotFoundError('Bank account');

    try {
      await prisma.businessPartner.update({
        where: { id: bank.id },
        data: {
          upi_vpa:        vpa || null,
          upi_payee_name: (body.upi_payee_name ?? '').trim() || null,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError('Another bank account already uses that UPI ID.');
      }
      throw err;
    }

    // Where residents' money lands is exactly the setting worth being able to
    // prove was changed, by whom, and when.
    await auditService.record({
      entity_type:    'bank_upi',
      entity_id:      bank.id,
      association_id: associationId,
      action:         AuditAction.UPDATE,
      summary:        vpa
        ? `UPI ID for ${bank.name} set to ${vpa}`
        : `UPI ID removed from ${bank.name}`,
      old_value:      { upi_vpa: bank.upi_vpa },
      new_value:      { upi_vpa: vpa || null },
      performed_by:   updatedBy,
    });

    return this.collectionAccounts(associationId);
  }

  /** Choose which bank account collects dues by UPI. */
  async selectCollectionAccount(associationId: string, bpId: string | null, updatedBy: string) {
    const existing = await prisma.duesConfig.findUnique({
      where:  { association_id: associationId },
      select: { id: true, upi_bank_bp_id: true },
    });
    if (!existing) throw new UnprocessableError('Complete the fee configuration first.');

    if (bpId) {
      const bank = await prisma.businessPartner.findFirst({
        where:  { id: bpId, association_id: associationId, bp_category: BPCategory.BANK },
        select: { id: true, upi_vpa: true, is_active: true },
      });
      if (!bank) throw new NotFoundError('Bank account');
      if (!bank.upi_vpa) {
        throw new UnprocessableError('Add a UPI ID to that bank account before selecting it.');
      }
      if (!bank.is_active) {
        throw new UnprocessableError('That bank account is inactive.');
      }
    }

    await prisma.duesConfig.update({
      where: { association_id: associationId },
      data:  { upi_bank_bp_id: bpId, updated_by: updatedBy },
    });

    await auditService.record({
      entity_type:    'upi_config',
      entity_id:      existing.id,
      association_id: associationId,
      action:         AuditAction.UPDATE,
      summary:        bpId ? 'Changed the UPI collection account' : 'UPI collection turned off',
      old_value:      { upi_bank_bp_id: existing.upi_bank_bp_id },
      new_value:      { upi_bank_bp_id: bpId },
      performed_by:   updatedBy,
    });

    return this.config(associationId);
  }

  /**
   * The deep link for one bill, plus what is already claimed against it.
   *
   * Built here rather than on the device so the payee and the amount are ours,
   * not whatever the client felt like sending.
   */
  async intentForBill(associationId: string, billId: string, userId: string, role: UserRole) {
    const bill = await prisma.bill.findFirst({
      where:  { id: billId, association_id: associationId },
      select: {
        id: true, unit_id: true, total_amount: true, status: true,
        period_month: true, period_year: true, bill_label: true,
        unit: { select: { flat_number: true, block: true } },
        payments: { select: { amount: true } },
        claims: {
          where:  { status: PaymentClaimStatus.PENDING },
          select: { id: true, amount: true, upi_reference: true, claimed_at: true },
        },
      },
    });
    if (!bill) throw new NotFoundError('Bill');

    // A resident may only pay their own flat's bill.
    const privileged = REVIEWER_ROLES.includes(role) || role === UserRole.COMMITTEE;
    if (!privileged) {
      const me = await prisma.user.findUnique({
        where: { id: userId }, select: { unit_id: true },
      });
      if (me?.unit_id !== bill.unit_id) throw new NotFoundError('Bill');
    }

    const cfg = await this.config(associationId);
    if (!cfg.data.enabled || !cfg.data.upi_vpa) {
      throw new UnprocessableError(
        'This association has not set up UPI collection yet. Ask the treasurer to add the association UPI ID.',
      );
    }

    const paid = bill.payments.reduce((s, p) => s + num(p.amount), 0);
    const due  = Math.round((num(bill.total_amount) - paid) * 100) / 100;
    if (due <= 0) throw new UnprocessableError('This bill is already settled.');

    const label = bill.bill_label
      ?? `Maintenance ${String(bill.period_month).padStart(2, '0')}/${bill.period_year}`;
    const flat  = bill.unit.flat_number;

    // Short, stable, and meaningful to a human reading a bank statement.
    const ref = `SA${bill.id.replace(/-/g, '').slice(0, 10).toUpperCase()}`;

    return {
      data: {
        upi_uri: buildUpiUri({
          vpa:       cfg.data.upi_vpa,
          payeeName: cfg.data.payee_name,
          amount:    due,
          note:      `${flat} ${label}`,
          ref,
        }),
        amount:     due,
        payee_name: cfg.data.payee_name,
        upi_vpa:    cfg.data.upi_vpa,
        intent_ref: ref,
        flat_number: flat,
        description: label,
        // If something is already awaiting confirmation, the app must say so
        // rather than invite a second payment.
        pending_claim: bill.claims[0]
          ? {
              id:            bill.claims[0].id,
              amount:        num(bill.claims[0].amount),
              upi_reference: bill.claims[0].upi_reference,
              claimed_at:    bill.claims[0].claimed_at.toISOString(),
            }
          : null,
      },
    };
  }

  /** The resident says they have paid. Nothing is settled by this. */
  async claim(
    associationId: string,
    userId: string,
    role: UserRole,
    body: { bill_id: string; amount: number; upi_reference: string; paid_on?: string; intent_ref?: string },
  ) {
    const ref = (body.upi_reference ?? '').trim();
    if (!isPlausibleUtr(ref)) {
      throw new UnprocessableError(
        'Enter the UPI reference number shown in your payment app — usually 12 digits.',
      );
    }
    if (!(body.amount > 0)) throw new UnprocessableError('Enter the amount you paid.');

    const bill = await prisma.bill.findFirst({
      where:  { id: body.bill_id, association_id: associationId },
      select: {
        id: true, unit_id: true, total_amount: true,
        unit: { select: { flat_number: true } },
      },
    });
    if (!bill) throw new NotFoundError('Bill');

    const privileged = REVIEWER_ROLES.includes(role) || role === UserRole.COMMITTEE;
    if (!privileged) {
      const me = await prisma.user.findUnique({ where: { id: userId }, select: { unit_id: true } });
      if (me?.unit_id !== bill.unit_id) throw new NotFoundError('Bill');
    }

    const paidOn = body.paid_on ? new Date(body.paid_on) : new Date();
    if (Number.isNaN(paidOn.getTime())) throw new UnprocessableError('Invalid payment date.');
    // A payment cannot have happened tomorrow.
    if (paidOn > new Date()) throw new UnprocessableError('The payment date is in the future.');

    try {
      const claim = await prisma.paymentClaim.create({
        data: {
          association_id: associationId,
          bill_id:        bill.id,
          unit_id:        bill.unit_id,
          amount:         body.amount,
          upi_reference:  ref,
          intent_ref:     body.intent_ref ?? null,
          paid_on:        paidOn,
          claimed_by:     userId,
        },
      });
      return { data: { id: claim.id, status: claim.status } };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Two different collisions, and the resident needs to be told which.
        const dupe = await prisma.paymentClaim.findFirst({
          where: {
            association_id: associationId,
            upi_reference:  ref,
            status:         { not: PaymentClaimStatus.REJECTED },
          },
          select: { bill_id: true },
        });
        throw new ConflictError(
          dupe && dupe.bill_id !== bill.id
            ? 'That UPI reference has already been used for another bill.'
            : 'A payment for this bill is already waiting to be confirmed.',
        );
      }
      throw err;
    }
  }

  /** Claims a resident can see for their own flat. */
  async myClaims(associationId: string, unitId: string | null) {
    if (!unitId) return { data: [] };
    const rows = await prisma.paymentClaim.findMany({
      where:  { association_id: associationId, unit_id: unitId },
      select: {
        id: true, bill_id: true, amount: true, upi_reference: true,
        paid_on: true, status: true, review_note: true, reviewed_at: true,
      },
      orderBy: { claimed_at: 'desc' },
      take: 50,
    });
    return {
      data: rows.map(r => ({
        ...r,
        amount:      num(r.amount),
        paid_on:     iso(r.paid_on),
        reviewed_at: r.reviewed_at ? r.reviewed_at.toISOString() : null,
      })),
    };
  }

  /** The treasurer's queue. Oldest first — those residents have waited longest. */
  async pending(associationId: string, status: PaymentClaimStatus = PaymentClaimStatus.PENDING) {
    const rows = await prisma.paymentClaim.findMany({
      where:  { association_id: associationId, status },
      select: {
        id: true, amount: true, upi_reference: true, paid_on: true,
        claimed_at: true, status: true, review_note: true,
        unit:     { select: { flat_number: true, block: true } },
        claimant: { select: { name: true, phone: true } },
        reviewer: { select: { name: true } },
        bill: {
          select: {
            id: true, total_amount: true, period_month: true,
            period_year: true, bill_label: true, due_date: true,
          },
        },
      },
      orderBy: { claimed_at: 'asc' },
    });

    return {
      data: rows.map(r => ({
        id:            r.id,
        flat_number:   r.unit.flat_number,
        block:         r.unit.block,
        resident:      r.claimant.name,
        phone:         r.claimant.phone,
        amount:        num(r.amount),
        bill_total:    num(r.bill.total_amount),
        upi_reference: r.upi_reference,
        paid_on:       iso(r.paid_on),
        claimed_at:    r.claimed_at.toISOString(),
        status:        r.status,
        review_note:   r.review_note,
        reviewed_by:   r.reviewer?.name ?? null,
        period: r.bill.bill_label
          ?? `${String(r.bill.period_month).padStart(2, '0')}/${r.bill.period_year}`,
      })),
      totals: {
        count:  rows.length,
        amount: Math.round(rows.reduce((s, r) => s + num(r.amount), 0) * 100) / 100,
      },
    };
  }

  /**
   * Confirm the money arrived. This is the only path that creates a Payment.
   *
   * Everything happens in one transaction: the claim, the payment, the bill
   * status and the journal entry stand or fall together. A confirmed claim
   * with no payment behind it would be worse than no feature at all.
   */
  async confirm(associationId: string, reviewerId: string, role: UserRole, claimId: string) {
    if (!REVIEWER_ROLES.includes(role)) {
      throw new ForbiddenError('Only a treasurer or manager can confirm a payment.');
    }

    const claim = await prisma.paymentClaim.findFirst({
      where:  { id: claimId, association_id: associationId },
      select: {
        id: true, bill_id: true, unit_id: true, amount: true,
        upi_reference: true, paid_on: true, status: true,
        bill: { select: { total_amount: true, unit: { select: { flat_number: true } } } },
      },
    });
    if (!claim) throw new NotFoundError('Payment claim');
    if (claim.status !== PaymentClaimStatus.PENDING) {
      throw new UnprocessableError('This claim has already been reviewed.');
    }

    const amount = num(claim.amount);
    const flat   = claim.bill.unit.flat_number;
    const now    = new Date();

    // Which bank actually received it, so the entry credits that account
    // rather than a single undifferentiated "Bank Account".
    const cfg = await this.config(associationId);

    const payment = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          association_id: associationId,
          bill_id:        claim.bill_id,
          unit_id:        claim.unit_id,
          amount,
          // PaymentMode has no UPI member, and adding one would need
          // ALTER TYPE ... ADD VALUE — which Postgres refuses inside the
          // transaction Prisma wraps every migration in. ONLINE is accurate
          // anyway; `gateway` is what distinguishes this from Razorpay.
          payment_mode:   PaymentMode.ONLINE,
          payment_date:   claim.paid_on,
          reference_no:   claim.upi_reference,
          recorded_by:    reviewerId,
          gateway:        'upi-direct',
        },
      });

      await tx.paymentClaim.update({
        where: { id: claim.id },
        data: {
          status:      PaymentClaimStatus.CONFIRMED,
          reviewed_by: reviewerId,
          reviewed_at: now,
          payment_id:  created.id,
        },
      });

      // Recomputed from every payment on the bill, not from this one, so a
      // second part-payment settles the bill rather than overwriting it.
      const totals = await tx.payment.aggregate({
        where: { bill_id: claim.bill_id },
        _sum:  { amount: true },
      });
      const paid = num(totals._sum.amount);
      await tx.bill.update({
        where: { id: claim.bill_id },
        data:  {
          status: paid >= num(claim.bill.total_amount) ? BillStatus.PAID : BillStatus.PARTIAL,
        },
      });

      return created;
    });

    // Outside the transaction, matching how every other payment path posts.
    // A missing entry here is recoverable from the payment row; a rolled-back
    // confirmation the treasurer believes they made is not.
    journalService.postPaymentReceived(
      associationId, payment.id, amount, PaymentMode.ONLINE,
      `UPI payment received — Flat ${flat} (UTR ${claim.upi_reference})`,
      claim.paid_on,
      cfg.data.bank_bp_id ?? undefined,
    );

    await auditService.record({
      entity_type:    'payment_claim',
      entity_id:      claim.id,
      association_id: associationId,
      action:         AuditAction.UPDATE,
      summary:        `Confirmed UPI payment of ₹${amount.toFixed(2)} from Flat ${flat} (UTR ${claim.upi_reference})`,
      new_value:      { payment_id: payment.id, upi_reference: claim.upi_reference },
    });

    return { data: { id: claim.id, payment_id: payment.id } };
  }

  /** Refuse a claim. The reason is mandatory — the resident has to act on it. */
  async reject(
    associationId: string, reviewerId: string, role: UserRole,
    claimId: string, note: string,
  ) {
    if (!REVIEWER_ROLES.includes(role)) {
      throw new ForbiddenError('Only a treasurer or manager can reject a payment.');
    }
    const reason = (note ?? '').trim();
    if (reason.length < 5) {
      throw new UnprocessableError(
        'Say why it is being rejected — the resident needs to know what to correct.',
      );
    }

    const claim = await prisma.paymentClaim.findFirst({
      where:  { id: claimId, association_id: associationId },
      select: { id: true, status: true, upi_reference: true,
                unit: { select: { flat_number: true } } },
    });
    if (!claim) throw new NotFoundError('Payment claim');
    if (claim.status !== PaymentClaimStatus.PENDING) {
      throw new UnprocessableError('This claim has already been reviewed.');
    }

    await prisma.paymentClaim.update({
      where: { id: claim.id },
      data: {
        status:      PaymentClaimStatus.REJECTED,
        reviewed_by: reviewerId,
        reviewed_at: new Date(),
        review_note: reason,
      },
    });

    await auditService.record({
      entity_type:    'payment_claim',
      entity_id:      claim.id,
      association_id: associationId,
      action:         AuditAction.UPDATE,
      summary:        `Rejected UPI claim from Flat ${claim.unit.flat_number} (UTR ${claim.upi_reference}): ${reason}`,
      new_value:      { status: 'REJECTED', review_note: reason },
    });

    return { data: { id: claim.id, status: PaymentClaimStatus.REJECTED } };
  }
}

export const upiService = new UpiService();
