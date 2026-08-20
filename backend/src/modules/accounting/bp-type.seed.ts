import { BPCategory, BPSide, Prisma } from '@prisma/client';
import prisma from '../../config/database';

/**
 * Business-partner types, and the sub-ledger wiring that depends on them.
 *
 * A control account finds its sub-ledger through exactly one join:
 *
 *     business_partners.bp_type_id = accounts.bp_type_id
 *
 * Nothing else — not bp_category, not unit_id. That single fact caused two
 * separate outages of the same feature:
 *
 *   - An association that turned Dues Receivable into a control account found
 *     it listed no flats, because no BP type existed to link and no unit
 *     partners had been created. The setup was manual and undocumented, so of
 *     course it was skipped.
 *
 *   - Unit partners created by the opening-balance upload had a null
 *     bp_type_id, so they were invisible to the control account no matter how
 *     correct they looked on the Business Partners screen.
 *
 * The three types are not really optional — the chart of accounts assumes bank,
 * vendor and unit sub-ledgers exist — so they are seeded rather than left as an
 * exercise, and 1004 is wired to the unit type out of the box.
 */

export const BP_TYPE_BANK   = 'Bank';
export const BP_TYPE_VENDOR = 'Vendor';
export const BP_TYPE_UNIT   = 'Unit / Flat';

const DEFAULT_BP_TYPES: Array<{ name: string; side: BPSide }> = [
  // Money we hold. BOTH because a bank account can be overdrawn.
  { name: BP_TYPE_BANK,   side: BPSide.BOTH },
  // Money we owe.
  { name: BP_TYPE_VENDOR, side: BPSide.PAYABLE },
  // Money owed to us. A flat in credit is a payable balance on a receivable
  // type, which is ordinary, so this is not RECEIVABLE-only either.
  { name: BP_TYPE_UNIT,   side: BPSide.BOTH },
];

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Create the three standard types if missing. Idempotent, and safe to call on
 * an association that already has them under the same names.
 */
export async function seedBPTypes(associationId: string, db: Db = prisma) {
  const existing = await db.bPType.findMany({
    where:  { association_id: associationId },
    select: { id: true, name: true },
  });
  const byName = new Map(existing.map(t => [t.name, t.id]));

  const missing = DEFAULT_BP_TYPES.filter(t => !byName.has(t.name));
  if (missing.length) {
    await db.bPType.createMany({
      data: missing.map(t => ({ ...t, association_id: associationId })),
    });
  }

  const all = await db.bPType.findMany({
    where:  { association_id: associationId },
    select: { id: true, name: true },
  });
  return new Map(all.map(t => [t.name, t.id]));
}

/**
 * Point Dues Receivable at the unit type.
 *
 * Only fills a gap — an association that has deliberately linked 1004 to some
 * other type keeps it. Re-running this must never quietly redirect a live
 * sub-ledger.
 */
export async function linkDuesReceivable(associationId: string, db: Db = prisma) {
  const types = await seedBPTypes(associationId, db);
  const unitTypeId = types.get(BP_TYPE_UNIT);
  if (!unitTypeId) return null;

  const account = await db.account.findUnique({
    where:  { association_id_code: { association_id: associationId, code: '1004' } },
    select: { id: true, bp_type_id: true, is_control_account: true },
  });
  if (!account) return null;
  if (account.bp_type_id) return account.bp_type_id;

  await db.account.update({
    where: { id: account.id },
    data:  { is_control_account: true, bp_type_id: unitTypeId },
  });
  return unitTypeId;
}

/**
 * The BP type that Dues Receivable is using, or null if it is not a control
 * account. Used when creating a unit partner so it lands in the right ledger.
 */
export async function duesReceivableBPTypeId(associationId: string, db: Db = prisma) {
  const account = await db.account.findUnique({
    where:  { association_id_code: { association_id: associationId, code: '1004' } },
    select: { bp_type_id: true, is_control_account: true },
  });
  return account?.is_control_account ? account.bp_type_id : null;
}

/**
 * Point Accounts Payable at the vendor type. Same idempotent, gap-filling
 * shape as linkDuesReceivable — an association that already has 2004 linked
 * to something else keeps it.
 */
export async function linkAccountsPayable(associationId: string, db: Db = prisma) {
  const types = await seedBPTypes(associationId, db);
  const vendorTypeId = types.get(BP_TYPE_VENDOR);
  if (!vendorTypeId) return null;

  const account = await db.account.findUnique({
    where:  { association_id_code: { association_id: associationId, code: '2004' } },
    select: { id: true, bp_type_id: true, is_control_account: true },
  });
  if (!account) return null;
  if (account.bp_type_id) return account.bp_type_id;

  await db.account.update({
    where: { id: account.id },
    data:  { is_control_account: true, bp_type_id: vendorTypeId },
  });
  return vendorTypeId;
}

/**
 * The BP type that Accounts Payable is using, or null if it is not a control
 * account. Used when creating a vendor partner so it lands in the right
 * ledger.
 */
export async function accountsPayableBPTypeId(associationId: string, db: Db = prisma) {
  const account = await db.account.findUnique({
    where:  { association_id_code: { association_id: associationId, code: '2004' } },
    select: { bp_type_id: true, is_control_account: true },
  });
  return account?.is_control_account ? account.bp_type_id : null;
}

