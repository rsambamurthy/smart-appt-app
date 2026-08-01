import { AccountType, AuditAction, JournalEntrySource, JournalStatus, VoucherType, ExpenseStatus, Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { NotFoundError, UnprocessableError } from '../../utils/errors';
import { CreateJournalEntryBody } from './journal.schema';
import logger from '../../utils/logger';
import { auditService } from '../../services/audit.service';
import { fyClosureService, getFinancialYear } from './fy-closure.service';

// Account types whose normal balance is DEBIT (DR increases balance)
const DEBIT_NORMAL = new Set<string>(['ASSET', 'EXPENSE']);

// Every scalar on a journal entry EXCEPT file_data. Prisma's `include` pulls
// all scalars, which would ship the attachment bytes with every list response,
// so list queries select these explicitly instead. has_attachment tells the UI
// whether to show a download link without transferring the file.
const ENTRY_FIELDS = {
  id: true, association_id: true, reference_code: true, voucher_type: true,
  financial_year: true, entry_date: true, narration: true, status: true,
  source: true, reference_type: true, reference_id: true,
  created_by_id: true, posted_by_id: true, posted_at: true,
  cancelled_by_id: true, cancelled_at: true, cancellation_reason: true,
  created_at: true, updated_at: true,
  file_name: true, mime_type: true,
} as const;

// DB-aware FY helper: reads start month from association config
async function getFY(associationId: string, date: Date): Promise<string> {
  const cfg = await fyClosureService.getConfig(associationId);
  return getFinancialYear(date, cfg.financial_year_start_month);
}

// Atomically increments VoucherSequence and returns the next reference code
async function nextReferenceCode(
  associationId: string,
  voucherType:   VoucherType,
  financialYear: string,
): Promise<string> {
  const seq = await prisma.voucherSequence.upsert({
    where: {
      association_id_voucher_type_financial_year: {
        association_id: associationId,
        voucher_type:   voucherType,
        financial_year: financialYear,
      },
    },
    create: {
      association_id: associationId,
      voucher_type:   voucherType,
      financial_year: financialYear,
      last_sequence:  1,
    },
    update: { last_sequence: { increment: 1 } },
  });
  return `${voucherType}-${financialYear}-${String(seq.last_sequence).padStart(4, '0')}`;
}

// ── Payment mode → account code ───────────────────────────────────────────────
// CASH → 1001 (Cash in Hand), everything else → 1002 (Bank Account)
function cashOrBankCode(paymentMode: string): string {
  return paymentMode === 'CASH' ? '1001' : '1002';
}

class JournalService {

  // ── Validate control account lines have a business partner ───────────────────
  private async validateControlAccounts(
    lines: { account_id: string; business_partner_id?: string | null }[],
  ) {
    const accountIds = [...new Set(lines.map(l => l.account_id))];
    const accounts   = await prisma.account.findMany({
      where:  { id: { in: accountIds } },
      select: { id: true, name: true, is_control_account: true },
    });
    const acctMap = new Map(accounts.map(a => [a.id, a]));

    for (const line of lines) {
      const acct = acctMap.get(line.account_id);
      if (acct?.is_control_account && !line.business_partner_id) {
        throw new UnprocessableError(
          `Account "${acct.name}" is a control account — a Business Partner is required on this line.`,
        );
      }
    }
  }

  // ── Classify cash and bank accounts ───────────────────────────────────────
  // By CODE, not by name. Name matching was fragile: renaming 1002 to
  // "HDFC Current A/c" made it stop counting as a bank account and every bank
  // entry silently became a journal voucher.
  //
  // Cash: 1001, plus any ASSET account whose sub_type is "Cash".
  // Bank: 1002, plus any ASSET account whose sub_type is "Bank".
  // Add a second bank account by giving it sub_type "Bank".
  private async getCashBankAccounts(associationId: string) {
    const accounts = await prisma.account.findMany({
      where: {
        association_id: associationId,
        type:           AccountType.ASSET,
        OR: [
          { code: { in: ['1001', '1002'] } },
          { sub_type: { in: ['Cash', 'Bank'], mode: 'insensitive' } },
        ],
      },
      select: { id: true, code: true, name: true, sub_type: true },
    });

    const cash = accounts.filter(a => a.code === '1001' || a.sub_type?.toLowerCase() === 'cash');
    const bank = accounts.filter(a => a.code === '1002' || a.sub_type?.toLowerCase() === 'bank');

    return {
      cash,
      bank,
      cashIds: new Set(cash.map(a => a.id)),
      bankIds: new Set(bank.map(a => a.id)),
    };
  }

  // ── Voucher type for a manual entry ───────────────────────────────────────
  // BV when the entry moves a bank account, CV when it moves cash, JV when it
  // touches neither. Bank wins if both appear, which only happens on a contra.
  private async inferManualVoucherType(
    associationId: string,
    lines: { account_id: string }[],
  ): Promise<VoucherType> {
    const { cashIds, bankIds } = await this.getCashBankAccounts(associationId);
    const ids = new Set(lines.map(l => l.account_id));

    for (const id of ids) if (bankIds.has(id)) return VoucherType.BV;
    for (const id of ids) if (cashIds.has(id)) return VoucherType.CV;
    return VoucherType.JV;
  }

  // ── Enforce the three voucher categories ──────────────────────────────────
  // Bank Payment/Receipt   — exactly one bank line, no cash line
  // Cash Payment/Receipt   — exactly one cash line, no bank line
  // Journal Voucher        — neither cash nor bank
  //
  // Keeping these distinct is what makes the Receipts & Payments account
  // derivable: it identifies receipts and payments by the cash side of an
  // entry, so an entry with two cash lines or none is ambiguous.
  private async validateVoucherType(
    associationId: string,
    requested: VoucherType,
    lines: { account_id: string }[],
  ) {
    const { cashIds, bankIds } = await this.getCashBankAccounts(associationId);
    const cashLines = lines.filter(l => cashIds.has(l.account_id));
    const bankLines = lines.filter(l => bankIds.has(l.account_id));

    if (requested === VoucherType.BV) {
      if (bankLines.length === 0) {
        throw new UnprocessableError('A Bank voucher must include one bank account line.');
      }
      if (bankLines.length > 1) {
        throw new UnprocessableError(
          'A Bank voucher may only touch one bank account. Use a Journal voucher to move money between two banks.',
        );
      }
      if (cashLines.length > 0) {
        throw new UnprocessableError(
          'A Bank voucher cannot also include a cash line. ' +
          'Record a cash-to-bank transfer as a Journal voucher with only the cash and bank lines.',
        );
      }
    } else if (requested === VoucherType.CV) {
      if (cashLines.length === 0) {
        throw new UnprocessableError('A Cash voucher must include one cash account line.');
      }
      if (cashLines.length > 1) {
        throw new UnprocessableError('A Cash voucher may only touch one cash account.');
      }
      if (bankLines.length > 0) {
        throw new UnprocessableError(
          'A Cash voucher cannot also include a bank line. ' +
          'Record a cash-to-bank transfer as a Journal voucher with only the cash and bank lines.',
        );
      }
    } else if (requested === VoucherType.JV) {
      const touchesMoney = cashLines.length + bankLines.length;
      // Carve-out: a transfer between cash and bank is legitimately a journal
      // entry — it is not a receipt or a payment, and the Receipts & Payments
      // account already excludes it as a contra. Allowed only when EVERY line
      // is a cash or bank account, so it cannot be used to smuggle an expense
      // through as a journal voucher.
      const isContra = touchesMoney > 1 && touchesMoney === lines.length;

      if (touchesMoney > 0 && !isContra) {
        throw new UnprocessableError(
          'A Journal voucher is for entries that do not involve cash or bank. ' +
          'Use a Cash or Bank voucher instead, or — for a transfer between cash and bank — ' +
          'make every line a cash or bank account.',
        );
      }
    }
  }

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
    entry_date:      Date;
    narration:       string;
    reference_type?: string;
    reference_id?:   string;
    voucher_type:    VoucherType;
    source:          JournalEntrySource;
    status?:         JournalStatus;
    created_by_id?:  string;
    lines: { account_id: string; business_partner_id?: string | null; debit: number; credit: number; narration?: string | null }[];
  }) {
    const totalDebit  = opts.lines.reduce((s, l) => s + l.debit,  0);
    const totalCredit = opts.lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.005) {
      throw new UnprocessableError(
        `Journal entry unbalanced: debit ₹${totalDebit.toFixed(2)} ≠ credit ₹${totalCredit.toFixed(2)}`
      );
    }

    const financial_year  = await getFY(associationId, opts.entry_date);
    const reference_code  = await nextReferenceCode(associationId, opts.voucher_type, financial_year);

    return prisma.journalEntry.create({
      data: {
        association_id: associationId,
        entry_date:     opts.entry_date,
        narration:      opts.narration,
        reference_type: opts.reference_type,
        reference_id:   opts.reference_id,
        voucher_type:   opts.voucher_type,
        source:         opts.source,
        status:         opts.status ?? JournalStatus.POSTED,
        financial_year,
        reference_code,
        created_by_id:  opts.created_by_id,
        lines: {
          create: opts.lines.map(l => ({
            account_id:          l.account_id,
            business_partner_id: l.business_partner_id ?? null,
            debit:               l.debit,
            credit:              l.credit,
            narration:           l.narration,
          })),
        },
      },
      include: {
        lines: {
          include: {
            account:          { select: { code: true, name: true, type: true } },
            business_partner: { select: { id: true, code: true, name: true } },
          },
        },
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
      // Best-effort: look up unit BP so sub-ledger can track per-unit balances
      let unitBPId: string | null = null;
      try {
        const bill = await prisma.bill.findUnique({ where: { id: billId }, select: { unit_id: true } });
        if (bill?.unit_id) {
          const bp = await prisma.businessPartner.findFirst({
            where: { association_id: associationId, unit_id: bill.unit_id },
            select: { id: true },
          });
          unitBPId = bp?.id ?? null;
        }
      } catch { /* non-fatal */ }

      await this.post(associationId, {
        entry_date:     new Date(),
        narration,
        reference_type: 'DUES_BILL',
        reference_id:   billId,
        voucher_type:   VoucherType.JV,
        source:         JournalEntrySource.AUTO,
        lines: [
          { account_id: duesReceivable.id,   business_partner_id: unitBPId, debit: amount, credit: 0,      narration: 'Dues billed' },
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
    entryDate?:    Date,   // use actual payment date; defaults to now
  ) {
    try {
      // Idempotency: skip if a JE already exists for this payment
      const existing = await prisma.journalEntry.findFirst({
        where: { association_id: associationId, reference_type: 'PAYMENT', reference_id: paymentId },
      });
      if (existing) {
        logger.info('postPaymentReceived: JE already exists, skipping', { paymentId, jeId: existing.id });
        return;
      }

      const [cashOrBank, duesReceivable] = await Promise.all([
        this.getAccount(associationId, cashOrBankCode(paymentMode)),
        this.getAccount(associationId, '1004'),
      ]);
      // Best-effort: look up unit BP for sub-ledger tracking
      let unitBPId: string | null = null;
      try {
        const payment = await prisma.payment.findUnique({ where: { id: paymentId }, select: { unit_id: true } });
        if (payment?.unit_id) {
          const bp = await prisma.businessPartner.findFirst({
            where: { association_id: associationId, unit_id: payment.unit_id },
            select: { id: true },
          });
          unitBPId = bp?.id ?? null;
        }
      } catch { /* non-fatal */ }

      await this.post(associationId, {
        entry_date:     entryDate ?? new Date(),
        narration,
        reference_type: 'PAYMENT',
        reference_id:   paymentId,
        voucher_type:   VoucherType.RV,
        source:         JournalEntrySource.AUTO,
        lines: [
          { account_id: cashOrBank.id,     debit: amount, credit: 0,      narration: 'Payment received' },
          { account_id: duesReceivable.id, business_partner_id: unitBPId, debit: 0, credit: amount, narration: 'Dues cleared' },
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
        voucher_type:   VoucherType.PV,
        source:         JournalEntrySource.AUTO,
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
        voucher_type:   VoucherType.RV,
        source:         JournalEntrySource.AUTO,
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
    if (query.type) where['source'] = query.type;  // 'type' query param mapped to source field
    if (query.from || query.to) {
      where['entry_date'] = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to   ? { lte: new Date(query.to)   } : {}),
      };
    }

    const entries = await prisma.journalEntry.findMany({
      where: where as never,
      select: {
        ...ENTRY_FIELDS,
        lines: {
          include: {
            account:          { select: { code: true, name: true, type: true } },
            business_partner: { select: { id: true, code: true, name: true } },
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

  // ── P&L: Income & Expenditure statement for a period ─────────────────────────
  // ── ATTACHMENT: upload ───────────────────────────────────────────────────────
  // One supporting document per entry — invoice, receipt, bank slip. Uploading
  // again replaces what is there. A cancelled or closed-year entry is left
  // alone: its paperwork is part of the record.
  async attachDocument(
    associationId: string,
    entryId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
  ) {
    const entry = await prisma.journalEntry.findFirst({
      where:  { id: entryId, association_id: associationId },
      select: { id: true, status: true, financial_year: true, reference_code: true },
    });
    if (!entry) throw new NotFoundError('Journal entry not found.');

    if (entry.status === JournalStatus.CANCELLED) {
      throw new UnprocessableError('This entry is cancelled — its attachment cannot be changed.');
    }
    if (await fyClosureService.isYearClosed(associationId, entry.financial_year)) {
      throw new UnprocessableError(
        `Financial year ${entry.financial_year} is closed. Reopen it to change attachments.`,
      );
    }

    const ALLOWED = [
      'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    ];
    if (!ALLOWED.includes(file.mimetype)) {
      throw new UnprocessableError(
        `${file.mimetype} is not an accepted file type. Upload a PDF or an image.`,
      );
    }

    await prisma.journalEntry.update({
      where: { id: entryId },
      data:  {
        file_data: file.buffer,
        file_name: file.originalname.slice(0, 255),
        mime_type: file.mimetype,
      },
    });

    await auditService.record({
      entity_type: 'journal_entry',
      entity_id:   entryId,
      action:      AuditAction.UPDATE,
      summary:     `Attached ${file.originalname} to ${entry.reference_code}`,
    });

    return { data: { file_name: file.originalname, mime_type: file.mimetype, size: file.buffer.length } };
  }

  // ── ATTACHMENT: fetch for download ───────────────────────────────────────────
  async getAttachment(associationId: string, entryId: string) {
    const entry = await prisma.journalEntry.findFirst({
      where:  { id: entryId, association_id: associationId },
      select: { file_data: true, file_name: true, mime_type: true, reference_code: true },
    });
    if (!entry)            throw new NotFoundError('Journal entry not found.');
    if (!entry.file_data)  throw new NotFoundError('This entry has no attachment.');
    return entry;
  }

  // ── ATTACHMENT: remove ───────────────────────────────────────────────────────
  async removeAttachment(associationId: string, entryId: string) {
    const entry = await prisma.journalEntry.findFirst({
      where:  { id: entryId, association_id: associationId },
      select: { id: true, file_name: true, financial_year: true, reference_code: true },
    });
    if (!entry) throw new NotFoundError('Journal entry not found.');

    if (await fyClosureService.isYearClosed(associationId, entry.financial_year)) {
      throw new UnprocessableError(
        `Financial year ${entry.financial_year} is closed. Reopen it to change attachments.`,
      );
    }

    await prisma.journalEntry.update({
      where: { id: entryId },
      data:  { file_data: null, file_name: null, mime_type: null },
    });

    await auditService.record({
      entity_type: 'journal_entry',
      entity_id:   entryId,
      action:      AuditAction.UPDATE,
      summary:     `Removed attachment ${entry.file_name ?? ''} from ${entry.reference_code}`,
    });

    return { data: { removed: true } };
  }

  // ── SHARED: per-account totals over a period ─────────────────────────────────
  // One definition of "what a period balance is", used by the Income &
  // Expenditure account, the Balance Sheet and their comparatives, so those
  // reports cannot drift apart. POSTED only; float8 to keep paise.
  private async accountTotals(
    associationId: string,
    opts: { to: Date; from?: Date; types?: AccountType[] },
  ) {
    type Row = {
      id: string; code: string; name: string; type: string; sub_type: string | null;
      total_debit: number; total_credit: number;
    };

    const types = opts.types ?? [
      AccountType.ASSET, AccountType.LIABILITY, AccountType.EQUITY,
      AccountType.INCOME, AccountType.EXPENSE,
    ];

    return prisma.$queryRaw<Row[]>`
      SELECT
        a.id, a.code, a.name, a.type, a.sub_type,
        COALESCE(SUM(jl.debit),  0)::float8 AS total_debit,
        COALESCE(SUM(jl.credit), 0)::float8 AS total_credit
      FROM accounts a
      LEFT JOIN journal_lines jl ON jl.account_id = a.id
      LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
        AND je.association_id = ${associationId}::uuid
        AND je.status = 'POSTED'::"JournalStatus"
        AND je.entry_date <= ${opts.to}
        ${opts.from ? Prisma.sql`AND je.entry_date >= ${opts.from}` : Prisma.empty}
      WHERE a.association_id = ${associationId}::uuid
        AND a.type = ANY(${types}::"AccountType"[])
        AND a.is_active = true
        AND a.is_group  = false
      GROUP BY a.id, a.code, a.name, a.type, a.sub_type, a.sort_order
      ORDER BY a.type, a.sort_order ASC, a.code ASC
    `;
  }

  // ── INCOME & EXPENDITURE ACCOUNT ─────────────────────────────────────────────
  // The accrual statement, in the terminology an association uses: Income and
  // Expenditure rather than revenue and cost, Surplus or Deficit rather than
  // profit. Grouped by sub_type so it reads as an auditor expects, with the
  // same period one year earlier as the comparative column.
  //
  // This will NOT agree with the Receipts & Payments account, and should not:
  // dues billed but uncollected are income with no receipt, and a fixed
  // deposit is a payment with no expenditure.
  async getIncomeExpenditure(
    associationId: string,
    query: { from: string; to: string; compare?: boolean },
  ) {
    const fromDate = new Date(query.from);
    const toDate   = new Date(query.to);

    const round2 = (n: number) => Math.round(n * 100) / 100;

    const build = async (from: Date, to: Date) => {
      const rows = await this.accountTotals(associationId, {
        from, to, types: [AccountType.INCOME, AccountType.EXPENSE],
      });

      const income:      { id: string; code: string; name: string; sub_type: string | null; amount: number }[] = [];
      const expenditure: { id: string; code: string; name: string; sub_type: string | null; amount: number }[] = [];

      for (const r of rows) {
        const dr = Number(r.total_debit);
        const cr = Number(r.total_credit);
        const row = { id: r.id, code: r.code, name: r.name, sub_type: r.sub_type, amount: 0 };
        if (r.type === AccountType.INCOME)  { row.amount = round2(cr - dr); income.push(row); }
        else                                { row.amount = round2(dr - cr); expenditure.push(row); }
      }

      const totalIncome      = round2(income     .reduce((s, r) => s + r.amount, 0));
      const totalExpenditure = round2(expenditure.reduce((s, r) => s + r.amount, 0));

      // Group by sub_type for presentation; accounts without one fall under Other.
      const group = (rowsIn: typeof income) => {
        const m = new Map<string, { label: string; rows: typeof income; total: number }>();
        for (const r of rowsIn) {
          const key = r.sub_type ?? 'Other';
          const g   = m.get(key) ?? { label: key, rows: [], total: 0 };
          g.rows.push(r);
          g.total = round2(g.total + r.amount);
          m.set(key, g);
        }
        return Array.from(m.values());
      };

      return {
        period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
        income,
        expenditure,
        incomeGroups:      group(income),
        expenditureGroups: group(expenditure),
        totalIncome,
        totalExpenditure,
        // Positive is a surplus, negative a deficit.
        surplus: round2(totalIncome - totalExpenditure),
      };
    };

    const current = await build(fromDate, toDate);

    // Comparative: the same span one year earlier.
    let previous: Awaited<ReturnType<typeof build>> | null = null;
    if (query.compare) {
      const shift = (d: Date) => {
        const x = new Date(d);
        x.setFullYear(x.getFullYear() - 1);
        return x;
      };
      previous = await build(shift(fromDate), shift(toDate));
    }

    return { data: { ...current, previous } };
  }

  async getPnL(associationId: string, query: { from: string; to: string }) {
    // Sum journal lines grouped by account for INCOME + EXPENSE accounts in period
    // NOTE: amounts are cast to float8, not bigint — Decimal(15,2) rounded to
    // bigint discards paise and makes reports disagree with the ledger.
    // NOTE: only POSTED entries count. DRAFT entries are not yet accounts, and
    // CANCELLED entries have been reversed out.
    type Row = { id: string; code: string; name: string; sub_type: string | null; total_debit: number; total_credit: number };
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT
        a.id, a.code, a.name, a.sub_type,
        COALESCE(SUM(jl.debit),  0)::float8 AS total_debit,
        COALESCE(SUM(jl.credit), 0)::float8 AS total_credit
      FROM accounts a
      LEFT JOIN journal_lines jl ON jl.account_id = a.id
      LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
        AND je.association_id = ${associationId}::uuid
        AND je.status = 'POSTED'::"JournalStatus"
        AND je.entry_date BETWEEN ${new Date(query.from)} AND ${new Date(query.to)}
      WHERE a.association_id = ${associationId}::uuid
        AND a.type IN ('INCOME','EXPENSE')
        AND a.is_active = true
      GROUP BY a.id, a.code, a.name, a.sub_type, a.type, a.sort_order
      ORDER BY a.type DESC, a.sort_order ASC, a.code ASC
    `;

    // Separate into typed structures
    const accountRows = await prisma.account.findMany({
      where: { association_id: associationId, type: { in: [AccountType.INCOME, AccountType.EXPENSE] }, is_active: true },
      select: { id: true, type: true },
    });
    const typeMap = Object.fromEntries(accountRows.map(a => [a.id, a.type]));

    const income:  { id: string; code: string; name: string; sub_type: string | null; amount: number }[] = [];
    const expense: { id: string; code: string; name: string; sub_type: string | null; amount: number }[] = [];

    for (const r of rows) {
      const dr = Number(r.total_debit);
      const cr = Number(r.total_credit);
      const type = typeMap[r.id];
      if (type === AccountType.INCOME) {
        income.push({ id: r.id, code: r.code, name: r.name, sub_type: r.sub_type, amount: cr - dr });
      } else if (type === AccountType.EXPENSE) {
        expense.push({ id: r.id, code: r.code, name: r.name, sub_type: r.sub_type, amount: dr - cr });
      }
    }

    const totalIncome  = income.reduce((s, r)  => s + r.amount, 0);
    const totalExpense = expense.reduce((s, r) => s + r.amount, 0);
    const netSurplus   = totalIncome - totalExpense;

    return {
      data: {
        period:       { from: query.from, to: query.to },
        income,
        expense,
        totalIncome,
        totalExpense,
        netSurplus,
      },
    };
  }

  // ── LEDGER: all lines for one account with running balance ───────────────────
  async getLedger(
    associationId: string,
    accountId:     string,
    query: { from?: string; to?: string },
  ) {
    const account = await prisma.account.findFirst({
      where: { id: accountId, association_id: associationId },
    });
    if (!account) throw new NotFoundError('Account not found.');

    const isDebitNormal = DEBIT_NORMAL.has(account.type);

    // ── Base Opening Balance ──────────────────────────────────────────────────
    // 1. Account-level OB (set via Chart of Accounts)
    let accountOB = 0;
    if (account.opening_balance != null) {
      const amt   = Number(account.opening_balance);
      const isDR  = account.opening_balance_type === 'DEBIT';
      // For debit-normal accounts: DR adds to balance, CR subtracts
      accountOB = isDebitNormal ? (isDR ? amt : -amt) : (isDR ? -amt : amt);
    }

    // 2. Business Partner OBs for control accounts (set via BP bulk uploads)
    let bpOB = 0;
    if (account.is_control_account && account.bp_type_id) {
      const bps = await prisma.businessPartner.findMany({
        where: { association_id: associationId, bp_type_id: account.bp_type_id },
        select: { opening_balance: true, opening_balance_type: true },
      });
      for (const bp of bps) {
        if (bp.opening_balance != null) {
          const amt  = Number(bp.opening_balance);
          const isDR = bp.opening_balance_type === 'DEBIT';
          bpOB += isDebitNormal ? (isDR ? amt : -amt) : (isDR ? -amt : amt);
        }
      }
    }

    // baseOB = account OB + BP OBs — the permanent starting point before any journal entries
    const baseOB = accountOB + bpOB;

    // ── Journal-based opening balance (lines BEFORE 'from' date) ─────────────
    let journalOB = 0;
    if (query.from) {
      const before = await prisma.journalLine.findMany({
        where: {
          account_id:    accountId,
          journal_entry: {
            association_id: associationId,
            status:         JournalStatus.POSTED,
            entry_date:     { lt: new Date(query.from) },
          },
        },
        select: { debit: true, credit: true },
      });
      const dr = before.reduce((s, l) => s + Number(l.debit),  0);
      const cr = before.reduce((s, l) => s + Number(l.credit), 0);
      journalOB = isDebitNormal ? dr - cr : cr - dr;
    }

    // openingBalance shown in period view = baseOB + journal lines before 'from'
    const openingBalance = baseOB + journalOB;

    // ── Lines within the range ────────────────────────────────────────────────
    const lines = await prisma.journalLine.findMany({
      where: {
        account_id: accountId,
        journal_entry: {
          association_id: associationId,
          status:         JournalStatus.POSTED,
          ...(query.from || query.to ? {
            entry_date: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to   ? { lte: new Date(query.to)   } : {}),
            },
          } : {}),
        },
      },
      include: {
        journal_entry: {
          select: { id: true, entry_date: true, narration: true, reference_type: true, reference_code: true, voucher_type: true, source: true },
        },
        business_partner: { select: { id: true, name: true, code: true } },
      },
      orderBy: [
        { journal_entry: { entry_date: 'asc' } },
        { journal_entry: { created_at: 'asc' } },
      ],
    });

    // Running balance starts from openingBalance (includes baseOB)
    let balance = openingBalance;
    const rows = lines.map(l => {
      const dr = Number(l.debit);
      const cr = Number(l.credit);
      balance += isDebitNormal ? dr - cr : cr - dr;
      return {
        id:               l.id,
        entry_date:       l.journal_entry.entry_date,
        narration:        l.journal_entry.narration,
        reference_code:   l.journal_entry.reference_code,
        reference_type:   l.journal_entry.reference_type,
        voucher_type:     l.journal_entry.voucher_type,
        source:           l.journal_entry.source,
        business_partner: l.business_partner ?? null,
        debit:            dr,
        credit:           cr,
        balance,
      };
    });

    return {
      data: {
        account:        { id: account.id, code: account.code, name: account.name, type: account.type, sub_type: account.sub_type },
        isDebitNormal,
        baseOB,          // account OB + BP OBs — always show as "brought forward"
        openingBalance,  // baseOB + journal lines before 'from' (period view)
        closingBalance:  balance,
        rows,
      },
    };
  }

  // ── BACKFILL BP TAGS: tag control-account journal lines with business_partner_id ─
  async backfillBPTags(associationId: string) {
    let tagged = 0;

    // Helper: update untagged control-account lines for an entry with a given BP
    const tagEntry = async (entryId: string, bpId: string) => {
      // Find lines on control accounts that still have no BP tag
      const lines = await prisma.journalLine.findMany({
        where: {
          journal_entry_id: entryId,
          business_partner_id: null,
          account: { is_control_account: true },
        },
        select: { id: true },
      });
      if (lines.length === 0) return;
      await prisma.journalLine.updateMany({
        where: { id: { in: lines.map(l => l.id) } },
        data: { business_partner_id: bpId },
      });
      tagged += lines.length;
    };

    // 1. DUES_BILL entries
    const billEntries = await prisma.journalEntry.findMany({
      where: { association_id: associationId, reference_type: 'DUES_BILL', reference_id: { not: null } },
      select: { id: true, reference_id: true },
    });
    for (const entry of billEntries) {
      try {
        const bill = await prisma.bill.findUnique({ where: { id: entry.reference_id! }, select: { unit_id: true } });
        if (!bill?.unit_id) continue;
        const bp = await prisma.businessPartner.findFirst({
          where: { association_id: associationId, unit_id: bill.unit_id },
          select: { id: true },
        });
        if (!bp) continue;
        await tagEntry(entry.id, bp.id);
      } catch { /* non-fatal */ }
    }

    // 2. PAYMENT entries
    const paymentEntries = await prisma.journalEntry.findMany({
      where: { association_id: associationId, reference_type: 'PAYMENT', reference_id: { not: null } },
      select: { id: true, reference_id: true },
    });
    for (const entry of paymentEntries) {
      try {
        const payment = await prisma.payment.findUnique({ where: { id: entry.reference_id! }, select: { unit_id: true } });
        if (!payment?.unit_id) continue;
        const bp = await prisma.businessPartner.findFirst({
          where: { association_id: associationId, unit_id: payment.unit_id },
          select: { id: true },
        });
        if (!bp) continue;
        await tagEntry(entry.id, bp.id);
      } catch { /* non-fatal */ }
    }

    return { data: { tagged } };
  }

  // ── LEDGER ALL: every non-group account ─────────────────────────────────────
  async getLedgerAll(associationId: string, query: { from?: string; to?: string }) {
    const accounts = await prisma.account.findMany({
      where: { association_id: associationId, is_group: false, is_active: true },
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
    });
    const results = [];
    for (const account of accounts) {
      const ledger = await this.getLedger(associationId, account.id, query);
      results.push(ledger.data);
    }
    return { data: results };
  }

  // ── SUB-LEDGER: control account broken down by Business Partner ──────────────
  async getSubLedger(associationId: string, accountId: string, query: { from?: string; to?: string }) {
    const account = await prisma.account.findFirst({
      where: { id: accountId, association_id: associationId },
    });
    if (!account) throw new NotFoundError('Account not found.');
    if (!account.is_control_account) {
      throw new UnprocessableError('Account is not a control account.');
    }

    const isDebitNormal = DEBIT_NORMAL.has(account.type);

    // Source 1: BPs of the linked bp_type (for opening balance support)
    const bpMap = new Map<string, { id: string; name: string; code: string; opening_balance: any; opening_balance_type: string | null }>();
    if (account.bp_type_id) {
      const typeBPs = await prisma.businessPartner.findMany({
        where: { association_id: associationId, bp_type_id: account.bp_type_id, is_active: true },
        select: { id: true, name: true, code: true, opening_balance: true, opening_balance_type: true },
        orderBy: [{ code: 'asc' }],
      });
      typeBPs.forEach(bp => bpMap.set(bp.id, bp));
    }

    // Source 2: BPs that appear in journal lines for this account (for actual activity)
    const lineBPRecords = await prisma.journalLine.findMany({
      where: {
        account_id: accountId,
        business_partner_id: { not: null },
        journal_entry: { association_id: associationId, status: JournalStatus.POSTED },
      },
      select: { business_partner_id: true },
      distinct: ['business_partner_id'],
    });
    const unseenIds = lineBPRecords
      .map(l => l.business_partner_id!)
      .filter(id => !bpMap.has(id));
    if (unseenIds.length > 0) {
      const extraBPs = await prisma.businessPartner.findMany({
        where: { id: { in: unseenIds } },
        select: { id: true, name: true, code: true, opening_balance: true, opening_balance_type: true },
      });
      extraBPs.forEach(bp => bpMap.set(bp.id, bp));
    }

    const bps = Array.from(bpMap.values()).sort((a, b) => a.code.localeCompare(b.code));

    const bpLedgers = await Promise.all(bps.map(async (bp) => {
      // BP-level opening balance (from bulk upload)
      let baseOB = 0;
      if (bp.opening_balance != null) {
        const amt  = Number(bp.opening_balance);
        const isDR = bp.opening_balance_type === 'DEBIT';
        baseOB = isDebitNormal ? (isDR ? amt : -amt) : (isDR ? -amt : amt);
      }

      // Journal lines before 'from' date (for period opening balance)
      let journalOB = 0;
      if (query.from) {
        const before = await prisma.journalLine.findMany({
          where: {
            account_id: accountId,
            business_partner_id: bp.id,
            journal_entry: {
              association_id: associationId,
              status:         JournalStatus.POSTED,
              entry_date:     { lt: new Date(query.from) },
            },
          },
          select: { debit: true, credit: true },
        });
        const dr = before.reduce((s, l) => s + Number(l.debit),  0);
        const cr = before.reduce((s, l) => s + Number(l.credit), 0);
        journalOB = isDebitNormal ? dr - cr : cr - dr;
      }

      const openingBalance = baseOB + journalOB;

      // Lines within range for this BP
      const lines = await prisma.journalLine.findMany({
        where: {
          account_id: accountId,
          business_partner_id: bp.id,
          journal_entry: {
            association_id: associationId,
            status:         JournalStatus.POSTED,
            ...(query.from || query.to ? {
              entry_date: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to   ? { lte: new Date(query.to)   } : {}),
              },
            } : {}),
          },
        },
        include: {
          journal_entry: {
            select: { id: true, entry_date: true, narration: true, reference_type: true, reference_code: true, voucher_type: true, source: true },
          },
        },
        orderBy: [
          { journal_entry: { entry_date: 'asc' } },
          { journal_entry: { created_at: 'asc' } },
        ],
      });

      let balance = openingBalance;
      const rows = lines.map(l => {
        const dr = Number(l.debit);
        const cr = Number(l.credit);
        balance += isDebitNormal ? dr - cr : cr - dr;
        return {
          id:             l.id,
          entry_date:     l.journal_entry.entry_date,
          narration:      l.journal_entry.narration,
          reference_code: l.journal_entry.reference_code,
          reference_type: l.journal_entry.reference_type,
          voucher_type:   l.journal_entry.voucher_type,
          source:         l.journal_entry.source,
          debit:  dr,
          credit: cr,
          balance,
        };
      });

      return {
        bp: { id: bp.id, name: bp.name, code: bp.code },
        baseOB,
        openingBalance,
        closingBalance: balance,
        rows,
      };
    }));

    return {
      data: {
        account: { id: account.id, code: account.code, name: account.name, type: account.type, sub_type: account.sub_type },
        isDebitNormal,
        bps: bpLedgers,
      },
    };
  }

  // ── BALANCE SHEET: snapshot of ASSET / LIABILITY / EQUITY as of a date ──────
  async getBalanceSheet(
    associationId: string,
    query: { asOf: string; compare?: boolean; schedules?: boolean },
  ) {
    const asOfDate = new Date(query.asOf);

    // Fetch all balance-sheet relevant accounts plus INCOME/EXPENSE for net-surplus
    type Row = {
      id: string; code: string; name: string;
      sub_type: string | null; type: string;
      total_debit: number; total_credit: number;
    };

    // float8 preserves paise (bigint rounded them away); POSTED only, so that
    // cancelling an entry actually removes it from the balance sheet.
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT
        a.id, a.code, a.name, a.sub_type, a.type,
        COALESCE(SUM(jl.debit),  0)::float8 AS total_debit,
        COALESCE(SUM(jl.credit), 0)::float8 AS total_credit
      FROM accounts a
      LEFT JOIN journal_lines jl ON jl.account_id = a.id
      LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
        AND je.association_id = ${associationId}::uuid
        AND je.status = 'POSTED'::"JournalStatus"
        AND je.entry_date <= ${asOfDate}
      WHERE a.association_id = ${associationId}::uuid
        AND a.type IN ('ASSET','LIABILITY','EQUITY','INCOME','EXPENSE')
        AND a.is_active = true
      GROUP BY a.id, a.code, a.name, a.sub_type, a.type, a.sort_order
      ORDER BY a.type, a.sort_order ASC, a.code ASC
    `;

    type BsRow = { id: string; code: string; name: string; sub_type: string | null; amount: number };
    const assets:      BsRow[] = [];
    const liabilities: BsRow[] = [];
    const equity:      BsRow[] = [];
    let incomeTotal  = 0;
    let expenseTotal = 0;

    for (const r of rows) {
      const dr = Number(r.total_debit);
      const cr = Number(r.total_credit);
      switch (r.type) {
        case 'ASSET':     assets     .push({ id: r.id, code: r.code, name: r.name, sub_type: r.sub_type, amount: dr - cr }); break;
        case 'LIABILITY': liabilities.push({ id: r.id, code: r.code, name: r.name, sub_type: r.sub_type, amount: cr - dr }); break;
        case 'EQUITY':    equity     .push({ id: r.id, code: r.code, name: r.name, sub_type: r.sub_type, amount: cr - dr }); break;
        case 'INCOME':    incomeTotal  += (cr - dr); break;
        case 'EXPENSE':   expenseTotal += (dr - cr); break;
      }
    }

    const netSurplus               = incomeTotal - expenseTotal;
    const totalAssets              = assets     .reduce((s, r) => s + r.amount, 0);
    const totalLiabilities         = liabilities.reduce((s, r) => s + r.amount, 0);
    const totalEquity              = equity     .reduce((s, r) => s + r.amount, 0);
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity + netSurplus;

    // ── Prior-year comparative ────────────────────────────────────────────────
    // Same date one year earlier. Added as an extra field so the existing
    // response shape is unchanged for callers that do not ask for it.
    let previous: {
      asOf: string; totalAssets: number; totalLiabilities: number;
      totalEquity: number; netSurplus: number; totalLiabilitiesAndEquity: number;
      byAccount: Record<string, number>;
    } | null = null;

    if (query.compare) {
      const prevDate = new Date(asOfDate);
      prevDate.setFullYear(prevDate.getFullYear() - 1);
      const prevRows = await this.accountTotals(associationId, { to: prevDate });

      const byAccount: Record<string, number> = {};
      let pAssets = 0, pLiab = 0, pEquity = 0, pIncome = 0, pExpense = 0;
      for (const r of prevRows) {
        const dr = Number(r.total_debit);
        const cr = Number(r.total_credit);
        switch (r.type) {
          case 'ASSET':     byAccount[r.code] = dr - cr; pAssets  += dr - cr; break;
          case 'LIABILITY': byAccount[r.code] = cr - dr; pLiab    += cr - dr; break;
          case 'EQUITY':    byAccount[r.code] = cr - dr; pEquity  += cr - dr; break;
          case 'INCOME':    pIncome  += cr - dr; break;
          case 'EXPENSE':   pExpense += dr - cr; break;
        }
      }
      const pNet = pIncome - pExpense;
      previous = {
        asOf: prevDate.toISOString().slice(0, 10),
        totalAssets: pAssets, totalLiabilities: pLiab, totalEquity: pEquity,
        netSurplus: pNet, totalLiabilitiesAndEquity: pLiab + pEquity + pNet,
        byAccount,
      };
    }

    // ── Schedules for control accounts ────────────────────────────────────────
    // The auditor's supporting detail: who makes up the receivable balance.
    let schedules: {
      account: { code: string; name: string };
      total:   number;
      rows:    { code: string; name: string; amount: number }[];
    }[] = [];

    if (query.schedules) {
      const controls = await prisma.account.findMany({
        where: { association_id: associationId, is_control_account: true, is_active: true },
        select: { id: true, code: true, name: true, type: true },
        orderBy: { code: 'asc' },
      });

      schedules = await Promise.all(controls.map(async ctl => {
        const lines = await prisma.journalLine.groupBy({
          by: ['business_partner_id'],
          where: {
            account_id:    ctl.id,
            journal_entry: {
              association_id: associationId,
              status:         JournalStatus.POSTED,
              entry_date:     { lte: asOfDate },
            },
          },
          _sum: { debit: true, credit: true },
        });

        const bpIds = lines.map(l => l.business_partner_id).filter((x): x is string => !!x);
        const bps   = await prisma.businessPartner.findMany({
          where:  { id: { in: bpIds } },
          select: { id: true, code: true, name: true },
        });
        const bpById = new Map(bps.map(b => [b.id, b]));
        const isDebitNormal = DEBIT_NORMAL.has(ctl.type as AccountType);

        const rows = lines.map(l => {
          const dr  = Number(l._sum.debit  ?? 0);
          const cr  = Number(l._sum.credit ?? 0);
          const amt = isDebitNormal ? dr - cr : cr - dr;
          const bp  = l.business_partner_id ? bpById.get(l.business_partner_id) : undefined;
          return {
            code:   bp?.code ?? '—',
            // An untagged line has no owner; name it so it cannot be missed.
            name:   bp?.name ?? 'Untagged (no business partner)',
            amount: Math.round(amt * 100) / 100,
          };
        })
        .filter(r => r.amount !== 0)
        .sort((a, b) => a.code.localeCompare(b.code));

        return {
          account: { code: ctl.code, name: ctl.name },
          total:   Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100,
          rows,
        };
      }));
    }

    return {
      data: {
        asOf: query.asOf,
        assets,
        liabilities,
        equity,
        netSurplus,
        totalAssets,
        totalLiabilities,
        totalEquity,
        totalLiabilitiesAndEquity,
        previous,
        schedules,
      },
    };
  }

  // ── TRIAL BALANCE ────────────────────────────────────────────────────────────
  // Every posted line up to `asOf`, totalled per account, presented as the
  // conventional Dr / Cr pair. Built from journal lines only — the same source
  // as the P&L and Balance Sheet — so the three always agree.
  //
  // Opening balances typed onto an account or a business partner are NOT
  // included here: they are not journal entries and would make the trial
  // balance disagree with the balance sheet. Any that have not been journalised
  // are reported in `warnings` instead.
  async getTrialBalance(associationId: string, query: { asOf: string; from?: string }) {
    const asOfDate = new Date(query.asOf);
    const fromDate = query.from ? new Date(query.from) : null;

    type Row = {
      id: string; code: string; name: string; type: string; sub_type: string | null;
      total_debit: number; total_credit: number;
    };

    const rows = await prisma.$queryRaw<Row[]>`
      SELECT
        a.id, a.code, a.name, a.type, a.sub_type,
        COALESCE(SUM(jl.debit),  0)::float8 AS total_debit,
        COALESCE(SUM(jl.credit), 0)::float8 AS total_credit
      FROM accounts a
      LEFT JOIN journal_lines jl ON jl.account_id = a.id
      LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
        AND je.association_id = ${associationId}::uuid
        AND je.status = 'POSTED'::"JournalStatus"
        AND je.entry_date <= ${asOfDate}
        ${fromDate ? Prisma.sql`AND je.entry_date >= ${fromDate}` : Prisma.empty}
      WHERE a.association_id = ${associationId}::uuid
        AND a.is_active = true
        AND a.is_group  = false
      GROUP BY a.id, a.code, a.name, a.type, a.sub_type, a.sort_order
      ORDER BY a.type, a.sort_order ASC, a.code ASC
    `;

    const accounts = rows
      .map(r => {
        const dr  = Number(r.total_debit);
        const cr  = Number(r.total_credit);
        const net = dr - cr;
        return {
          id: r.id, code: r.code, name: r.name, type: r.type, sub_type: r.sub_type,
          totalDebit:  dr,
          totalCredit: cr,
          // Net balance sits in whichever column its sign calls for.
          debitBalance:  net > 0 ?  net : 0,
          creditBalance: net < 0 ? -net : 0,
        };
      })
      // An account with no movement has no place on a trial balance.
      .filter(a => a.totalDebit !== 0 || a.totalCredit !== 0);

    const round2 = (n: number) => Math.round(n * 100) / 100;

    const totalDebit    = round2(accounts.reduce((s, a) => s + a.totalDebit,    0));
    const totalCredit   = round2(accounts.reduce((s, a) => s + a.totalCredit,   0));
    const totalDebitBal = round2(accounts.reduce((s, a) => s + a.debitBalance,  0));
    const totalCreditBal= round2(accounts.reduce((s, a) => s + a.creditBalance, 0));

    // ── Opening balances that were never journalised ──────────────────────────
    const warnings: string[] = [];

    const obAccounts = await prisma.account.findMany({
      where: { association_id: associationId, opening_balance: { not: null }, is_active: true },
      select: { code: true, name: true, opening_balance: true },
    });
    const obEntryCount = await prisma.journalEntry.count({
      where: { association_id: associationId, reference_type: 'OPENING_BALANCE', status: JournalStatus.POSTED },
    });
    if (obAccounts.length > 0 && obEntryCount === 0) {
      warnings.push(
        `${obAccounts.length} account(s) carry an opening balance that has not been posted as a journal entry, ` +
        `so it is excluded from this trial balance.`,
      );
    }

    const obBPCount = await prisma.businessPartner.count({
      where: { association_id: associationId, opening_balance: { not: null }, is_active: true },
    });
    if (obBPCount > 0 && obEntryCount === 0) {
      warnings.push(
        `${obBPCount} business partner(s) carry an opening balance that has not been posted as a journal entry.`,
      );
    }

    return {
      data: {
        asOf: query.asOf,
        from: query.from ?? null,
        accounts,
        totalDebit,
        totalCredit,
        totalDebitBalance:  totalDebitBal,
        totalCreditBalance: totalCreditBal,
        // Sub-paise tolerance; anything larger is a genuine defect.
        isBalanced: Math.abs(totalDebit - totalCredit) < 0.005
                 && Math.abs(totalDebitBal - totalCreditBal) < 0.005,
        difference: round2(totalDebit - totalCredit),
        warnings,
      },
    };
  }

  // ── DAY BOOK ─────────────────────────────────────────────────────────────────
  // Every posted entry in a date range, in voucher order, with its lines.
  // The treasurer's daily view of what was recorded.
  async getDayBook(associationId: string, query: { from: string; to: string }) {
    const entries = await prisma.journalEntry.findMany({
      where: {
        association_id: associationId,
        status:         JournalStatus.POSTED,
        entry_date:     { gte: new Date(query.from), lte: new Date(query.to) },
      },
      select: {
        ...ENTRY_FIELDS,
        lines: {
          include: {
            account:          { select: { id: true, code: true, name: true } },
            business_partner: { select: { id: true, code: true, name: true } },
          },
        },
      },
      orderBy: [{ entry_date: 'asc' }, { reference_code: 'asc' }],
    });

    const days = new Map<string, {
      date: string;
      entries: {
        id: string; reference_code: string; voucher_type: string;
        narration: string; source: string; reference_type: string | null;
        totalDebit: number;
        lines: {
          account_code: string; account_name: string;
          bp_code: string | null; bp_name: string | null;
          narration: string | null; debit: number; credit: number;
        }[];
      }[];
      totalDebit: number;
    }>();

    for (const e of entries) {
      const date  = e.entry_date.toISOString().slice(0, 10);
      const lines = e.lines.map(l => ({
        account_code: l.account.code,
        account_name: l.account.name,
        bp_code:      l.business_partner?.code ?? null,
        bp_name:      l.business_partner?.name ?? null,
        narration:    l.narration,
        debit:        Number(l.debit),
        credit:       Number(l.credit),
      }));
      const totalDebit = lines.reduce((s, l) => s + l.debit, 0);

      if (!days.has(date)) days.set(date, { date, entries: [], totalDebit: 0 });
      const day = days.get(date)!;
      day.entries.push({
        id:             e.id,
        reference_code: e.reference_code,
        voucher_type:   e.voucher_type,
        narration:      e.narration,
        source:         e.source,
        reference_type: e.reference_type,
        totalDebit,
        lines,
      });
      day.totalDebit += totalDebit;
    }

    const dayList = Array.from(days.values());

    return {
      data: {
        period:      { from: query.from, to: query.to },
        days:        dayList,
        entryCount:  entries.length,
        grandTotal:  Math.round(dayList.reduce((s, d) => s + d.totalDebit, 0) * 100) / 100,
      },
    };
  }

  // ── CASH BOOK / BANK BOOK ────────────────────────────────────────────────────
  // A single-account book with receipts and payments in separate columns and a
  // running balance — how a treasurer reads cash, rather than the Dr/Cr ledger.
  // `kind` picks the default account: CASH -> 1001, BANK -> 1002. An explicit
  // accountId overrides it, which is how a second bank account is viewed.
  async getCashBook(
    associationId: string,
    query: { kind: 'CASH' | 'BANK'; account_id?: string; from: string; to: string },
  ) {
    const account = query.account_id
      ? await prisma.account.findFirst({ where: { id: query.account_id, association_id: associationId } })
      : await prisma.account.findUnique({
          where: { association_id_code: { association_id: associationId, code: query.kind === 'CASH' ? '1001' : '1002' } },
        });

    if (!account) {
      throw new NotFoundError(
        query.account_id
          ? 'Account not found.'
          : `Default ${query.kind === 'CASH' ? 'Cash in Hand (1001)' : 'Bank Account (1002)'} not found. Seed the chart of accounts first.`,
      );
    }

    const fromDate = new Date(query.from);
    const toDate   = new Date(query.to);

    // Opening balance = everything posted before `from`.
    const before = await prisma.journalLine.aggregate({
      where: {
        account_id:    account.id,
        journal_entry: {
          association_id: associationId,
          status:         JournalStatus.POSTED,
          entry_date:     { lt: fromDate },
        },
      },
      _sum: { debit: true, credit: true },
    });
    const openingBalance =
      Number(before._sum.debit ?? 0) - Number(before._sum.credit ?? 0);

    const lines = await prisma.journalLine.findMany({
      where: {
        account_id:    account.id,
        journal_entry: {
          association_id: associationId,
          status:         JournalStatus.POSTED,
          entry_date:     { gte: fromDate, lte: toDate },
        },
      },
      include: {
        journal_entry: {
          select: {
            id: true, entry_date: true, narration: true, reference_code: true,
            voucher_type: true, reference_type: true, source: true,
          },
        },
        business_partner: { select: { id: true, code: true, name: true } },
      },
      orderBy: [
        { journal_entry: { entry_date: 'asc' } },
        { journal_entry: { created_at: 'asc' } },
      ],
    });

    // The other side of each entry — "what was this receipt for".
    const entryIds = [...new Set(lines.map(l => l.journal_entry.id))];
    const contras  = await prisma.journalLine.findMany({
      where: { journal_entry_id: { in: entryIds }, account_id: { not: account.id } },
      include: { account: { select: { code: true, name: true } } },
    });
    const contraByEntry = new Map<string, string[]>();
    for (const c of contras) {
      const list = contraByEntry.get(c.journal_entry_id) ?? [];
      list.push(`${c.account.code} ${c.account.name}`);
      contraByEntry.set(c.journal_entry_id, list);
    }

    let balance = openingBalance;
    const rows = lines.map(l => {
      const receipt = Number(l.debit);   // money in  — debit to cash
      const payment = Number(l.credit);  // money out — credit to cash
      balance += receipt - payment;
      return {
        id:             l.id,
        entry_id:       l.journal_entry.id,
        date:           l.journal_entry.entry_date.toISOString().slice(0, 10),
        reference_code: l.journal_entry.reference_code,
        voucher_type:   l.journal_entry.voucher_type,
        narration:      l.narration ?? l.journal_entry.narration,
        particulars:    contraByEntry.get(l.journal_entry.id)?.join(', ') ?? '',
        bp_name:        l.business_partner?.name ?? null,
        receipt,
        payment,
        balance:        Math.round(balance * 100) / 100,
      };
    });

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const totalReceipts = round2(rows.reduce((s, r) => s + r.receipt, 0));
    const totalPayments = round2(rows.reduce((s, r) => s + r.payment, 0));

    return {
      data: {
        account: { id: account.id, code: account.code, name: account.name },
        kind:    query.kind,
        period:  { from: query.from, to: query.to },
        openingBalance: round2(openingBalance),
        rows,
        totalReceipts,
        totalPayments,
        closingBalance: round2(openingBalance + totalReceipts - totalPayments),
      },
    };
  }

  // ── RECEIPTS & PAYMENTS ACCOUNT ──────────────────────────────────────────────
  // The cash-basis statement an association presents to its members: opening
  // cash and bank, everything actually received, everything actually paid, and
  // the closing balance. It is NOT the Income & Expenditure account — dues
  // billed but unpaid never appear here, and a fixed deposit does.
  //
  // Derivation: take every posted entry that moves a cash account, then group
  // by the OTHER side of that entry. An entry whose net cash movement is zero
  // is a contra (cash to bank and the like) and is excluded — it shuffles money
  // between two cash accounts without the association receiving or paying
  // anything, and including it would inflate both columns.
  async getReceiptsAndPayments(
    associationId: string,
    query: { from: string; to: string; cash_codes?: string },
  ) {
    const fromDate = new Date(query.from);
    const toDate   = new Date(query.to);

    // Which accounts count as "cash". 1001 Cash in Hand and 1002 Bank Account
    // by default; override to include a second bank or a petty cash account.
    const cashCodes = query.cash_codes
      ? query.cash_codes.split(',').map(c => c.trim()).filter(Boolean)
      : ['1001', '1002'];

    const cashAccounts = await prisma.account.findMany({
      where: { association_id: associationId, code: { in: cashCodes } },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    });
    if (cashAccounts.length === 0) {
      throw new NotFoundError(
        `No cash accounts found for codes ${cashCodes.join(', ')}. Seed the chart of accounts first.`,
      );
    }
    const cashIds = new Set(cashAccounts.map(a => a.id));

    const round2 = (n: number) => Math.round(n * 100) / 100;

    // ── Opening balances, per cash account ────────────────────────────────────
    const openingBalances = await Promise.all(cashAccounts.map(async acc => {
      const agg = await prisma.journalLine.aggregate({
        where: {
          account_id:    acc.id,
          journal_entry: {
            association_id: associationId,
            status:         JournalStatus.POSTED,
            entry_date:     { lt: fromDate },
          },
        },
        _sum: { debit: true, credit: true },
      });
      return {
        code:   acc.code,
        name:   acc.name,
        amount: round2(Number(agg._sum.debit ?? 0) - Number(agg._sum.credit ?? 0)),
      };
    }));

    // ── Every posted entry in the period that touches a cash account ──────────
    const entries = await prisma.journalEntry.findMany({
      where: {
        association_id: associationId,
        status:         JournalStatus.POSTED,
        entry_date:     { gte: fromDate, lte: toDate },
        lines:          { some: { account_id: { in: [...cashIds] } } },
      },
      include: {
        lines: { include: { account: { select: { id: true, code: true, name: true, type: true } } } },
      },
      orderBy: { entry_date: 'asc' },
    });

    type Bucket = { code: string; name: string; type: string; amount: number };
    const receipts = new Map<string, Bucket>();
    const payments = new Map<string, Bucket>();

    let cashReceived = 0;
    let cashPaid     = 0;
    let contraCount  = 0;

    for (const e of entries) {
      const cashLines  = e.lines.filter(l =>  cashIds.has(l.account_id));
      const otherLines = e.lines.filter(l => !cashIds.has(l.account_id));

      const cashNet = cashLines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);

      // Contra: money moved between two cash accounts. Not a receipt or payment.
      if (Math.abs(cashNet) < 0.005) { contraCount++; continue; }

      const isReceipt = cashNet > 0;
      const target    = isReceipt ? receipts : payments;

      // The contra side carries the nature of the transaction. For a receipt
      // the other accounts are credited; for a payment they are debited.
      for (const l of otherLines) {
        const amount = isReceipt ? Number(l.credit) - Number(l.debit)
                                 : Number(l.debit)  - Number(l.credit);
        if (Math.abs(amount) < 0.005) continue;

        const key = l.account.code;
        const b   = target.get(key) ?? { code: l.account.code, name: l.account.name, type: l.account.type, amount: 0 };
        b.amount += amount;
        target.set(key, b);
      }

      if (isReceipt) cashReceived += cashNet;
      else           cashPaid     += -cashNet;
    }

    const sortRows = (m: Map<string, Bucket>) =>
      Array.from(m.values())
        .map(b => ({ ...b, amount: round2(b.amount) }))
        .filter(b => b.amount !== 0)
        .sort((a, b) => a.code.localeCompare(b.code));

    const receiptRows = sortRows(receipts);
    const paymentRows = sortRows(payments);

    const openingTotal  = round2(openingBalances.reduce((s, b) => s + b.amount, 0));
    const totalReceipts = round2(cashReceived);
    const totalPayments = round2(cashPaid);

    // Closing per account, computed independently so it can be cross-checked
    // against opening + receipts - payments rather than derived from it.
    const closingBalances = await Promise.all(cashAccounts.map(async acc => {
      const agg = await prisma.journalLine.aggregate({
        where: {
          account_id:    acc.id,
          journal_entry: {
            association_id: associationId,
            status:         JournalStatus.POSTED,
            entry_date:     { lte: toDate },
          },
        },
        _sum: { debit: true, credit: true },
      });
      return {
        code:   acc.code,
        name:   acc.name,
        amount: round2(Number(agg._sum.debit ?? 0) - Number(agg._sum.credit ?? 0)),
      };
    }));

    const closingTotal = round2(closingBalances.reduce((s, b) => s + b.amount, 0));
    const expected     = round2(openingTotal + totalReceipts - totalPayments);

    return {
      data: {
        period: { from: query.from, to: query.to },
        cashAccounts: cashAccounts.map(a => ({ code: a.code, name: a.name })),
        openingBalances,
        openingTotal,
        receipts: receiptRows,
        totalReceipts,
        payments: paymentRows,
        totalPayments,
        closingBalances,
        closingTotal,
        // Grand totals of the two sides of the statement.
        totalLeft:  round2(openingTotal + totalReceipts),
        totalRight: round2(totalPayments + closingTotal),
        // Closing must equal opening + receipts - payments. A mismatch means an
        // entry moved cash in a way this grouping did not account for.
        isReconciled: Math.abs(closingTotal - expected) < 0.005,
        difference:   round2(closingTotal - expected),
        contraEntriesExcluded: contraCount,
      },
    };
  }

  // ── SYNC OPENING BALANCE: DR 1001 Cash in Hand / CR 5003 Opening Balance Equity ──
  async syncOpeningBalance(associationId: string, amount: number | null, asOnDate: Date | null) {
    // Remove any existing opening balance entry (upsert pattern)
    const existing = await prisma.journalEntry.findFirst({
      where: { association_id: associationId, reference_type: 'OPENING_BALANCE' },
      select: { id: true },
    });
    if (existing) {
      await prisma.journalLine.deleteMany({ where: { journal_entry_id: existing.id } });
      await prisma.journalEntry.delete({ where: { id: existing.id } });
    }

    if (!amount || amount <= 0) return;

    const cashAcct = await prisma.account.findUnique({
      where: { association_id_code: { association_id: associationId, code: '1001' } },
    });
    // Prefer 5003 (Opening Balance Equity); fall back to 5001 (Reserve Fund) if not seeded yet
    const obAcct =
      (await prisma.account.findUnique({ where: { association_id_code: { association_id: associationId, code: '5003' } } })) ??
      (await prisma.account.findUnique({ where: { association_id_code: { association_id: associationId, code: '5001' } } }));
    if (!cashAcct || !obAcct) {
      logger.warn('syncOpeningBalance: required accounts not found — run Chart of Accounts seed first.');
      return;
    }

    await this.post(associationId, {
      entry_date:     asOnDate ?? new Date(),
      narration:      'Opening Balance — Cash in Hand',
      reference_type: 'OPENING_BALANCE',
      reference_id:   associationId,
      voucher_type:   VoucherType.JV,
      source:         JournalEntrySource.AUTO,
      lines: [
        { account_id: cashAcct.id, debit: amount, credit: 0 },
        { account_id: obAcct.id,   debit: 0,      credit: amount },
      ],
    });
  }

  // ── UPDATE entry: replace narration, date and lines ────────────────────────
  async updateEntry(id: string, associationId: string, body: CreateJournalEntryBody) {
    // Include lines: they are deleted below, so this is the only chance to
    // capture the "before" state for the audit trail.
    const entry = await prisma.journalEntry.findFirst({
      where: { id, association_id: associationId },
      include: { lines: true },
    });
    if (!entry) throw new NotFoundError('Journal entry not found.');

    const totalDebit  = body.lines.reduce((s, l) => s + (l.debit  ?? 0), 0);
    const totalCredit = body.lines.reduce((s, l) => s + (l.credit ?? 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.005) {
      throw new UnprocessableError(
        `Entry is unbalanced: debit ₹${totalDebit.toFixed(2)} ≠ credit ₹${totalCredit.toFixed(2)}`
      );
    }

    await this.validateControlAccounts(body.lines);

    const voucherType = body.voucher_type
      ? (body.voucher_type as VoucherType)
      : await this.inferManualVoucherType(associationId, body.lines);

    await this.validateVoucherType(associationId, voucherType, body.lines);

    await prisma.journalLine.deleteMany({ where: { journal_entry_id: id } });

    const updated = await prisma.journalEntry.update({
      where: { id },
      data: {
        entry_date:   new Date(body.entry_date),
        narration:    body.narration,
        voucher_type: voucherType,
        lines: {
          create: body.lines.map(l => ({
            account_id:          l.account_id,
            business_partner_id: l.business_partner_id ?? null,
            debit:               l.debit  ?? 0,
            credit:              l.credit ?? 0,
            narration:           l.narration,
          })),
        },
      },
      include: {
        lines: {
          include: {
            account:          { select: { code: true, name: true, type: true } },
            business_partner: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    await auditService.record({
      entity_type: 'journal_entry',
      entity_id:   id,
      action:      AuditAction.UPDATE,
      summary:     `Edited ${entry.reference_code} — ₹${totalDebit.toFixed(2)}`,
      old_value:   {
        entry_date:   entry.entry_date,
        narration:    entry.narration,
        voucher_type: entry.voucher_type,
        lines: entry.lines.map(l => ({
          account_id:          l.account_id,
          business_partner_id: l.business_partner_id,
          debit:               Number(l.debit),
          credit:              Number(l.credit),
          narration:           l.narration,
        })),
      },
      new_value:   { ...body, voucher_type: voucherType },
    });

    return { data: updated };
  }

  // ── BACKFILL: post all unposted historical transactions ───────────────────
  async backfillTransactions(associationId: string) {
    const accountCount = await prisma.account.count({ where: { association_id: associationId } });
    if (accountCount === 0) {
      throw new UnprocessableError('Please seed the Chart of Accounts before syncing transactions.');
    }

    // Load all accounts once
    const accounts = await prisma.account.findMany({
      where: { association_id: associationId, is_active: true },
    });
    const byCode = (code: string) => accounts.find(a => a.code === code);
    const cashAcct = byCode('1001');
    const bankAcct = byCode('1002');
    const drOrCr   = (mode: string) => (mode === 'CASH' ? cashAcct : bankAcct) ?? bankAcct ?? cashAcct;

    // ── Opening Balance: sync from DuesConfig cash_balance ───────────────────
    const duesConfig = await prisma.duesConfig.findUnique({
      where: { association_id: associationId },
      select: { cash_balance: true, cash_balance_as_on: true },
    });
    if (duesConfig?.cash_balance && Number(duesConfig.cash_balance) > 0) {
      await this.syncOpeningBalance(
        associationId,
        Number(duesConfig.cash_balance),
        duesConfig.cash_balance_as_on ?? null,
      );
    }

    // Already-posted reference IDs (idempotency guard)
    const postedRefs = await prisma.journalEntry.findMany({
      where: { association_id: associationId, reference_id: { not: null } },
      select: { reference_type: true, reference_id: true },
    });
    const posted = new Set(postedRefs.map(e => `${e.reference_type}:${e.reference_id}`));

    const results = {
      bills:    { posted: 0, skipped: 0, failed: 0 },
      payments: { posted: 0, skipped: 0, failed: 0 },
      expenses: { posted: 0, skipped: 0, failed: 0 },
      receipts: { posted: 0, skipped: 0, failed: 0 },
    };

    // ── Bills: DR 1004 / CR 3001 ──────────────────────────────────────────
    const drBill = byCode('1004');
    const crBill = byCode('3001');
    if (drBill && crBill) {
      const bills = await prisma.bill.findMany({
        where: { association_id: associationId },
        include: { unit: { select: { flat_number: true } } },
        orderBy: { created_at: 'asc' },
      });
      for (const bill of bills) {
        if (posted.has(`DUES_BILL:${bill.id}`)) { results.bills.skipped++; continue; }
        try {
          await this.post(associationId, {
            entry_date:     new Date(bill.created_at),
            narration:      bill.bill_label ?? `Bill ${bill.period_month}/${bill.period_year} — Flat ${bill.unit?.flat_number ?? ''}`,
            reference_type: 'DUES_BILL',
            reference_id:   bill.id,
            voucher_type:   VoucherType.JV,
            source:         JournalEntrySource.AUTO,
            lines: [
              { account_id: drBill.id, debit: Number(bill.base_amount), credit: 0 },
              { account_id: crBill.id, debit: 0, credit: Number(bill.base_amount) },
            ],
          });
          results.bills.posted++;
        } catch (err) {
          logger.error('Backfill: bill failed', { billId: bill.id, err });
          results.bills.failed++;
        }
      }
    }

    // ── Payments: DR 1001/1002 / CR 1004 ─────────────────────────────────
    const crPayment = byCode('1004');
    if (crPayment) {
      const payments = await prisma.payment.findMany({
        where: { association_id: associationId },
        include: { unit: { select: { flat_number: true } } },
        orderBy: { payment_date: 'asc' },
      });
      for (const pmt of payments) {
        if (posted.has(`PAYMENT:${pmt.id}`)) { results.payments.skipped++; continue; }
        const drAcct = drOrCr(pmt.payment_mode.toString());
        if (!drAcct) { results.payments.failed++; continue; }
        try {
          await this.post(associationId, {
            entry_date:     new Date(pmt.payment_date),
            narration:      `Payment received — Flat ${pmt.unit?.flat_number ?? ''}`,
            reference_type: 'PAYMENT',
            reference_id:   pmt.id,
            voucher_type:   VoucherType.RV,
            source:         JournalEntrySource.AUTO,
            lines: [
              { account_id: drAcct.id,     debit: Number(pmt.amount), credit: 0 },
              { account_id: crPayment.id,  debit: 0, credit: Number(pmt.amount) },
            ],
          });
          results.payments.posted++;
        } catch (err) {
          logger.error('Backfill: payment failed', { paymentId: pmt.id, err });
          results.payments.failed++;
        }
      }
    }

    // ── Expenses: DR expense account / CR 1001/1002 ───────────────────────
    const expenseAccts = accounts.filter(a => a.type === AccountType.EXPENSE);
    const fallbackExp  = byCode('4008') ?? expenseAccts[0];
    const expenses = await prisma.expense.findMany({
      where: { association_id: associationId, status: { not: ExpenseStatus.REJECTED }, deleted_at: null },
      orderBy: { expense_date: 'asc' },
    });
    for (const exp of expenses) {
      if (posted.has(`EXPENSE:${exp.id}`)) { results.expenses.skipped++; continue; }
      const expAcct = expenseAccts.find(a =>
        a.name.toLowerCase().includes(exp.category.toLowerCase())
      ) ?? fallbackExp;
      const crAcct = drOrCr(exp.payment_mode.toString());
      if (!expAcct || !crAcct) { results.expenses.failed++; continue; }
      try {
        await this.post(associationId, {
          entry_date:     new Date(exp.expense_date),
          narration:      exp.description ?? exp.category,
          reference_type: 'EXPENSE',
          reference_id:   exp.id,
          voucher_type:   VoucherType.PV,
          source:         JournalEntrySource.AUTO,
          lines: [
            { account_id: expAcct.id, debit: Number(exp.amount), credit: 0 },
            { account_id: crAcct.id,  debit: 0, credit: Number(exp.amount) },
          ],
        });
        results.expenses.posted++;
      } catch (err) {
        logger.error('Backfill: expense failed', { expenseId: exp.id, err });
        results.expenses.failed++;
      }
    }

    // ── Other Receipts: DR 1001/1002 / CR 3002 ───────────────────────────
    const crReceipt = byCode('3002');
    if (crReceipt) {
      const receipts = await prisma.otherReceipt.findMany({
        where: { association_id: associationId, deleted_at: null },
        orderBy: { receipt_date: 'asc' },
      });
      for (const rcpt of receipts) {
        if (posted.has(`OTHER_RECEIPT:${rcpt.id}`)) { results.receipts.skipped++; continue; }
        const drAcct = drOrCr(rcpt.payment_mode.toString());
        if (!drAcct) { results.receipts.failed++; continue; }
        try {
          await this.post(associationId, {
            entry_date:     new Date(rcpt.receipt_date),
            narration:      rcpt.description ?? rcpt.category,
            reference_type: 'OTHER_RECEIPT',
            reference_id:   rcpt.id,
            voucher_type:   VoucherType.RV,
            source:         JournalEntrySource.AUTO,
            lines: [
              { account_id: drAcct.id,    debit: Number(rcpt.amount), credit: 0 },
              { account_id: crReceipt.id, debit: 0, credit: Number(rcpt.amount) },
            ],
          });
          results.receipts.posted++;
        } catch (err) {
          logger.error('Backfill: receipt failed', { receiptId: rcpt.id, err });
          results.receipts.failed++;
        }
      }
    }

    return { data: results };
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

    await this.validateControlAccounts(body.lines);

    // Guard: cannot post to a closed financial year
    const entryFY = await getFY(associationId, new Date(body.entry_date));
    if (await fyClosureService.isYearClosed(associationId, entryFY)) {
      throw new UnprocessableError(`Financial year ${entryFY} is closed. Reopen it before posting new entries.`);
    }

    // Explicit type from the form; fall back to inference for older callers.
    const voucherType = body.voucher_type
      ? (body.voucher_type as VoucherType)
      : await this.inferManualVoucherType(associationId, body.lines);

    await this.validateVoucherType(associationId, voucherType, body.lines);

    const entry = await this.post(associationId, {
      entry_date:    new Date(body.entry_date),
      narration:     body.narration,
      voucher_type:  voucherType,
      source:        JournalEntrySource.MANUAL,
      status:        JournalStatus.POSTED,
      created_by_id: createdBy,
      lines:      body.lines.map(l => ({
        account_id:          l.account_id,
        business_partner_id: l.business_partner_id ?? null,
        debit:               l.debit  ?? 0,
        credit:              l.credit ?? 0,
        narration:           l.narration,
      })),
    });

    await auditService.record({
      entity_type: 'journal_entry',
      entity_id:   entry.id,
      action:      AuditAction.CREATE,
      summary:     `Manual ${voucherType} ${entry.reference_code} — ₹${totalDebit.toFixed(2)}`,
      new_value:   { ...body, voucher_type: voucherType, financial_year: entryFY },
    });

    return { data: entry };
  }
}

export const journalService = new JournalService();
