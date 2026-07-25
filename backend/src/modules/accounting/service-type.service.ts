import prisma from '../../config/database';
import { ConflictError, NotFoundError } from '../../utils/errors';

export interface CreateServiceTypeBody {
  name:        string;
  description?: string | null;
}

class ServiceTypeService {

  // ── List all service types for an association ──────────────────────────────
  async list(associationId: string) {
    const rows = await prisma.serviceType.findMany({
      where: { association_id: associationId },
      orderBy: { name: 'asc' },
    });
    return { data: rows };
  }

  // ── Create ──────────────────────────────────────────────────────────────────
  async create(associationId: string, body: CreateServiceTypeBody) {
    const existing = await prisma.serviceType.findUnique({
      where: { association_id_name: { association_id: associationId, name: body.name.trim() } },
    });
    if (existing) throw new ConflictError(`Service type "${body.name}" already exists.`);

    const row = await prisma.serviceType.create({
      data: {
        association_id: associationId,
        name:           body.name.trim(),
        description:    body.description?.trim() || null,
      },
    });
    return { data: row };
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  async update(associationId: string, id: string, body: Partial<CreateServiceTypeBody>) {
    const row = await prisma.serviceType.findFirst({ where: { id, association_id: associationId } });
    if (!row) throw new NotFoundError('Service type not found.');

    if (body.name && body.name.trim() !== row.name) {
      const clash = await prisma.serviceType.findUnique({
        where: { association_id_name: { association_id: associationId, name: body.name.trim() } },
      });
      if (clash) throw new ConflictError(`Service type "${body.name}" already exists.`);
    }

    const updated = await prisma.serviceType.update({
      where: { id },
      data: {
        ...(body.name        !== undefined ? { name:        body.name.trim() }              : {}),
        ...(body.description !== undefined ? { description: body.description?.trim() || null } : {}),
      },
    });
    return { data: updated };
  }

  // ── Toggle active ───────────────────────────────────────────────────────────
  async toggle(associationId: string, id: string) {
    const row = await prisma.serviceType.findFirst({ where: { id, association_id: associationId } });
    if (!row) throw new NotFoundError('Service type not found.');
    const updated = await prisma.serviceType.update({
      where: { id },
      data: { is_active: !row.is_active },
    });
    return { data: updated };
  }

  // ── Delete (only if no vendors assigned) ───────────────────────────────────
  async delete(associationId: string, id: string) {
    const row = await prisma.serviceType.findFirst({ where: { id, association_id: associationId } });
    if (!row) throw new NotFoundError('Service type not found.');

    const inUse = await prisma.businessPartner.count({ where: { service_type_id: id } });
    if (inUse > 0) throw new ConflictError(`Cannot delete — ${inUse} vendor(s) use this service type.`);

    await prisma.serviceType.delete({ where: { id } });
    return { data: { deleted: true } };
  }
}

export const serviceTypeService = new ServiceTypeService();
