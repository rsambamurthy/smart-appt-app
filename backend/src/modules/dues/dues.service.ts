import Razorpay from 'razorpay';
import crypto from 'crypto';
import prisma from '../../config/database';
import { NotFoundError, ConflictError, UnprocessableError, GatewayError } from '../../utils/errors';
import { notificationService } from '../../services/notification.service';
import { paginatedResponse } from '../../utils/helpers';
import {
  DuesConfigBody, GenerateBillsBody, RollbackBillsBody, OfflinePaymentBody,
  InitiatePaymentBody, CreateLevyBody,
  OneTimeDueBody, UpdateOneTimeDueBody, GenerateOneTimeDueBillsBody,
} from './dues.schema';
import { BillStatus, OneTimeDueStatus, PaymentMode, UserRole } from '@prisma/client';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export class DuesService {
  // ── Config ───────────────────────────────────────────────────────────────────
  async getConfig(associationId: string) {
    const config = await prisma.duesConfig.findUnique({ where: { association_id: associationId } });
    return { data: config };
  }

  async upsertConfig(associationId: string, body: DuesConfigBody, updatedBy: string) {
    const config = await prisma.duesConfig.upsert({
      where: { association_id: associationId },
      update: { ...body, updated_by: updatedBy },
      create: { association_id: associationId, ...body, updated_by: updatedBy },
    });
    return { data: config };
  }

  // ── Bill Generation ──────────────────────────────────────────────────────────
  async generateBills(associationId: string, body: GenerateBillsBody) {
    const config = await prisma.duesConfig.findUnique({ where: { association_id: associationId } });
    if (!config) throw new UnprocessableError('Dues configuration not found. Please set up dues config first.');

    if (config.charge_type === 'RATE_PER_SQFT' && !config.rate_per_sqft) {
      throw new UnprocessableError('Rate per sq ft is required when charge type is RATE_PER_SQFT.');
    }

    const units = body.unit_ids
      ? await prisma.unit.findMany({ where: { id: { in: body.unit_ids }, association_id: associationId } })
      : await prisma.unit.findMany({ where: { association_id: associationId } });

    const dueDate = new Date(body.year, body.month - 1, config.due_day);
    const created: string[] = [];
    const skipped: string[] = [];

    for (const unit of units) {
      const existing = await prisma.bill.findFirst({
        where: { unit_id: unit.id, period_month: body.month, period_year: body.year },
      });
      if (existing) { skipped.push(unit.flat_number); continue; }

      // Calculate base amount based on charge type
      let baseAmount: number;
      if (config.charge_type === 'RATE_PER_SQFT') {
        const sqft = Number(unit.area_sqft ?? 0);
        if (!sqft) { skipped.push(unit.flat_number); continue; } // skip units with no area recorded
        baseAmount = Number(config.rate_per_sqft) * sqft;
      } else {
        baseAmount = Number(config.monthly_charge);
      }

      const bill = await prisma.bill.create({
        data: {
          association_id: associationId,
          unit_id: unit.id,
          period_month: body.month,
          period_year: body.year,
          base_amount: baseAmount,
          penalty: 0,
          levy_amount: 0,
          total_amount: baseAmount,
          due_date: dueDate,
          status: BillStatus.UNPAID,
        },
      });
      created.push(bill.id);
    }

    // Notify residents
    const residents = await prisma.user.findMany({
      where: { association_id: associationId, role: UserRole.RESIDENT, is_active: true, deleted_at: null },
      select: { id: true },
    });
    await notificationService.dispatch({
      type: 'BILL_GENERATED',
      channels: ['PUSH', 'EMAIL'],
      recipients: residents.map((r) => r.id),
      data: { month: body.month, year: body.year, due_date: dueDate },
    });

    return { data: { created: created.length, skipped: skipped.length } };
  }

  // ── Rollback Bills ───────────────────────────────────────────────────────────
  async rollbackBills(associationId: string, body: RollbackBillsBody) {
    // Find all bills for this period
    const bills = await prisma.bill.findMany({
      where: { association_id: associationId, period_month: body.month, period_year: body.year },
      include: { payments: { select: { id: true } } },
    });

    if (bills.length === 0) {
      throw new UnprocessableError(`No bills found for ${body.month}/${body.year}.`);
    }

    // Block rollback if any bill has payments
    const billsWithPayments = bills.filter((b) => b.payments.length > 0);
    if (billsWithPayments.length > 0) {
      const flats = billsWithPayments
        .map((b) => b.unit_id)
        .join(', ');
      throw new UnprocessableError(
        `Cannot rollback: ${billsWithPayments.length} bill(s) already have payments recorded. ` +
        `Remove payments first or mark them as Waived before rolling back.`
      );
    }

    // Safe to delete — no payments on any bill
    const { count } = await prisma.bill.deleteMany({
      where: { association_id: associationId, period_month: body.month, period_year: body.year },
    });

    return { data: { deleted: count, month: body.month, year: body.year } };
  }

  // ── Bill Listing ─────────────────────────────────────────────────────────────
  async listBills(
    associationId: string,
    query: { cursor?: string; limit: number; unit_id?: string; month?: number; year?: number; status?: string; from_date?: string; to_date?: string },
  ) {
    const where: Record<string, unknown> = { association_id: associationId };
    if (query.unit_id) where['unit_id'] = query.unit_id;
    if (query.month) where['period_month'] = query.month;
    if (query.year) where['period_year'] = query.year;
    if (query.status) {
      const statuses = query.status.split(',').map((s) => s.trim()).filter(Boolean);
      where['status'] = statuses.length === 1 ? statuses[0] : { in: statuses };
    }
    if (query.from_date || query.to_date) {
      where['due_date'] = {
        ...(query.from_date ? { gte: new Date(query.from_date) } : {}),
        ...(query.to_date ? { lte: new Date(query.to_date + 'T23:59:59.999Z') } : {}),
      };
    }
    if (query.cursor) where['id'] = { gt: query.cursor };

    const bills = await prisma.bill.findMany({
      where: where as never,
      take: query.limit,
      include: {
        unit: { select: { flat_number: true, block: true } },
        payments: { select: { id: true, amount: true, payment_mode: true, payment_date: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    return paginatedResponse(bills as (typeof bills[0] & { id: string })[], query.limit);
  }

  async listMyBills(associationId: string, unitId: string, query: { cursor?: string; limit: number }) {
    return this.listBills(associationId, { ...query, unit_id: unitId });
  }

  // ── Online Payment ───────────────────────────────────────────────────────────
  async initiatePayment(associationId: string, userId: string, body: InitiatePaymentBody) {
    const bill = await prisma.bill.findFirst({
      where: { id: body.bill_id, association_id: associationId },
    });
    if (!bill) throw new NotFoundError('Bill');
    if (bill.status === BillStatus.PAID) throw new UnprocessableError('This bill has already been paid.');

    try {
      const order = await razorpay.orders.create({
        amount: Math.round(Number(bill.total_amount) * 100),
        currency: 'INR',
        receipt: `bill_${bill.id}`,
        notes: { bill_id: bill.id, unit_id: bill.unit_id, user_id: userId },
      });

      return {
        data: {
          order_id: order.id,
          amount: bill.total_amount,
          key_id: process.env.RAZORPAY_KEY_ID,
          bill: { id: bill.id, period_month: bill.period_month, period_year: bill.period_year },
        },
      };
    } catch {
      throw new GatewayError('Razorpay');
    }
  }

  // ── Razorpay Webhook ─────────────────────────────────────────────────────────
  async handleWebhook(payload: string, signature: string) {
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(payload)
      .digest('hex');

    if (expectedSig !== signature) throw new UnprocessableError('Invalid webhook signature.');

    const event = JSON.parse(payload);
    if (event.event !== 'payment.captured') return { data: { status: 'ignored' } };

    const payment = event.payload.payment.entity;
    const billId = payment.notes?.bill_id;
    if (!billId) return { data: { status: 'no_bill_id' } };

    // Idempotency: check if gateway_txn_id already processed
    const existing = await prisma.payment.findFirst({ where: { gateway_txn_id: payment.id } });
    if (existing) return { data: { status: 'already_processed' } };

    const bill = await prisma.bill.findUnique({ where: { id: billId } });
    if (!bill) return { data: { status: 'bill_not_found' } };

    const paid = await prisma.payment.create({
      data: {
        association_id: bill.association_id,
        bill_id: billId,
        unit_id: bill.unit_id,
        amount: payment.amount / 100,
        payment_mode: PaymentMode.ONLINE,
        payment_date: new Date(payment.created_at * 1000),
        gateway: 'razorpay',
        gateway_order_id: payment.order_id,
        gateway_txn_id: payment.id,
      },
    });

    await prisma.bill.update({ where: { id: billId }, data: { status: BillStatus.PAID } });

    await notificationService.dispatch({
      type: 'PAYMENT_RECEIVED',
      channels: ['PUSH', 'EMAIL'],
      recipients: [payment.notes?.user_id ?? ''],
      data: { payment_id: paid.id, amount: paid.amount, bill_id: billId },
    });

    return { data: { status: 'processed', payment_id: paid.id } };
  }

  // ── Offline Payment ──────────────────────────────────────────────────────────
  async recordOfflinePayment(associationId: string, body: OfflinePaymentBody, recordedBy: string) {
    const bill = await prisma.bill.findFirst({ where: { id: body.bill_id, association_id: associationId } });
    if (!bill) throw new NotFoundError('Bill');

    const payment = await prisma.payment.create({
      data: {
        association_id: associationId,
        bill_id: body.bill_id,
        unit_id: bill.unit_id,
        amount: body.amount,
        payment_mode: body.mode,
        payment_date: new Date(body.payment_date),
        reference_no: body.reference_no,
        recorded_by: recordedBy,
        gateway: 'manual',
      },
    });

    const totalPaid = await prisma.payment.aggregate({
      where: { bill_id: body.bill_id },
      _sum: { amount: true },
    });

    const totalAmount = Number(totalPaid._sum.amount ?? 0);
    const billTotal = Number(bill.total_amount);
    const newStatus = totalAmount >= billTotal ? BillStatus.PAID : BillStatus.PARTIAL;
    await prisma.bill.update({ where: { id: body.bill_id }, data: { status: newStatus } });

    return { data: payment };
  }

  // ── Arrears ──────────────────────────────────────────────────────────────────
  async getArrears(associationId: string) {
    const arrears = await prisma.$queryRaw<
      { unit_id: string; flat_number: string; outstanding: number; ageing_days: number; penalty: number }[]
    >`
      SELECT
        b.unit_id,
        u.flat_number,
        SUM(b.total_amount) - COALESCE(SUM(p.amount), 0) AS outstanding,
        MAX(EXTRACT(DAY FROM NOW() - b.due_date)) AS ageing_days,
        SUM(b.penalty) AS penalty
      FROM bills b
      JOIN units u ON u.id = b.unit_id
      LEFT JOIN payments p ON p.bill_id = b.id
      WHERE b.association_id = ${associationId}::uuid
        AND b.status IN ('UNPAID', 'PARTIAL')
      GROUP BY b.unit_id, u.flat_number
      ORDER BY outstanding DESC
    `;

    return { data: arrears };
  }

  // ── Special Levy ─────────────────────────────────────────────────────────────
  async createLevy(associationId: string, body: CreateLevyBody) {
    const bills = await Promise.all(
      body.unit_ids.map((unitId) =>
        prisma.bill.create({
          data: {
            association_id: associationId,
            unit_id: unitId,
            period_month: new Date().getMonth() + 1,
            period_year: new Date().getFullYear(),
            base_amount: 0,
            levy_amount: body.amount,
            total_amount: body.amount,
            due_date: new Date(body.due_date),
            status: BillStatus.UNPAID,
          },
        }),
      ),
    );

    return { data: { created: bills.length } };
  }

  // ── Dashboard ────────────────────────────────────────────────────────────────
  async getDashboard(associationId: string) {
    const [totalOutstanding, monthlyCollected, arrearsCount, duesConfig, ytdTrend] = await Promise.all([
      prisma.bill.aggregate({
        where: { association_id: associationId, status: { in: [BillStatus.UNPAID, BillStatus.PARTIAL] } },
        _sum: { total_amount: true },
      }),
      prisma.payment.aggregate({
        where: {
          association_id: associationId,
          payment_date: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
        _sum: { amount: true },
      }),
      prisma.bill.findMany({
        where: { association_id: associationId, status: { in: [BillStatus.UNPAID, BillStatus.PARTIAL] }, due_date: { lt: new Date() } },
        select: { unit_id: true },
        distinct: ['unit_id'],
      }),
      prisma.duesConfig.findUnique({
        where: { association_id: associationId },
        select: { cash_balance: true, cash_balance_as_on: true },
      }),
      prisma.$queryRaw<{ month: number; year: number; collected: number }[]>`
        SELECT
          EXTRACT(MONTH FROM payment_date) AS month,
          EXTRACT(YEAR FROM payment_date) AS year,
          SUM(amount) AS collected
        FROM payments
        WHERE association_id = ${associationId}::uuid
          AND payment_date > NOW() - INTERVAL '12 months'
        GROUP BY month, year
        ORDER BY year, month
      `,
    ]);

    return {
      data: {
        total_outstanding: totalOutstanding._sum.total_amount ?? 0,
        monthly_collected: monthlyCollected._sum.amount ?? 0,
        arrears_count: arrearsCount.length,
        cash_balance: duesConfig?.cash_balance ?? null,
        cash_balance_as_on: duesConfig?.cash_balance_as_on ?? null,
        ytd_trend: ytdTrend,
      },
    };
  }

  // ── One-Time Dues ────────────────────────────────────────────────────────────
  async createOneTimeDue(associationId: string, body: OneTimeDueBody, createdBy: string) {
    const due = await prisma.oneTimeDue.create({
      data: {
        association_id: associationId,
        title:          body.title,
        description:    body.description,
        charge_type:    body.charge_type ?? 'FIXED',
        amount:         body.amount,
        due_date:       new Date(body.due_date),
        created_by:     createdBy,
      },
    });
    return { data: due };
  }

  async listOneTimeDues(associationId: string) {
    const dues = await prisma.oneTimeDue.findMany({
      where: { association_id: associationId },
      orderBy: { created_at: 'desc' },
    });
    return { data: dues };
  }

  async getOneTimeDue(associationId: string, id: string) {
    const due = await prisma.oneTimeDue.findFirst({ where: { id, association_id: associationId } });
    if (!due) throw new NotFoundError('One-time due');
    return { data: due };
  }

  async updateOneTimeDue(associationId: string, id: string, body: UpdateOneTimeDueBody) {
    const due = await prisma.oneTimeDue.findFirst({ where: { id, association_id: associationId } });
    if (!due) throw new NotFoundError('One-time due');
    if (due.status !== OneTimeDueStatus.DRAFT) {
      throw new UnprocessableError('Only DRAFT one-time dues can be edited.');
    }
    const updated = await prisma.oneTimeDue.update({
      where: { id },
      data: {
        title:       body.title,
        description: body.description,
        charge_type: body.charge_type,
        amount:      body.amount,
        due_date:    body.due_date ? new Date(body.due_date) : undefined,
      },
    });
    return { data: updated };
  }

  async deleteOneTimeDue(associationId: string, id: string) {
    const due = await prisma.oneTimeDue.findFirst({ where: { id, association_id: associationId } });
    if (!due) throw new NotFoundError('One-time due');
    if (due.status === OneTimeDueStatus.BILLS_GENERATED) {
      throw new UnprocessableError('Cannot delete a one-time due that already has bills generated. Close it instead.');
    }
    await prisma.oneTimeDue.delete({ where: { id } });
    return { data: null };
  }

  async generateOneTimeDueBills(associationId: string, id: string, body: GenerateOneTimeDueBillsBody) {
    const due = await prisma.oneTimeDue.findFirst({ where: { id, association_id: associationId } });
    if (!due) throw new NotFoundError('One-time due');
    if (due.status !== OneTimeDueStatus.DRAFT) {
      throw new UnprocessableError('Bills have already been generated for this one-time due.');
    }

    const units = body.unit_ids
      ? await prisma.unit.findMany({ where: { id: { in: body.unit_ids }, association_id: associationId } })
      : await prisma.unit.findMany({ where: { association_id: associationId } });

    const dueDate = due.due_date;
    const periodMonth = dueDate.getMonth() + 1;
    const periodYear = dueDate.getFullYear();
    const created: string[] = [];
    const skipped: string[] = [];

    for (const unit of units) {
      // Check uniqueness: (unit_id, one_time_due_id)
      const existing = await prisma.bill.findFirst({
        where: { unit_id: unit.id, one_time_due_id: id },
      });
      if (existing) { skipped.push(unit.flat_number); continue; }

      let amount: number;
      if (due.charge_type === 'RATE_PER_SQFT') {
        const sqft = Number(unit.area_sqft ?? 0);
        if (!sqft) { skipped.push(unit.flat_number); continue; }
        amount = Number(due.amount) * sqft;
      } else {
        amount = Number(due.amount);
      }

      const bill = await prisma.bill.create({
        data: {
          association_id:  associationId,
          unit_id:         unit.id,
          period_month:    periodMonth,
          period_year:     periodYear,
          base_amount:     amount,
          penalty:         0,
          levy_amount:     0,
          total_amount:    amount,
          due_date:        dueDate,
          status:          BillStatus.UNPAID,
          one_time_due_id: id,
          bill_label:      due.title,
        },
      });
      created.push(bill.id);
    }

    // Mark due as BILLS_GENERATED
    await prisma.oneTimeDue.update({
      where: { id },
      data: { status: OneTimeDueStatus.BILLS_GENERATED, bills_count: created.length },
    });

    return { data: { created: created.length, skipped: skipped.length } };
  }

  async closeOneTimeDue(associationId: string, id: string) {
    const due = await prisma.oneTimeDue.findFirst({ where: { id, association_id: associationId } });
    if (!due) throw new NotFoundError('One-time due');
    const updated = await prisma.oneTimeDue.update({
      where: { id },
      data: { status: OneTimeDueStatus.CLOSED },
    });
    return { data: updated };
  }
}

export const duesService = new DuesService();

