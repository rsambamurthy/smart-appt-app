import prisma from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { paginatedResponse } from '../../utils/helpers';
import { CreateReceiptBody } from './receipts.schema';

export class ReceiptsService {
  async list(associationId: string, query: { cursor?: string; limit?: number }) {
    const take = query.limit ?? 50;
    const receipts = await prisma.otherReceipt.findMany({
      where: { association_id: associationId, deleted_at: null },
      orderBy: { receipt_date: 'desc' },
      take,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
    });
    return paginatedResponse(receipts, take);
  }

  async create(associationId: string, body: CreateReceiptBody, recordedBy: string) {
    const receipt = await prisma.otherReceipt.create({
      data: {
        association_id: associationId,
        receipt_date:   new Date(body.receipt_date),
        amount:         body.amount,
        category:       body.category,
        description:    body.description,
        received_from:  body.received_from,
        payment_mode:   body.payment_mode,
        recorded_by:    recordedBy,
      },
    });
    return { data: receipt };
  }

  async remove(associationId: string, id: string) {
    const receipt = await prisma.otherReceipt.findFirst({ where: { id, association_id: associationId, deleted_at: null } });
    if (!receipt) throw new NotFoundError('Receipt');
    await prisma.otherReceipt.delete({ where: { id } });
    return { data: null };
  }
}

export const receiptsService = new ReceiptsService();
