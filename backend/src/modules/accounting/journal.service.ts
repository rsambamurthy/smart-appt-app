import { AccountType, JournalEntryType } from '@prisma/client';
import prisma from '../../config/database';
import { UnprocessableError } from '../../utils/errors';
import { CreateJournalEntryBody } from './journal.schema';
import logger from '../../utils/logger';

// ── Payment mode → account code ───────────────────────────────────────────────
// CASH → 1001 (Cash in Hand), everything else → 1002 (Bank Account)
function cashOrBankCode(paymentMode: string): string {
  return paymentMode === 'CASH' ? '1001' : '1002';
}

class JournalService {

  // ── Get account by code (throws if not found) ─────────────────────────────
  private async getAccount(associationId: string, code: string) {
    const account = await prisma.account.findUnique({
      where: { association_id_code: { association_id: associationId, code } },
    });
    if (!account) throw new Error(`Account ${code} not found — please seed Chart of Accounts first.`);
    return account;
  }

  // ── Core post: creates JournalEntry + lines, validates balance ─────────────
  private async post(associationId: string, opts: {
    entry_date:     Date;
    narration:      string;
    reference_type?: string;
    reference_id?:   string;
    type:            JournalEntryType;
    created_by?:     string;
    lines: { account_id: string; debit: number; credit: number; narration?: string | null }[];
  }) {
    const totalDebit  = opts.lines.reduce((s, l) => s + l.debit,  0);
    const totalCredit = opts.lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.005) {
      throw new UnprocessableError(
        `Journal entry unbalanced: debit ₹${totalDebit.toFixed(2)} ≠ credit ₹${totalCredit.toFixed(2)}`
      );
    }

