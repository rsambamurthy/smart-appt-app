import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { paginatedResponse } from '../../utils/helpers';
import { notificationService } from '../../services/notification.service';

export class AnnouncementsService {
  async post(associationId: string, body: {
    title: string; body: string; category: string; is_urgent?: boolean; expires_at?: string;
  }, postedBy: string, attachmentKeys: string[]) {
    const ann = await prisma.announcement.create({
      data: {
        association_id: associationId,
        title: body.title,
        body: body.body,
        category: body.category as never,
        is_urgent: body.is_urgent ?? false,
        posted_by: postedBy,
        published_at: new Date(),
        expires_at: body.expires_at ? new Date(body.expires_at) : null,
        attachment_keys: attachmentKeys,
      },
    });

    const residents = await prisma.user.findMany({
      where: { association_id: associationId, is_active: true, deleted_at: null },
      select: { id: true },
    });

    await notificationService.dispatch({
      type: ann.is_urgent ? 'URGENT_ANNOUNCEMENT' : 'ANNOUNCEMENT_POSTED',
      channels: ann.is_urgent ? ['PUSH', 'SMS', 'EMAIL'] : ['PUSH', 'EMAIL'],
      recipients: residents.map((r) => r.id),
      data: { announcement_id: ann.id, title: body.title },
    });

    return { data: ann };
  }

  async list(associationId: string, query: { cursor?: string; limit: number; category?: string; date_from?: string; date_to?: string }) {
    const where: Record<string, unknown> = { association_id: associationId, published_at: { not: null } };
    if (query.category) where['category'] = query.category;
    if (query.date_from || query.date_to) {
      where['published_at'] = {};
      if (query.date_from) (where['published_at'] as Record<string, unknown>)['gte'] = new Date(query.date_from);
      if (query.date_to) (where['published_at'] as Record<string, unknown>)['lte'] = new Date(query.date_to);
    }
    if (query.cursor) where['id'] = { gt: query.cursor };

    const items = await prisma.announcement.findMany({
      where: where as never,
      take: query.limit,
      include: { poster: { select: { name: true, role: true } } },
      orderBy: { published_at: 'desc' },
    });
    return paginatedResponse(items as (typeof items[0] & { id: string })[], query.limit);
  }

  async getOne(associationId: string, id: string) {
    const ann = await prisma.announcement.findFirst({ where: { id, association_id: associationId } });
    if (!ann) throw new NotFoundError('Announcement');
    return { data: ann };
  }

  async markRead(associationId: string, announcementId: string, userId: string) {
    await prisma.announcementRead.upsert({
      where: { announcement_id_user_id: { announcement_id: announcementId, user_id: userId } },
      create: { association_id: associationId, announcement_id: announcementId, user_id: userId, read_at: new Date() },
      update: {},
    });
    return { data: { message: 'Marked as read' } };
  }

  async getReadReceipts(associationId: string, announcementId: string) {
    const reads = await prisma.announcementRead.findMany({
      where: { announcement_id: announcementId, association_id: associationId },
      include: { user: { select: { name: true, phone: true } } },
      orderBy: { read_at: 'desc' },
    });
    return { data: { count: reads.length, reads } };
  }

  // Polls
  async createPoll(associationId: string, body: { question: string; poll_type: string; options?: string[]; closes_at: string }, createdBy: string) {
    const poll = await prisma.poll.create({
      data: {
        association_id: associationId,
        question: body.question,
        poll_type: body.poll_type as never,
        options: body.options ? body.options : Prisma.JsonNull,
        closes_at: new Date(body.closes_at),
        created_by: createdBy,
      },
    });
    return { data: poll };
  }

  async vote(associationId: string, pollId: string, userId: string, answer: string) {
    const poll = await prisma.poll.findFirst({ where: { id: pollId, association_id: associationId } });
    if (!poll) throw new NotFoundError('Poll');
    if (poll.closes_at < new Date()) throw new NotFoundError('Poll is closed');

    await prisma.pollVote.upsert({
      where: { poll_id_user_id: { poll_id: pollId, user_id: userId } },
      create: { association_id: associationId, poll_id: pollId, user_id: userId, answer, voted_at: new Date() },
      update: { answer, voted_at: new Date() },
    });
    return { data: { message: 'Vote recorded' } };
  }

  async getPollResults(associationId: string, pollId: string) {
    const poll = await prisma.poll.findFirst({ where: { id: pollId, association_id: associationId } });
    if (!poll) throw new NotFoundError('Poll');
    if (poll.closes_at > new Date()) return { data: { message: 'Results available after poll closes' } };

    const votes = await prisma.pollVote.groupBy({
      by: ['answer'],
      where: { poll_id: pollId },
      _count: { id: true },
    });
    return { data: { poll, results: votes } };
  }

  // Documents
  async uploadDocument(
    associationId: string,
    body: { title: string; category: string; version?: number },
    fileInfo: { buffer: Buffer; originalname: string; mimetype: string } | null,
    uploadedBy: string,
  ) {
    const doc = await prisma.document.create({
      data: {
        association_id: associationId,
        title: body.title,
        category: body.category as never,
        s3_key: fileInfo?.originalname ?? '',
        file_data: fileInfo?.buffer ?? null,
        mime_type: fileInfo?.mimetype ?? null,
        file_name: fileInfo?.originalname ?? null,
        version: body.version ?? 1,
        uploaded_by: uploadedBy,
      },
    });
    // Return doc without the binary blob
    const { file_data: _, ...rest } = doc as typeof doc & { file_data: unknown };
    return { data: rest };
  }

  async listDocuments(associationId: string, category?: string) {
    const docs = await prisma.document.findMany({
      where: { association_id: associationId, deleted_at: null, ...(category ? { category: category as never } : {}) },
      select: {
        id: true, title: true, category: true, version: true,
        file_name: true, mime_type: true, created_at: true, deleted_at: true,
        uploader: { select: { name: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    return { data: docs };
  }

  async getDocumentFile(associationId: string, docId: string) {
    const doc = await prisma.document.findFirst({
      where: { id: docId, association_id: associationId, deleted_at: null },
      select: { file_data: true, mime_type: true, file_name: true, title: true },
    });
    if (!doc) throw new NotFoundError('Document');
    return doc;
  }

  async deactivateDocument(associationId: string, docId: string) {
    const doc = await prisma.document.findFirst({ where: { id: docId, association_id: associationId, deleted_at: null } });
    if (!doc) throw new NotFoundError('Document');
    await prisma.document.update({ where: { id: docId }, data: { deleted_at: new Date() } });
    return { data: { message: 'Document deactivated' } };
  }
}

export const announcementsService = new AnnouncementsService();
