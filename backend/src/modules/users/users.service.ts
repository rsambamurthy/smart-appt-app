import prisma from '../../config/database';
import { ConflictError, NotFoundError } from '../../utils/errors';
import { normalisePhone, generateToken, paginatedResponse } from '../../utils/helpers';
import { smsService } from '../../services/sms.service';
import {
  CreateUserBody, UpdateUserBody, CreateUnitBody, InviteUserBody,
} from './users.schema';

export class UsersService {
  // ── Units ────────────────────────────────────────────────────────────────────
  async listUnits(associationId: string) {
    const units = await prisma.unit.findMany({
      where: { association_id: associationId },
      include: {
        users: {
          where: { deleted_at: null, is_active: true },
          select: { id: true, name: true, phone: true, role: true, is_owner: true },
        },
      },
      orderBy: [{ block: 'asc' }, { flat_number: 'asc' }],
    });
    return { data: units };
  }

  async createUnit(associationId: string, body: CreateUnitBody) {
    const existing = await prisma.unit.findFirst({
      where: { association_id: associationId, flat_number: body.flat_number },
    });
    if (existing) throw new ConflictError(`Unit ${body.flat_number} already exists.`);

    const unit = await prisma.unit.create({
      data: { association_id: associationId, ...body },
    });
    return { data: unit };
  }

  async updateUnit(associationId: string, unitId: string, body: Partial<CreateUnitBody>) {
    const unit = await prisma.unit.findFirst({ where: { id: unitId, association_id: associationId } });
    if (!unit) throw new NotFoundError('Unit');
    const updated = await prisma.unit.update({ where: { id: unitId }, data: body });
    return { data: updated };
  }

  async deleteUnit(associationId: string, unitId: string) {
    const unit = await prisma.unit.findFirst({ where: { id: unitId, association_id: associationId } });
    if (!unit) throw new NotFoundError('Unit');
    await prisma.unit.delete({ where: { id: unitId } });
    return { data: { message: 'Unit deleted' } };
  }

  // ── Users ────────────────────────────────────────────────────────────────────
  async listUsers(
    associationId: string,
    query: { cursor?: string; limit: number; role?: string; unit_id?: string; is_active?: boolean; search?: string },
  ) {
    const where: Record<string, unknown> = { association_id: associationId, deleted_at: null };
    if (query.role) where['role'] = query.role;
    if (query.unit_id) where['unit_id'] = query.unit_id;
    if (typeof query.is_active === 'boolean') where['is_active'] = query.is_active;
    if (query.search) {
      where['OR'] = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.cursor) where['id'] = { gt: query.cursor };

    const users = await prisma.user.findMany({
      where: where as never,
      take: query.limit,
      select: {
        id: true, name: true, phone: true, email: true, role: true,
        unit_id: true, is_owner: true, is_active: true, created_at: true,
        unit: { select: { flat_number: true, block: true } },
      },
      orderBy: { created_at: 'asc' },
    });
    return paginatedResponse(users as (typeof users[0] & { id: string })[], query.limit);
  }

  async getUser(associationId: string, userId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, association_id: associationId, deleted_at: null },
      include: { unit: true },
    });
    if (!user) throw new NotFoundError('User');
    return { data: user };
  }

  async createUser(associationId: string, body: CreateUserBody, performedBy: string) {
    const phone = normalisePhone(body.phone);
    const existing = await prisma.user.findFirst({ where: { association_id: associationId, phone } });
    if (existing) throw new ConflictError('A user with this phone number already exists in the association.');

    const user = await prisma.user.create({
      data: { association_id: associationId, ...body, phone },
    });

    await prisma.auditLog.create({
      data: {
        association_id: associationId,
        entity_type: 'user',
        entity_id: user.id,
        action: 'CREATE',
        performed_by: performedBy,
        new_value: body as never,
      },
    });

    return { data: user };
  }

  async updateUser(associationId: string, userId: string, body: UpdateUserBody, performedBy: string) {
    const user = await prisma.user.findFirst({ where: { id: userId, association_id: associationId, deleted_at: null } });
    if (!user) throw new NotFoundError('User');

    const updated = await prisma.user.update({ where: { id: userId }, data: body });

    await prisma.auditLog.create({
      data: {
        association_id: associationId,
        entity_type: 'user',
        entity_id: userId,
        action: 'UPDATE',
        performed_by: performedBy,
        old_value: user as never,
        new_value: body as never,
      },
    });

    return { data: updated };
  }

  async deactivateUser(associationId: string, userId: string, performedBy: string) {
    const user = await prisma.user.findFirst({ where: { id: userId, association_id: associationId, deleted_at: null } });
    if (!user) throw new NotFoundError('User');

    // Deactivate only — do NOT set deleted_at (that is permanent deletion).
    // Deactivated users remain visible in the list with is_active: false and can be reactivated.
    await prisma.user.update({ where: { id: userId }, data: { is_active: false } });

    await prisma.auditLog.create({
      data: {
        association_id: associationId,
        entity_type: 'user',
        entity_id: userId,
        action: 'DELETE',
        performed_by: performedBy,
      },
    });

    return { data: { message: 'User deactivated' } };
  }

  // ── Invitations ──────────────────────────────────────────────────────────────
  async inviteUser(associationId: string, body: InviteUserBody, invitedBy: string) {
    const phone = normalisePhone(body.phone);
    const config = await prisma.associationConfig.findUnique({ where: { association_id: associationId } });
    const expiryHours = config?.invite_expiry_hours ?? 48;

    // Check if already a member
    const existing = await prisma.user.findFirst({ where: { association_id: associationId, phone } });
    if (existing) throw new ConflictError('User with this phone is already a member.');

    const token = generateToken(32);
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

    const invite = await prisma.userInvite.create({
      data: {
        association_id: associationId,
        phone,
        email: body.email,
        name: body.name,
        role: body.role,
        unit_id: body.unit_id,
        token,
        expires_at: expiresAt,
        invited_by: invitedBy,
      },
    });

    const inviteLink = `${process.env.FRONTEND_URL}/join?token=${token}`;
    await smsService.sendInvite(phone, inviteLink, body.name);

    return { data: { invite_id: invite.id, expires_at: expiresAt } };
  }

  async bulkImport(associationId: string, records: CreateUserBody[], performedBy: string) {
    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (const record of records) {
      try {
        await this.createUser(associationId, record, performedBy);
        results.created++;
      } catch (err) {
        results.skipped++;
        results.errors.push(`${record.phone}: ${(err as Error).message}`);
      }
    }

    return { data: results };
  }

  async bulkImportUnits(associationId: string, records: CreateUnitBody[]) {
    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (const record of records) {
      try {
        await this.createUnit(associationId, record);
        results.created++;
      } catch (err) {
        results.skipped++;
        results.errors.push(`${record.flat_number}: ${(err as Error).message}`);
      }
    }

    return { data: results };
  }
}

export const usersService = new UsersService();