/** `UNIT-A101`, capped at the column's 20 characters. */
export function unitBPCode(unit: { flat_number: string; block: string | null }) {
  const raw = `UNIT-${unit.block ?? ''}${unit.flat_number}`.replace(/[^A-Za-z0-9-]/g, '');
  return raw.toUpperCase().slice(0, 20);
}

export function unitBPName(unit: { flat_number: string; block: string | null }) {
  return `Unit ${unit.flat_number}${unit.block ? ` ${unit.block}` : ''}`;
}

/** `VEND-<id prefix>`, capped at the column's 20 characters. Vendor names are
 * free text (not unique, unlike a flat number), so the code is derived from
 * the id rather than the name to guarantee it never collides. */
export function vendorBPCode(vendor: { id: string }) {
  return `VEND-${vendor.id.replace(/-/g, '').slice(0, 14)}`.toUpperCase().slice(0, 20);
}

export function vendorBPName(vendor: { name: string }) {
  return vendor.name;
}

/**
 * Ensure one business partner exists for a unit, correctly typed.
 *
 * Called when a flat is created, so the sub-ledger is never a step someone has
 * to remember. Best-effort: a failure here must not stop a manager adding a
 * flat, since the backfill script can repair it and a missing sub-ledger card
 * is a lesser problem than being unable to register a resident.
 */
export async function ensureUnitBP(
  associationId: string,
  unit: { id: string; flat_number: string; block: string | null },
  db: Db = prisma,
) {
  const existing = await db.businessPartner.findFirst({
    where:  { association_id: associationId, unit_id: unit.id },
    select: { id: true, bp_type_id: true },
  });

  const bpTypeId = await duesReceivableBPTypeId(associationId, db);

  if (existing) {
    // Repair in place: a partner created before the account was linked, or by
    // the opening-balance upload, has no type and is invisible until it does.
    if (!existing.bp_type_id && bpTypeId) {
      await db.businessPartner.update({
        where: { id: existing.id },
        data:  { bp_type_id: bpTypeId },
      });
    }
    return existing.id;
  }

  const created = await db.businessPartner.create({
    data: {
      association_id: associationId,
      code:           unitBPCode(unit),
      name:           unitBPName(unit),
      bp_category:    BPCategory.UNIT,
      bp_type_id:     bpTypeId,
      unit_id:        unit.id,
      is_active:      true,
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * Ensure one business partner exists for a vendor, correctly typed as an
 * Accounts Payable sub-ledger card, and link it back onto the Vendor row.
 *
 * Unlike units (wired on every flat, since Dues Receivable assumes all of
 * them exist), most vendors never need this — a vendor only gets a ledger
 * card the first time something requires posting against its payable
 * balance specifically, e.g. turning on month-end accrual for a recurring
 * expense against it. Idempotent: a vendor that already has a card just gets
 * its bp_type repaired if it was created before Accounts Payable was linked.
 */
export async function ensureVendorBP(
  associationId: string,
  vendor: { id: string; name: string; business_partner_id: string | null },
  db: Db = prisma,
) {
  const bpTypeId = await accountsPayableBPTypeId(associationId, db);

  if (vendor.business_partner_id) {
    const existing = await db.businessPartner.findUnique({
      where: { id: vendor.business_partner_id },
      select: { id: true, bp_type_id: true },
    });
    if (existing) {
      if (!existing.bp_type_id && bpTypeId) {
        await db.businessPartner.update({ where: { id: existing.id }, data: { bp_type_id: bpTypeId } });
      }
      return existing.id;
    }
    // The linked BP was deleted out from under the vendor — fall through and
    // create a fresh one rather than leaving the vendor permanently broken.
  }

  const created = await db.businessPartner.create({
    data: {
      association_id: associationId,
      code:           vendorBPCode(vendor),
      name:           vendorBPName(vendor),
      bp_category:    BPCategory.VENDOR,
      bp_type_id:     bpTypeId,
      is_active:      true,
    },
    select: { id: true },
  });

  await db.vendor.update({ where: { id: vendor.id }, data: { business_partner_id: created.id } });
  return created.id;
}

/**
 * The other direction of the same bridge: given a Business Partner the user
 * picked from the (already-populated) Business Partners screen — the single
 * vendor list associations actually maintain, e.g. via bulk upload — find or
 * create the lightweight Vendor row that RecurringExpense/Expense actually
 * point to.
 *
 * Vendor stays a separate, minimal table (see its schema comment) purely
 * because RecurringExpense.vendor_id and Expense.vendor_id are hard FKs to
 * it, not to BusinessPartner. This keeps that plumbing invisible: the user
 * only ever sees and picks Business Partners; a Vendor row is an
 * implementation detail created transparently the first time a given partner
 * is chosen here, then reused via the unique business_partner_id link.
 */
export async function ensureVendorFromBusinessPartner(
  associationId: string,
  businessPartnerId: string,
  createdBy: string,
  db: Db = prisma,
) {
  const existing = await db.vendor.findUnique({
    where:  { business_partner_id: businessPartnerId },
    select: { id: true, association_id: true },
  });
  if (existing) {
    if (existing.association_id !== associationId) return null;
    return existing.id;
  }

  const bp = await db.businessPartner.findFirst({
    where:  { id: businessPartnerId, association_id: associationId, bp_category: BPCategory.VENDOR },
    select: { id: true, name: true },
  });
  if (!bp) return null;

  const created = await db.vendor.create({
    data: {
      association_id: associationId,
      name: bp.name,
      business_partner_id: bp.id,
      created_by: createdBy,
    },
    select: { id: true },
  });
  return created.id;
}
