import { AccountType, BPSide } from '@prisma/client';
import prisma from '../../config/database';
import { ConflictError, NotFoundError } from '../../utils/errors';
import { CreateAccountBody, UpdateAccountBody } from './accounting.schema';
import { auditService } from '../../services/audit.service';
import logger from '../../utils/logger';
import { seedBPTypes, linkDuesReceivable, ensureUnitBP, linkAccountsPayable } from './bp-type.seed';

// ── Standard housing-society chart of accounts ───────────────────────────────
type SeedAccount = {
  code:               string;
  name:               string;
  type:               AccountType;
  sub_type?:          string;
  is_system:          boolean;
  is_group:           boolean;
  is_control_account: boolean;
};

const DEFAULT_ACCOUNTS: SeedAccount[] = [
  // ASSET
  { code: '1001', name: 'Cash in Hand',         type: AccountType.ASSET,     sub_type: 'Current Asset',     is_system: true,  is_group: false, is_control_account: false },
  { code: '1002', name: 'Bank Account',          type: AccountType.ASSET,     sub_type: 'Current Asset',     is_system: true,  is_group: false, is_control_account: false },
  { code: '1003', name: 'Fixed Deposit',         type: AccountType.ASSET,     sub_type: 'Current Asset',     is_system: false, is_group: false, is_control_account: false },
  { code: '1004', name: 'Dues Receivable',       type: AccountType.ASSET,     sub_type: 'Current Asset',     is_system: true,  is_group: false, is_control_account: false },
  { code: '1005', name: 'Other Receivable',      type: AccountType.ASSET,     sub_type: 'Current Asset',     is_system: false, is_group: false, is_control_account: false },
  // LIABILITY
  { code: '2001', name: 'Advance Deposits',      type: AccountType.LIABILITY, sub_type: 'Current Liability', is_system: false, is_group: false, is_control_account: false },
  { code: '2002', name: 'Loans Payable',         type: AccountType.LIABILITY, sub_type: 'Current Liability', is_system: false, is_group: false, is_control_account: false },
  { code: '2003', name: 'Other Payables',        type: AccountType.LIABILITY, sub_type: 'Current Liability', is_system: false, is_group: false, is_control_account: false },
  // Control account for the Vendor BP type — see linkAccountsPayable(), same
  // pattern as Dues Receivable (1004) being linked to the Unit BP type.
  { code: '2004', name: 'Accounts Payable',      type: AccountType.LIABILITY, sub_type: 'Current Liability', is_system: true,  is_group: false, is_control_account: false },
  // INCOME
  { code: '3001', name: 'Maintenance Income',    type: AccountType.INCOME,    sub_type: 'Operating Income',  is_system: true,  is_group: false, is_control_account: false },
  { code: '3002', name: 'Other Receipts',        type: AccountType.INCOME,    sub_type: 'Other Income',      is_system: true,  is_group: false, is_control_account: false },
  { code: '3003', name: 'Interest Income',       type: AccountType.INCOME,    sub_type: 'Other Income',      is_system: false, is_group: false, is_control_account: false },
  { code: '3004', name: 'Penalty Income',        type: AccountType.INCOME,    sub_type: 'Other Income',      is_system: false, is_group: false, is_control_account: false },
  // EXPENSE
  { code: '4001', name: 'Electricity',           type: AccountType.EXPENSE,   sub_type: 'Utility',           is_system: false, is_group: false, is_control_account: false },
  { code: '4002', name: 'Water Charges',         type: AccountType.EXPENSE,   sub_type: 'Utility',           is_system: false, is_group: false, is_control_account: false },
  { code: '4003', name: 'Security Salaries',     type: AccountType.EXPENSE,   sub_type: 'Salaries',          is_system: false, is_group: false, is_control_account: false },
  { code: '4004', name: 'Housekeeping Salaries', type: AccountType.EXPENSE,   sub_type: 'Salaries',          is_system: false, is_group: false, is_control_account: false },
  { code: '4005', name: 'Repairs & Maintenance', type: AccountType.EXPENSE,   sub_type: 'Maintenance',       is_system: false, is_group: false, is_control_account: false },
  { code: '4006', name: 'Lift Maintenance',      type: AccountType.EXPENSE,   sub_type: 'Maintenance',       is_system: false, is_group: false, is_control_account: false },
  { code: '4007', name: 'Generator Expense',     type: AccountType.EXPENSE,   sub_type: 'Utility',           is_system: false, is_group: false, is_control_account: false },
  { code: '4008', name: 'Administrative',        type: AccountType.EXPENSE,   sub_type: 'Administrative',    is_system: false, is_group: false, is_control_account: false },
  { code: '4009', name: 'Audit Fees',            type: AccountType.EXPENSE,   sub_type: 'Administrative',    is_system: false, is_group: false, is_control_account: false },
  { code: '4010', name: 'Insurance',             type: AccountType.EXPENSE,   sub_type: 'Administrative',    is_system: false, is_group: false, is_control_account: false },
  // EQUITY
  { code: '5001', name: 'Reserve Fund',          type: AccountType.EQUITY,    sub_type: 'Reserve',           is_system: false, is_group: false, is_control_account: false },
  { code: '5002', name: 'Corpus Fund',           type: AccountType.EQUITY,    sub_type: 'Reserve',           is_system: false, is_group: false, is_control_account: false },
  { code: '5003', name: 'Opening Balance Equity',type: AccountType.EQUITY,    sub_type: 'Opening Balance',   is_system: true,  is_group: false, is_control_account: false },
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

    if (toCreate.length) {
      await prisma.account.createMany({ data: toCreate });
    }

    // Always, even when every account already existed. Associations created
    // before BP types were seeded need this too, and re-seeding is how they
    // get it — otherwise the sub-ledger stays a manual setup step nobody knows
    // to perform.
    await seedBPTypes(associationId);
    const linkedTo = await linkDuesReceivable(associationId);
    // Accounts Payable (2004) → Vendor BP type. Unlike units, vendor cards
    // aren't backfilled here — most vendors never need one, so they're
    // created lazily by ensureVendorBP the first time something actually
    // posts against a specific vendor's payable balance.
    await linkAccountsPayable(associationId);

    // Backfill any unit that has no partner card yet, or has one with no type.
    // A control account with no members is indistinguishable from a broken one.
    let unitsWired = 0;
    if (linkedTo) {
      const units = await prisma.unit.findMany({
        where:  { association_id: associationId, deleted_at: null },
        select: { id: true, flat_number: true, block: true },
      });
      for (const unit of units) {
        try { await ensureUnitBP(associationId, unit); unitsWired++; }
        catch (err) {
          logger.error('Could not create unit business partner', { unit: unit.id, error: err });
        }
      }
    }

    return { data: { seeded: toCreate.length, units_wired: unitsWired } };
  }

  // ── Create account ────────────────────────────────────────────────────────────
  async createAccount(associationId: string, body: CreateAccountBody) {
    const existing = await prisma.account.findUnique({
      where: { association_id_code: { association_id: associationId, code: body.code } },
    });
    if (existing) throw new ConflictError(`Account code ${body.code} already exists.`);

    const { opening_balance_date, ...rest } = body;
    const account = await prisma.account.create({
      data: {
        ...rest,
        association_id:      associationId,
        is_system:           false,
        opening_balance_date: opening_balance_date ? new Date(opening_balance_date) : null,
      },
    });

    await auditService.create(
      'account', account.id, body,
      `Created account ${account.code} — ${account.name}`,
    );

    return { data: account };
  }

  // ── Update account ────────────────────────────────────────────────────────────
  async updateAccount(associationId: string, id: string, body: UpdateAccountBody) {
    const account = await prisma.account.findFirst({ where: { id, association_id: associationId } });
    if (!account) throw new NotFoundError('Account not found.');

    const obDate = body.opening_balance_date ? new Date(body.opening_balance_date) : undefined;

    // System accounts: protect structural fields (code, type, is_group) but allow
    // name, description, control account linkage, and opening balance to be edited.
    const data = account.is_system
      ? {
          name:                 body.name,
          description:          body.description,
          is_control_account:   body.is_control_account,
          bp_type_id:           body.is_control_account ? body.bp_type_id : null,
          opening_balance:      body.opening_balance,
          opening_balance_type: body.opening_balance_type,
          opening_balance_date: obDate,
        }
      : {
          ...body,
          opening_balance_date: obDate,
        };

    const updated = await prisma.account.update({ where: { id }, data });

    await auditService.update(
      'account', id,
      {
        name: account.name, description: account.description,
        is_control_account: account.is_control_account, bp_type_id: account.bp_type_id,
        opening_balance: account.opening_balance,
        opening_balance_type: account.opening_balance_type,
        opening_balance_date: account.opening_balance_date,
        is_active: account.is_active,
      },
      data,
      `Updated account ${account.code} — ${account.name}`,
    );

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

    await auditService.update(
      'account', id,
      { is_active: account.is_active },
      { is_active: updated.is_active },
      `${updated.is_active ? 'Activated' : 'Deactivated'} account ${account.code} — ${account.name}`,
    );

    return { data: updated };
  }

  // ── Delete account ────────────────────────────────────────────────────────────
  async deleteAccount(associationId: string, id: string) {
    const account = await prisma.account.findFirst({ where: { id, association_id: associationId } });
    if (!account) throw new NotFoundError('Account not found.');
    if (account.is_system) throw new ConflictError('System accounts cannot be deleted.');

    await prisma.account.delete({ where: { id } });

    // The row is gone — old_value is the only remaining record of it.
    await auditService.delete(
      'account', id, account,
      `Deleted account ${account.code} — ${account.name}`,
    );

    return { data: { deleted: true } };
  }

  // ── List BP Types ─────────────────────────────────────────────────────────────
  async listBPTypes(associationId: string) {
    const types = await prisma.bPType.findMany({
      where: { association_id: associationId },
      orderBy: { name: 'asc' },
    });
    return { data: types };
  }

  // ── Create BP Type ────────────────────────────────────────────────────────────
  async createBPType(associationId: string, body: { name: string; side: BPSide }) {
    const existing = await prisma.bPType.findUnique({
      where: { association_id_name: { association_id: associationId, name: body.name } },
    });
    if (existing) throw new ConflictError(`BP Type "${body.name}" already exists.`);

    const bpType = await prisma.bPType.create({
      data: { ...body, association_id: associationId },
    });
    return { data: bpType };
  }

  // ── Toggle BP Type active ─────────────────────────────────────────────────────
  async toggleBPType(associationId: string, id: string) {
    const bpType = await prisma.bPType.findFirst({ where: { id, association_id: associationId } });
    if (!bpType) throw new NotFoundError('BP Type not found.');
    const updated = await prisma.bPType.update({
      where: { id },
      data: { is_active: !bpType.is_active },
    });
    return { data: updated };
  }
}

export const accountingService = new AccountingService();
