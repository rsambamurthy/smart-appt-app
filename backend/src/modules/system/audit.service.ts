import prisma from '../../config/database';
import { AuditAction, Prisma, UserRole } from '@prisma/client';

export interface AuditQuery {
  cursor?: string;
  limit: number;
  entity_type?: string;
  action?: string;
  performed_by?: string;
  entity_id?: string;
  date_from?: string;
  date_to?: string;
  /** Free-text match against the summary line. */
  search?: string;
}

export class AuditReadService {
  /**
   * List audit entries for one association.
   * SUPER_USER may pass associationId = null to read across all associations.
   */
  async list(associationId: string | null, role: string, query: AuditQuery) {
    const where: Prisma.AuditLogWhereInput = {};

    // Tenant isolation: only SUPER_USER may look beyond their own association.
    if (role !== UserRole.SUPER_USER) {
      where.association_id = associationId;
    } else if (associationId) {
      where.association_id = associationId;
    }

    if (query.entity_type)  where.entity_type  = query.entity_type;
    if (query.entity_id)    where.entity_id    = query.entity_id;
    if (query.performed_by) where.performed_by = query.performed_by;
    if (query.action)       where.action       = query.action as AuditAction;

    if (query.date_from || query.date_to) {
      where.created_at = {
        ...(query.date_from ? { gte: new Date(query.date_from) } : {}),
        // Include the whole end day.
        ...(query.date_to   ? { lte: new Date(query.date_to + 'T23:59:59.999Z') } : {}),
      };
    }

    if (query.search) {
      where.OR = [
        { summary:     { contains: query.search, mode: 'insensitive' } },
        { actor_label: { contains: query.search, mode: 'insensitive' } },
        { entity_type: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const take = Math.min(query.limit ?? 50, 200);

    const rows = await prisma.auditLog.findMany({
      where,
      take,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy: { created_at: 'desc' },
      include: {
        performer:   { select: { id: true, name: true, phone: true, role: true } },
        association: { select: { id: true, name: true } },
      },
    });

    return {
      data: rows,
      meta: {
        next_cursor: rows.length === take ? rows[rows.length - 1]!.id : null,
        count: rows.length,
      },
    };
  }

  /** Distinct entity types present, for populating the filter dropdown. */
  async facets(associationId: string | null, role: string) {
    const where: Prisma.AuditLogWhereInput =
      role === UserRole.SUPER_USER && !associationId ? {} : { association_id: associationId };

    const types = await prisma.auditLog.findMany({
      where,
      select: { entity_type: true },
      distinct: ['entity_type'],
      orderBy: { entity_type: 'asc' },
    });

    return {
      data: {
        entity_types: types.map(t => t.entity_type),
        actions: Object.values(AuditAction),
      },
    };
  }
}

export const auditReadService = new AuditReadService();
