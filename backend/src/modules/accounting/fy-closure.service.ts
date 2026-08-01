import { AuditAction, VoucherType, JournalEntrySource, JournalStatus } from '@prisma/client';
import prisma from '../../config/database';
import { NotFoundError, UnprocessableError } from '../../utils/errors';
import { auditService } from '../../services/audit.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getFinancialYear(date: Date, fyStartMonth: number): string {
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  const startYear = m >= fyStartMonth ? y : y - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

function getLastDayOfFY(fy: string, fyStartMonth: number): Date {
  // FY "2024-25", start=4 → ends 31 March 2025 (month before start month)
  const startYear = parseInt(fy.split('-')[0]);
  const endYear   = startYear + 1;
  const endMonth  = fyStartMonth - 1 === 0 ? 12 : fyStartMonth - 1;
  const endYear2  = fyStartMonth === 1 ? startYear : endYear;
  // Last day of endMonth in endYear2
  return new Date(endYear2, endMonth, 0); // day=0 = last day of previous month
}

// ── Service ───────────────────────────────────────────────────────────────────

class FYClosureService {

  // ── Config ─────────────────────────────────────────────────────────────────

  async getConfig(associationId: string) {
    const cfg = await prisma.associationConfig.findUnique({
      where: { association_id: associationId },
      select: { financial_year_start_month: true },
    });
    return { financial_year_start_month: cfg?.financial_year_start_month ?? 4 };
  }

  async updateConfig(associationId: string, startMonth: number) {
    if (startMonth < 1 || startMonth > 12) throw new UnprocessableError('Start month must be 1–12.');
    await prisma.associationConfig.update({
      where: { association_id: associationId },
      data: { financial_year_start_month: startMonth },
    });
    return { data: { financial_year_start_month: startMonth } };
  }

  // ── FY List ────────────────────────────────────────────────────────────────

  async listFYs(associationId: string) {
    const cfg = await this.getConfig(associationId);
    const startMonth = cfg.financial_year_start_month;
    const currentFY  = getFinancialYear(new Date(), startMonth);

    // FYs from journal entries (graceful — may be empty for fresh associations)
    let entries: { financial_year: string }[] = [];
    try {
      entries = await prisma.journalEntry.findMany({
        where:    { association_id: associationId, financial_year: { not: '' } },
        select:   { financial_year: true },
        distinct: ['financial_year'],
      });
    } catch { /* table may not exist yet */ }

    // Closures (graceful — table may not exist until migration runs)
    let closures: any[] = [];
    try {
      closures = await prisma.financialYearClose.findMany({
        where: { association_id: associationId },
        include: { closed_by: { select: { name: true } } },
      });
    } catch { /* migration pending — treat all years as open */ }
    const closedMap = new Map(closures.map((c: any) => [c.financial_year, c]));

    const fySet = new Set([...entries.map(e => e.financial_year), currentFY]);
    const sorted = Array.from(fySet).sort();

    return {
      data: sorted.map(fy => {
        const closure = closedMap.get(fy);
        return {
          financial_year: fy,
          is_current:     fy === currentFY,
          is_closed:      !!closure && closure.status === 'CLOSED',
          status:         closure?.status ?? 'OPEN',
          net_surplus:    closure ? Number(closure.net_surplus) : null,
          closed_at:      closure?.closed_at ?? null,
          closed_by:      closure?.closed_by?.name ?? null,
          closing_entry_id: closure?.closing_entry_id ?? null,
        };
      }),
      current_fy:    currentFY,
      fy_start_month: startMonth,
    };
  }

  // ── Preview Closure ────────────────────────────────────────────────────────

