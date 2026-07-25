import { BPCategory, BalanceType } from '@prisma/client';
import prisma from '../../config/database';
import { ConflictError, NotFoundError } from '../../utils/errors';

export interface CreateBPMasterBody {
  code:                  string;
  name:                  string;
  bp_category:           BPCategory;
  bp_type_id?:           string | null;
  // bank
  account_number?:       string | null;
  ifsc?:                 string | null;
  // vendor
  gstin?:                string | null;
  pan?:                  string | null;
  service_type_id?:      string | null;
  // unit
  unit_id?:              string | null;
  // contact
  email?:                string | null;
  phone?:                string | null;
  // opening balance
  opening_balance?:      number | null;
  opening_balance_type?: BalanceType | null;
  opening_balance_date?: string | null;   // YYYY-MM-DD
}

export type UpdateBPMasterBody = Partial<Omit<CreateBPMasterBody, 'code' | 'bp_category'>>;

class BPMasterService {

  // ── List all BPs (optionally filtered by category) ───────────────────────────
  async list(associationId: string, category?: BPCategory) {
    const bps = await prisma.businessPartner.findMany({
      where: {
        association_id: associationId,
        ...(category ? { bp_category: category } : {}),
      },
      include: {
        unit:         { select: { id: true, flat_number: true, block: true } },
        bp_type:      { select: { id: true, name: true, side: true } },
        service_type: { select: { id: true, name: true } },
      },
      orderBy: [{ bp_category: 'asc' }, { code: 'asc' }],
    });
    return { data: bps };
  }

  // ── Create ────────────────────────────────────────────────────────────────────
  async create(associationId: string, body: CreateBPMasterBody) {
    const existing = await prisma.businessPartner.findUnique({
      where: { association_id_code: { association_id: associationId, code: body.code } },
    });
    if (existing) throw new ConflictError(`BP code ${body.code} already exists.`);

    const { opening_balance_date, opening_balance, ...rest } = body;

    const bp = await prisma.businessPartner.create({
      data: {
        ...rest,
        association_id: associationId,
        opening_balance:      opening_balance != null ? opening_balance : null,
        opening_balance_date: opening_balance_date ? new Date(opening_balance_date) : null,
      },
      include: {
        unit:    { select: { id: true, flat_number: true, block: true } },
        bp_type: { select: { id: true, name: true, side: true } },
      },
    });
    return { data: bp };
  }

  // ── Update ────────────────────────────────────────────────────────────────────
  async update(associationId: string, id: string, body: UpdateBPMasterBody) {
    const bp = await prisma.businessPartner.findFirst({ where: { id, association_id: associationId } });
    if (!bp) throw new NotFoundError('Business partner not found.');

    const { opening_balance_date, opening_balance, ...rest } = body;

    const updated = await prisma.businessPartner.update({
      where: { id },
      data: {
        ...rest,
        ...(opening_balance !== undefined ? { opening_balance: opening_balance ?? null } : {}),
        ...(opening_balance_date !== undefined
          ? { opening_balance_date: opening_balance_date ? new Date(opening_balance_date) : null }
          : {}),
      },
      include: {
        unit:    { select: { id: true, flat_number: true, block: true } },
        bp_type: { select: { id: true, name: true, side: true } },
      },
    });
    return { data: updated };
  }

  // ── Toggle active ─────────────────────────────────────────────────────────────
  async toggle(associationId: string, id: string) {
    const bp = await prisma.businessPartner.findFirst({ where: { id, association_id: associationId } });
    if (!bp) throw new NotFoundError('Business partner not found.');
    const updated = await prisma.businessPartner.update({
      where: { id },
      data: { is_active: !bp.is_active },
    });
    return { data: updated };
  }

  // ── Delete ────────────────────────────────────────────────────────────────────
  async delete(associationId: string, id: string) {
    const bp = await prisma.businessPartner.findFirst({ where: { id, association_id: associationId } });
    if (!bp) throw new NotFoundError('Business partner not found.');
    await prisma.businessPartner.delete({ where: { id } });
    return { data: { deleted: true } };
  }

  // ── List units (for dropdown in Unit BP form) ─────────────────────────────────
  async listUnits(associationId: string) {
    const units = await prisma.unit.findMany({
      where: { association_id: associationId, deleted_at: null },
      select: { id: true, flat_number: true, block: true, floor: true },
      orderBy: [{ block: 'asc' }, { flat_number: 'asc' }],
    });
    return { data: units };
  }
}

export const bpMasterService = new BPMasterService();
