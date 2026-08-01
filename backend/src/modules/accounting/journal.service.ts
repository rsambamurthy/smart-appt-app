import { AccountType, AuditAction, JournalEntrySource, JournalStatus, VoucherType, ExpenseStatus } from '@prisma/client';
import prisma from '../../config/database';
import { NotFoundError, UnprocessableError } from '../../utils/errors';
import { CreateJournalEntryBody } from './journal.schema';
import logger from '../../utils/logger';
import { auditService } from '../../services/audit.service';
import { fyClosureService, getFinancialYear } from './fy-closure.service';

// Account types whose normal balance is DEBIT (DR increases balance)
const DEBIT_NORMAL = new Set<string>(['ASSET', 'EXPENSE']);

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

  // ── Infer voucher type for manual entries from account names ──────────────
  // Bank account in any line → BV; Cash account → CV; otherwise → JV.
  // "Bank" takes priority if both appear on the same entry.
  private async inferManualVoucherType(
    lines: { account_id: string }[],
  ): Promise<VoucherType> {
    const accountIds = [...new Set(lines.map(l => l.account_id))];
    const accts = await prisma.account.findMany({
      where:  { id: { in: accountIds } },
      select: { name: true },
    });
    let hasBank = false, hasCash = false;
    for (const a of accts) {
      const n = a.name.toLowerCase();
      if (n.includes('bank')) hasBank = true;
      if (n.includes('cash')) hasCash = true;
    }
    if (hasBank) return VoucherType.BV;
    if (hasCash) return VoucherType.CV;
    return VoucherType.JV;
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
      include: {
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
  async getBalanceSheet(associationId: string, query: { asOf: string }) {
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

    const voucherType = await this.inferManualVoucherType(body.lines);

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

    const voucherType = await this.inferManualVoucherType(body.lines);

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