  async previewClosure(associationId: string, fy: string) {
    let existing: any = null;
    try {
      existing = await prisma.financialYearClose.findUnique({
        where: { association_id_financial_year: { association_id: associationId, financial_year: fy } },
      });
    } catch { /* table not yet created — treat as open */ }
    if (existing?.status === 'CLOSED') throw new UnprocessableError(`FY ${fy} is already closed.`);

    // Collect all income/expense lines for the year
    const pnlLines = await prisma.journalLine.findMany({
      where: {
        journal_entry: {
          association_id: associationId,
          financial_year: fy,
          status: JournalStatus.POSTED,
        },
        account: { type: { in: ['INCOME', 'EXPENSE'] }, is_group: false },
      },
      include: {
        account: { select: { id: true, code: true, name: true, type: true, sub_type: true } },
      },
    });

    // Aggregate by account
    const accMap = new Map<string, { account: any; dr: number; cr: number }>();
    for (const line of pnlLines) {
      if (!accMap.has(line.account_id)) {
        accMap.set(line.account_id, { account: line.account, dr: 0, cr: 0 });
      }
      const a = accMap.get(line.account_id)!;
      a.dr += Number(line.debit);
      a.cr += Number(line.credit);
    }

    let totalIncome  = 0;
    let totalExpense = 0;
    const incomeLines:  { account: any; balance: number }[] = [];
    const expenseLines: { account: any; balance: number }[] = [];

    for (const { account, dr, cr } of accMap.values()) {
      if (account.type === 'INCOME') {
        const bal = cr - dr; // credit normal
        totalIncome += bal;
        incomeLines.push({ account, balance: bal });
      } else {
        const bal = dr - cr; // debit normal
        totalExpense += bal;
        expenseLines.push({ account, balance: bal });
      }
    }

    const netSurplus = totalIncome - totalExpense;

    // Equity accounts for surplus account selection
    const equityAccounts = await prisma.account.findMany({
      where: { association_id: associationId, type: 'EQUITY', is_group: false, is_active: true },
      select: { id: true, code: true, name: true },
      orderBy: [{ code: 'asc' }],
    });

    return {
      data: {
        financial_year:  fy,
        total_income:    totalIncome,
        total_expense:   totalExpense,
        net_surplus:     netSurplus,
        income_lines:    incomeLines.sort((a, b) => a.account.code.localeCompare(b.account.code)),
        expense_lines:   expenseLines.sort((a, b) => a.account.code.localeCompare(b.account.code)),
        equity_accounts: equityAccounts,
      },
    };
  }

  // ── Execute Closure ────────────────────────────────────────────────────────

  async closeFY(
    associationId: string,
    fy:            string,
    surplusAccountId: string,
    closedById:    string,
    notes?:        string,
  ) {
    try {
      // Guard: already closed
      const existing = await prisma.financialYearClose.findUnique({
        where: { association_id_financial_year: { association_id: associationId, financial_year: fy } },
      });
      if (existing?.status === 'CLOSED') throw new UnprocessableError(`FY ${fy} is already closed.`);

      // Surplus account must exist and be EQUITY
      const surplusAccount = await prisma.account.findFirst({
        where: { id: surplusAccountId, association_id: associationId, type: 'EQUITY' as any, is_active: true },
      });
      if (!surplusAccount) throw new UnprocessableError('Surplus/Deficit account not found or is not an Equity account.');

      const preview = (await this.previewClosure(associationId, fy)).data;

      // Build closing journal lines
      const lines: { account_id: string; debit: number; credit: number; narration: string }[] = [];

      for (const l of preview.income_lines) {
        if (l.balance > 0) {
          lines.push({ account_id: l.account.id, debit: l.balance, credit: 0, narration: `Year closing — ${l.account.name}` });
        }
      }
      for (const l of preview.expense_lines) {
        if (l.balance > 0) {
          lines.push({ account_id: l.account.id, debit: 0, credit: l.balance, narration: `Year closing — ${l.account.name}` });
        }
      }

      let closingEntryCode: string | null = null;

      await prisma.$transaction(async (tx) => {
        if (lines.length > 0 || preview.net_surplus !== 0) {
          // Add net surplus/deficit plug to equity account
          if (preview.net_surplus > 0) {
            lines.push({ account_id: surplusAccountId, debit: 0, credit: preview.net_surplus, narration: `Net Surplus transferred — FY ${fy}` });
          } else if (preview.net_surplus < 0) {
            lines.push({ account_id: surplusAccountId, debit: -preview.net_surplus, credit: 0, narration: `Net Deficit transferred — FY ${fy}` });
          }

          // Use FY's last day as entry date
          const cfg       = await this.getConfig(associationId);
          const entryDate = getLastDayOfFY(fy, cfg.financial_year_start_month);

          // Voucher number
          const seq = await tx.voucherSequence.upsert({
            where:  { association_id_voucher_type_financial_year: { association_id: associationId, voucher_type: VoucherType.JV, financial_year: fy } },
            update: { last_sequence: { increment: 1 } },
            create: { association_id: associationId, voucher_type: VoucherType.JV, financial_year: fy, last_sequence: 1 },
          });
          closingEntryCode = `JV-${fy}-${String(seq.last_sequence).padStart(4, '0')}`;

          await tx.journalEntry.create({
            data: {
              association_id:  associationId,
              reference_code:  closingEntryCode,
              voucher_type:    VoucherType.JV,
              financial_year:  fy,
              entry_date:      entryDate,
              narration:       `Year Closing Entry — FY ${fy}`,
              status:          JournalStatus.POSTED,
              source:          JournalEntrySource.AUTO,
              reference_type:  'YEAR_CLOSE',
              created_by_id:   closedById,
              lines:           { create: lines },
            },
          });
        }

        // Record closure
        await tx.financialYearClose.upsert({
          where: { association_id_financial_year: { association_id: associationId, financial_year: fy } },
          update: {
            status:           'CLOSED',
            net_surplus:      preview.net_surplus,
            closing_entry_id: closingEntryCode,
            closed_by_id:     closedById,
            closed_at:        new Date(),
            notes:            notes ?? null,
            reopened_by_id:   null,
            reopened_at:      null,
          },
          create: {
            association_id:   associationId,
            financial_year:   fy,
            status:           'CLOSED',
            net_surplus:      preview.net_surplus,
            closing_entry_id: closingEntryCode,
            closed_by_id:     closedById,
            notes:            notes ?? null,
          },
        });
      });

      await auditService.record({
        entity_type: 'financial_year',
        action:      AuditAction.CLOSE,
        summary:     `Closed FY ${fy} — net surplus ₹${Number(preview.net_surplus).toFixed(2)}`,
        new_value: {
          financial_year:    fy,
          net_surplus:       preview.net_surplus,
          closing_entry_id:  closingEntryCode,
          surplus_account_id: surplusAccountId,
          income_accounts:   preview.income_lines.length,
          expense_accounts:  preview.expense_lines.length,
          notes:             notes ?? null,
        },
      });

      return {
        data: {
          financial_year:   fy,
          net_surplus:      preview.net_surplus,
          closing_entry_id: closingEntryCode,
          income_accounts:  preview.income_lines.length,
          expense_accounts: preview.expense_lines.length,
        },
      };

    } catch (err: any) {
      // Re-throw known app errors unchanged; convert all Prisma/unknown errors so the real message is visible
      if (err instanceof UnprocessableError || err instanceof NotFoundError) throw err;
      throw new UnprocessableError(`FY closure error: ${err?.message ?? String(err)}`);
    }
  }

