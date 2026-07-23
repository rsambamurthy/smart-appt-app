import { AccountType, JournalEntryType, ExpenseStatus } from '@prisma/client';
import prisma from '../../config/database';
import { NotFoundError, UnprocessableError } from '../../utils/errors';
import { CreateJournalEntryBody } from './journal.schema';
import logger from '../../utils/logger';

// Account types whose normal balance is DEBIT (DR increases balance)
const DEBIT_NORMAL = new Set<string>(['ASSET', 'EXPENSE']);

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

  // ── P&L: Income & Expenditure statement for a period ─────────────────────────
  async getPnL(associationId: string, query: { from: string; to: string }) {
    // Sum journal lines grouped by account for INCOME + EXPENSE accounts in period
    type Row = { id: string; code: string; name: string; sub_type: string | null; total_debit: bigint; total_credit: bigint };
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT
        a.id, a.code, a.name, a.sub_type,
        COALESCE(SUM(jl.debit),  0)::bigint AS total_debit,
        COALESCE(SUM(jl.credit), 0)::bigint AS total_credit
      FROM accounts a
      LEFT JOIN journal_lines jl ON jl.account_id = a.id
      LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
        AND je.association_id = ${associationId}::uuid
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

    // Opening balance = all lines BEFORE 'from' date
    let openingBalance = 0;
    if (query.from) {
      const before = await prisma.journalLine.findMany({
        where: {
          account_id:    accountId,
          journal_entry: {
            association_id: associationId,
            entry_date:     { lt: new Date(query.from) },
          },
        },
        select: { debit: true, credit: true },
      });
      const dr = before.reduce((s, l) => s + Number(l.debit),  0);
      const cr = before.reduce((s, l) => s + Number(l.credit), 0);
      openingBalance = isDebitNormal ? dr - cr : cr - dr;
    }

    // Lines within the range
    const lines = await prisma.journalLine.findMany({
      where: {
        account_id: accountId,
        journal_entry: {
          association_id: associationId,
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
          select: { id: true, entry_date: true, narration: true, reference_type: true, type: true },
        },
      },
      orderBy: [
        { journal_entry: { entry_date: 'asc' } },
        { journal_entry: { created_at: 'asc' } },
      ],
    });

    // Compute running balance
    let balance = openingBalance;
    const rows = lines.map(l => {
      const dr = Number(l.debit);
      const cr = Number(l.credit);
      balance += isDebitNormal ? dr - cr : cr - dr;
      return {
        id:             l.id,
        entry_date:     l.journal_entry.entry_date,
        narration:      l.journal_entry.narration,
        reference_type: l.journal_entry.reference_type,
        entry_type:     l.journal_entry.type,
        debit:          dr,
        credit:         cr,
        balance,
      };
    });

    return {
      data: {
        account:        { id: account.id, code: account.code, name: account.name, type: account.type, sub_type: account.sub_type },
        isDebitNormal,
        openingBalance,
        closingBalance: balance,
        rows,
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
      total_debit: bigint; total_credit: bigint;
    };

    const rows = await prisma.$queryRaw<Row[]>`
      SELECT
        a.id, a.code, a.name, a.sub_type, a.type,
        COALESCE(SUM(jl.debit),  0)::bigint AS total_debit,
        COALESCE(SUM(jl.credit), 0)::bigint AS total_credit
      FROM accounts a
      LEFT JOIN journal_lines jl ON jl.account_id = a.id
      LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
        AND je.association_id = ${associationId}::uuid
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
      type:           JournalEntryType.AUTO,
      lines: [
        { account_id: cashAcct.id, debit: amount, credit: 0 },
        { account_id: obAcct.id,   debit: 0,      credit: amount },
      ],
    });
  }

  // ── UPDATE entry: replace narration, date and lines ────────────────────────
  async updateEntry(id: string, associationId: string, body: CreateJournalEntryBody) {
    const entry = await prisma.journalEntry.findFirst({
      where: { id, association_id: associationId },
    });
    if (!entry) throw new NotFoundError('Journal entry not found.');

    const totalDebit  = body.lines.reduce((s, l) => s + (l.debit  ?? 0), 0);
    const totalCredit = body.lines.reduce((s, l) => s + (l.credit ?? 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.005) {
      throw new UnprocessableError(
        `Entry is unbalanced: debit ₹${totalDebit.toFixed(2)} ≠ credit ₹${totalCredit.toFixed(2)}`
      );
    }

    await prisma.journalLine.deleteMany({ where: { journal_entry_id: id } });

    const updated = await prisma.journalEntry.update({
      where: { id },
      data: {
        entry_date: new Date(body.entry_date),
        narration:  body.narration,
        lines: {
          create: body.lines.map(l => ({
            account_id: l.account_id,
            debit:      l.debit  ?? 0,
            credit:     l.credit ?? 0,
            narration:  l.narration,
          })),
        },
      },
      include: {
        lines: { include: { account: { select: { code: true, name: true, type: true } } } },
      },
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
            type:           JournalEntryType.AUTO,
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
            type:           JournalEntryType.AUTO,
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
          type:           JournalEntryType.AUTO,
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
            type:           JournalEntryType.AUTO,
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
