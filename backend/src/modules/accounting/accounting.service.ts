import { AccountType } from '@prisma/client';
import prisma from '../../config/database';
import { ConflictError, NotFoundError } from '../../utils/errors';
import { CreateAccountBody, UpdateAccountBody } from './accounting.schema';

// ── Standard housing-society chart of accounts ───────────────────────────────
const DEFAULT_ACCOUNTS: Omit<CreateAccountBody & { is_system: boolean }, 'sort_order'>[] = [
  // ASSET
  { code: '1001', name: 'Cash in Hand',         type: AccountType.ASSET,     sub_type: 'Current Asset',  is_system: true  },
  { code: '1002', name: 'Bank Account',          type: AccountType.ASSET,     sub_type: 'Current Asset',  is_system: true  },
  { code: '1003', name: 'Fixed Deposit',         type: AccountType.ASSET,     sub_type: 'Current Asset',  is_system: false },
  { code: '1004', name: 'Dues Receivable',       type: AccountType.ASSET,     sub_type: 'Current Asset',  is_system: true  },
  { code: '1005', name: 'Other Receivable',      type: AccountType.ASSET,     sub_type: 'Current Asset',  is_system: false },
  // LIABILITY
  { code: '2001', name: 'Advance Deposits',      type: AccountType.LIABILITY, sub_type: 'Current Liability', is_system: false },
  { code: '2002', name: 'Loans Payable',         type: AccountType.LIABILITY, sub_type: 'Current Liability', is_system: false },
  { code: '2003', name: 'Other Payables',        type: AccountType.LIABILITY, sub_type: 'Current Liability', is_system: false },
  // INCOME
  { code: '3001', name: 'Maintenance Income',    type: AccountType.INCOME,    sub_type: 'Operating Income',  is_system: true  },
  { code: '3002', name: 'Other Receipts',        type: AccountType.INCOME,    sub_type: 'Other Income',      is_system: true  },
  { code: '3003', name: 'Interest Income',       type: AccountType.INCOME,    sub_type: 'Other Income',      is_system: false },
  { code: '3004', name: 'Penalty Income',        type: AccountType.INCOME,    sub_type: 'Other Income',      is_system: false },
  // EXPENSE
  { code: '4001', name: 'Electricity',           type: AccountType.EXPENSE,   sub_type: 'Utility',           is_system: false },
  { code: '4002', name: 'Water Charges',         type: AccountType.EXPENSE,   sub_type: 'Utility',           is_system: false },
  { code: '4003', name: 'Security Salaries',     type: AccountType.EXPENSE,   sub_type: 'Salaries',          is_system: false },
  { code: '4004', name: 'Housekeeping Salaries', type: AccountType.EXPENSE,   sub_type: 'Salaries',          is_system: false },
  { code: '4005', name: 'Repairs & Maintenance', type: AccountType.EXPENSE,   sub_type: 'Maintenance',       is_system: false },
  { code: '4006', name: 'Lift Maintenance',      type: AccountType.EXPENSE,   sub_type: 'Maintenance',       is_system: false },
  { code: '4007', name: 'Generator Expense',     type: AccountType.EXPENSE,   sub_type: 'Utility',           is_system: false },
  { code: '4008', name: 'Administrative',        type: AccountType.EXPENSE,   sub_type: 'Administrative',    is_system: false },
  { code: '4009', name: 'Audit Fees',            type: AccountType.EXPENSE,   sub_type: 'Administrative',    is_system: false },
  { code: '4010', name: 'Insurance',             type: AccountType.EXPENSE,   sub_type: 'Administrative',    is_system: false },
  // EQUITY
  { code: '5001', name: 'Reserve Fund',              type: AccountType.EQUITY,    sub_type: 'Reserve',           is_system: false },
  { code: '5002', name: 'Corpus Fund',               type: AccountType.EQUITY,    sub_type: 'Reserve',           is_system: false },
  { code: '5003', name: 'Opening Balance Equity',    type: AccountType.EQUITY,    sub_type: 'Opening Balance',   is_system: true  },
];

class AccountingService {

  // ── List all accounts for an association ─────────────────────────────────────
  async listAccounts(associationId: string) {
    const accounts = await prisma.account.findMany({
      where: { association_id: associationId },
      orderBy: [{ type: 'asc' }, { sort_order: 'asc' }, { code: 'asc' }],
    });
    return { data: accounts };
  }

  // ── Seed default accounts (idempotent — skips existing codes) ────────────────
  async seedDefaults(associationId: string) {
    const existing = await prisma.account.findMany({
      where: { association_id: associationId },
      select: { code: true },
    });
    const existingCodes = new Set(existing.map(a => a.code));

    const toCreate = DEFAULT_ACCOUNTS
      .filter(a => !existingCodes.has(a.code))
      .map((a, i) => ({ ...a, association_id: associationId, sort_order: i }));

    if (toCreate.length === 0) return { data: { seeded: 0 } };

    await prisma.account.createMany({ data: toCreate });
    return { data: { seeded: toCreate.length } };
  }

  // ── Create account ────────────────────────────────────────────────────────────
  async createAccount(associationId: string, body: CreateAccountBody) {
    const existing = await prisma.account.findUnique({
      where: { association_id_code: { association_id: associationId, code: body.code } },
    });
    if (existing) throw new ConflictError(`Account code ${body.code} already exists.`);

    const account = await prisma.account.create({
      data: { ...body, association_id: associationId, is_system: false },
    });
    return { data: account };
  }

  // ── Update account ────────────────────────────────────────────────────────────
  async updateAccount(associationId: string, id: string, body: UpdateAccountBody) {
    const account = await prisma.account.findFirst({ where: { id, association_id: associationId } });
    if (!account) throw new NotFoundError('Account not found.');

    // System accounts: only name and description can change
    const safeBody = account.is_system
      ? { name: body.name, description: body.description }
      : body;

    const updated = await prisma.account.update({ where: { id }, data: safeBody });
    return { data: updated };
  }

  // ── Toggle active ─────────────────────────────────────────────────────────────
  async toggleActive(associationId: string, id: string) {
    const account = await prisma.account.findFirst({ where: { id, association_id: associationId } });
    if (!account) throw new NotFoundError('Account not found.');
    if (account.is_system) throw new ConflictError('System accounts cannot be deactivated.');

    const updated = await prisma.account.update({
      where: { id },
      data: { is_active: !account.is_active },
    });
    return { data: updated };
  }

  // ── Delete account ────────────────────────────────────────────────────────────
  async deleteAccount(associationId: string, id: string) {
    const account = await prisma.account.findFirst({ where: { id, association_id: associationId } });
    if (!account) throw new NotFoundError('Account not found.');
    if (account.is_system) throw new ConflictError('System accounts cannot be deleted.');

    await prisma.account.delete({ where: { id } });
    return { data: { deleted: true } };
  }
}

export const accountingService = new AccountingService();
