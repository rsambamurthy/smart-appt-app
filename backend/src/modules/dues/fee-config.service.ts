import prisma from '../../config/database';
import { ConflictError } from '../../utils/errors';
import { FeeType, CalcMethod } from '@prisma/client';

export interface FeeConfigRow {
  id?: string;
  fee_type: FeeType;
  calc_method?: CalcMethod | null;
  amount: number;
  due_day?: number | null;
  as_on_date?: string | null;
  is_active: boolean;
}

export class FeeConfigService {
  async listFeeConfigs(associationId: string) {
    const rows = await prisma.feeConfig.findMany({
      where: { association_id: associationId },
      orderBy: [{ fee_type: 'asc' }, { created_at: 'asc' }],
    });
    return {
      data: rows.map((r) => ({
        ...r,
        amount: r.amount.toNumber(),
      })),
    };
  }

  async saveFeeConfigs(associationId: string, rows: FeeConfigRow[], updatedBy: string) {
    // Validate: no two ACTIVE rows may share the same fee_type
    const activeByType = new Map<FeeType, number>();
    for (const row of rows) {
      if (row.is_active) {
        activeByType.set(row.fee_type, (activeByType.get(row.fee_type) ?? 0) + 1);
      }
    }
    for (const [type, count] of activeByType) {
      if (count > 1) {
        throw new ConflictError(
          `Duplicate active configuration for fee type "${type}". Deactivate the existing one first.`,
        );
      }
    }

    // Upsert inside a transaction
    const result = await prisma.$transaction(async (tx) => {
      const saved = [];
      for (const row of rows) {
        const data = {
          association_id: associationId,
          fee_type: row.fee_type,
          calc_method: row.calc_method ?? null,
          amount: row.amount,
          due_day: row.due_day ?? null,
          as_on_date: row.as_on_date ? new Date(row.as_on_date) : null,
          is_active: row.is_active,
          updated_by: updatedBy,
        };

        if (row.id) {
          const updated = await tx.feeConfig.update({ where: { id: row.id }, data });
          saved.push(updated);
        } else {
          const created = await tx.feeConfig.create({ data });
          saved.push(created);
        }
      }
      return saved;
    });

    return {
      data: result.map((r) => ({ ...r, amount: r.amount.toNumber() })),
    };
  }

  async deleteFeeConfig(id: string, associationId: string) {
    await prisma.feeConfig.delete({ where: { id, association_id: associationId } });
    return { data: { deleted: true } };
  }
}

export const feeConfigService = new FeeConfigService();