  // ── Reopen FY (undo closure, remove closing entry) ─────────────────────────

  async reopenFY(associationId: string, fy: string, reopenedById: string) {
    const closure = await prisma.financialYearClose.findUnique({
      where: { association_id_financial_year: { association_id: associationId, financial_year: fy } },
    });
    if (!closure || closure.status !== 'CLOSED') throw new UnprocessableError(`FY ${fy} is not closed.`);

    // Delete closing journal entry if it exists
    if (closure.closing_entry_id) {
      await prisma.journalEntry.deleteMany({
        where: { association_id: associationId, reference_code: closure.closing_entry_id, reference_type: 'YEAR_CLOSE' },
      });
    }

    await prisma.financialYearClose.update({
      where: { association_id_financial_year: { association_id: associationId, financial_year: fy } },
      data: {
        status:          'REOPENED',
        reopened_by_id:  reopenedById,
        reopened_at:     new Date(),
        closing_entry_id: null,
      },
    });

    await auditService.record({
      entity_type: 'financial_year',
      action:      AuditAction.REOPEN,
      summary:     `Reopened FY ${fy} (closing entry ${closure.closing_entry_id ?? '—'} removed)`,
      old_value: {
        financial_year:   fy,
        status:           'CLOSED',
        net_surplus:      closure.net_surplus,
        closing_entry_id: closure.closing_entry_id,
        closed_at:        closure.closed_at,
      },
      new_value: { financial_year: fy, status: 'REOPENED' },
    });

    return { data: { financial_year: fy, status: 'REOPENED' } };
  }

  // ── Is year locked? (used by journal service) ──────────────────────────────

  async isYearClosed(associationId: string, fy: string): Promise<boolean> {
    const closure = await prisma.financialYearClose.findUnique({
      where: { association_id_financial_year: { association_id: associationId, financial_year: fy } },
      select: { status: true },
    });
    return closure?.status === 'CLOSED';
  }
}

export const fyClosureService = new FYClosureService();
export { getFinancialYear };