    return prisma.journalEntry.create({
      data: {
        association_id: associationId,
        entry_date:     opts.entry_date,
        narration:      opts.narration,
        reference_type: opts.reference_type,
        reference_id:   opts.reference_id,
        type:           opts.type,
        created_by:     opts.created_by,
        lines: {
          create: opts.lines.map(l => ({
            account_id: l.account_id,
            debit:      l.debit,
            credit:     l.credit,
            narration:  l.narration,
          })),
        },
      },
      include: {
        lines: { include: { account: { select: { code: true, name: true, type: true } } } },
      },
    });
  }

  // ── AUTO-POST: Bill generated (one call per bill) ─────────────────────────
  // DR 1004 Dues Receivable / CR 3001 Maintenance Income
  async postBillGenerated(
    associationId: string,
    billId:        string,
    amount:        number,
    narration:     string,
  ) {
    try {
      const [duesReceivable, maintenanceIncome] = await Promise.all([
        this.getAccount(associationId, '1004'),
        this.getAccount(associationId, '3001'),
      ]);
      await this.post(associationId, {
        entry_date:     new Date(),
        narration,
        reference_type: 'DUES_BILL',
        reference_id:   billId,
        type:           JournalEntryType.AUTO,
        lines: [
          { account_id: duesReceivable.id,   debit: amount, credit: 0,      narration: 'Dues billed' },
          { account_id: maintenanceIncome.id, debit: 0,      credit: amount, narration: 'Maintenance income' },
        ],
      });
    } catch (err) {
      logger.error('Auto-post failed (bill generated)', { billId, error: err });
    }
  }

  // ── AUTO-POST: Payment received ───────────────────────────────────────────
  // DR 1001/1002 (Cash/Bank) / CR 1004 Dues Receivable
  async postPaymentReceived(
    associationId: string,
    paymentId:     string,
    amount:        number,
    paymentMode:   string,
    narration:     string,
  ) {
    try {
      const [cashOrBank, duesReceivable] = await Promise.all([
        this.getAccount(associationId, cashOrBankCode(paymentMode)),
        this.getAccount(associationId, '1004'),
      ]);
      await this.post(associationId, {
        entry_date:     new Date(),
        narration,
        reference_type: 'PAYMENT',
        reference_id:   paymentId,
        type:           JournalEntryType.AUTO,
        lines: [
          { account_id: cashOrBank.id,      debit: amount, credit: 0,      narration: 'Payment received' },
          { account_id: duesReceivable.id,  debit: 0,      credit: amount, narration: 'Dues cleared' },
        ],
      });
    } catch (err) {
      logger.error('Auto-post failed (payment received)', { paymentId, error: err });
    }
  }

  // ── AUTO-POST: Expense ────────────────────────────────────────────────────
  // DR Expense account (matched by category name or first EXPENSE) / CR 1001/1002
  async postExpense(
    associationId: string,
    expenseId:     string,
    amount:        number,
    paymentMode:   string,
    category:      string,
    narration:     string,
  ) {
    try {
      // Try to find a matching expense account by name
      let expenseAccount = await prisma.account.findFirst({
        where: {
          association_id: associationId,
          type:           AccountType.EXPENSE,
          is_active:      true,
          name:           { contains: category, mode: 'insensitive' },
        },
      });
      // Fall back to account 4008 (Administrative), then first EXPENSE account
      if (!expenseAccount) {
        expenseAccount = await prisma.account.findUnique({
          where: { association_id_code: { association_id: associationId, code: '4008' } },
        });
      }
      if (!expenseAccount) {
        expenseAccount = await prisma.account.findFirst({
          where: { association_id: associationId, type: AccountType.EXPENSE, is_active: true },
          orderBy: { sort_order: 'asc' },
        });
      }
      if (!expenseAccount) throw new Error('No expense account found.');

      const cashOrBank = await this.getAccount(associationId, cashOrBankCode(paymentMode));

      await this.post(associationId, {
        entry_date:     new Date(),
        narration,
        reference_type: 'EXPENSE',
        reference_id:   expenseId,
        type:           JournalEntryType.AUTO,
        lines: [
          { account_id: expenseAccount.id, debit: amount, credit: 0,      narration: category },
          { account_id: cashOrBank.id,     debit: 0,      credit: amount, narration: 'Payment made' },
        ],
      });
    } catch (err) {
      logger.error('Auto-post failed (expense)', { expenseId, error: err });
    }
  }

  // ── AUTO-POST: Other Receipt ──────────────────────────────────────────────
  // DR 1001/1002 (Cash/Bank) / CR 3002 Other Receipts
  async postOtherReceipt(
    associationId: string,
    receiptId:     string,
    amount:        number,
    paymentMode:   string,
    narration:     string,
  ) {
    try {
      const [cashOrBank, otherReceipts] = await Promise.all([
        this.getAccount(associationId, cashOrBankCode(paymentMode)),
        this.getAccount(associationId, '3002'),
      ]);
      await this.post(associationId, {
        entry_date:     new Date(),
        narration,
        reference_type: 'OTHER_RECEIPT',
        reference_id:   receiptId,
        type:           JournalEntryType.AUTO,
        lines: [
          { account_id: cashOrBank.id,    debit: amount, credit: 0,      narration: 'Receipt received' },
          { account_id: otherReceipts.id, debit: 0,      credit: amount, narration: 'Other income' },
        ],
      });
    } catch (err) {
      logger.error('Auto-post failed (other receipt)', { receiptId, error: err });
    }
  }

  // ── LIST entries ──────────────────────────────────────────────────────────
  async listEntries(
    associationId: string,
    query: { cursor?: string; limit?: number; type?: string; from?: string; to?: string },
  ) {
    const take = Math.min(query.limit ?? 50, 200);
    const where: Record<string, unknown> = { association_id: associationId };
    if (query.type) where['type'] = query.type;
    if (query.from || query.to) {
      where['entry_date'] = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to   ? { lte: new Date(query.to)   } : {}),
      };
    }

    const entries = await prisma.journalEntry.findMany({
      where: where as never,
      include: {
        lines: {
          include: {
            account: { select: { code: true, name: true, type: true } },
          },
        },
      },
      orderBy: [{ entry_date: 'desc' }, { created_at: 'desc' }],
      take,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
    });

    const nextCursor = entries.length === take ? entries[entries.length - 1].id : null;
    return { data: entries, nextCursor };
  }

  // ── CREATE manual entry ────────────────────────────────────────────────────
  async createManual(
    associationId: string,
    body:          CreateJournalEntryBody,
    createdBy:     string,
  ) {
    const totalDebit  = body.lines.reduce((s, l) => s + (l.debit  ?? 0), 0);
    const totalCredit = body.lines.reduce((s, l) => s + (l.credit ?? 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.005) {
      throw new UnprocessableError(
        `Entry is unbalanced: debit ₹${totalDebit.toFixed(2)} ≠ credit ₹${totalCredit.toFixed(2)}`
      );
    }

    const entry = await this.post(associationId, {
      entry_date: new Date(body.entry_date),
      narration:  body.narration,
      type:       JournalEntryType.MANUAL,
      created_by: createdBy,
      lines:      body.lines.map(l => ({
        account_id: l.account_id,
        debit:      l.debit  ?? 0,
        credit:     l.credit ?? 0,
        narration:  l.narration,
      })),
    });

    return { data: entry };
  }
}

export const journalService = new JournalService();
