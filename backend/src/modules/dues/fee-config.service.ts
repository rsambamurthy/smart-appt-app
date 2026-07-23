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

    // If FeeConfig is empty, fall back to DuesConfig and return synthetic rows
    // (no `id` set — user reviews and saves to persist them)
    if (rows.length === 0) {
      const legacy = await prisma.duesConfig.findUnique({ where: { association_id: associationId } });
      if (legacy) {
        const synthetic: FeeConfigRow[] = [
          {
            fee_type: 'MONTHLY_CHARGE',
            calc_method: legacy.charge_type === 'RATE_PER_SQFT' ? 'RATE_PER_SQFT' : 'FIXED_AMOUNT',
            amount: legacy.charge_type === 'RATE_PER_SQFT'
              ? (legacy.rate_per_sqft?.toNumber() ?? 0)
              : legacy.monthly_charge.toNumber(),
            due_day: legacy.due_day,
            as_on_date: null,
            is_active: true,
          },
          {
            fee_type: 'PENALTY_AMOUNT',
            calc_method: 'FIXED_AMOUNT',
            amount: legacy.penalty_value.toNumber(),
            due_day: legacy.due_day,
            as_on_date: null,
            is_active: true,
          },
          ...(legacy.cash_balance != null ? [{
            fee_type: 'CASH_OPENING_BALANCE' as FeeType,
            calc_method: null,
            amount: legacy.cash_balance.toNumber(),
            due_day: null,
            as_on_date: legacy.cash_balance_as_on
              ? legacy.cash_balance_as_on.toISOString().split('T')[0]
              : null,
            is_active: true,
          }] : []),
        ];
        return { data: synthetic };
      }
    }

    return {
      data: rows.map((r) => ({
        ...r,
        amount: r.amount.toNumber(),
        as_on_date: r.as_on_date ? r.as_on_date.toISOString().split('T')[0] : null,
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
