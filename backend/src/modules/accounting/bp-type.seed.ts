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

/** `UNIT-A101`, capped at the column's 20 characters. */
export function unitBPCode(unit: { flat_number: string; block: string | null }) {
  const raw = `UNIT-${unit.block ?? ''}${unit.flat_number}`.replace(/[^A-Za-z0-9-]/g, '');
  return raw.toUpperCase().slice(0, 20);
}

export function unitBPName(unit: { flat_number: string; block: string | null }) {
  return `Unit ${unit.flat_number}${unit.block ? ` ${unit.block}` : ''}`;
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
