import prisma from '../../config/database';
import { normalisePhone } from '../../utils/helpers';
import { ConflictError, NotFoundError, UnprocessableError } from '../../utils/errors';
import { RegisterAssociationBody, UpdateAssociationBody } from './associations.schema';
import { UserRole } from '@prisma/client';

export class AssociationsService {
  // ── Public: register new association + first admin ───────────────────────────
  async register(body: RegisterAssociationBody) {
    const phone = normalisePhone(body.admin_phone);

    // Check phone not already in use
    const existing = await prisma.user.findFirst({ where: { phone, deleted_at: null } });
    if (existing) throw new ConflictError('A user with this phone number already exists.');

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create association
      const association = await tx.association.create({
        data: {
          name:    body.name,
          address: body.address,
          city:    body.city,
          state:   body.state,
          pincode: body.pincode,
        },
      });

      // 2. Create default config
      await tx.associationConfig.create({
        data: {
          association_id:   association.id,
          association_name: body.name,
        },
      });

      // 3. Create first admin (MANAGER)
      const admin = await tx.user.create({
        data: {
          association_id: association.id,
          name:           body.admin_name,
          phone,
          role:           UserRole.MANAGER,
          is_active:      true,
        },
      });

      return { association, admin };
    });

    return {
      association_id:   result.association.id,
      association_name: result.association.name,
      admin_phone:      result.admin.phone,
      admin_name:       result.admin.name,
    };
  }

  // ── SUPER_USER: list all associations (excludes SUPER_USER system placeholder) ─
  async list() {
    const associations = await prisma.association.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        _count: { select: { users: true, units: true } },
      },
      where: {
        // Exclude associations that only contain SUPER_USER accounts (system placeholder)
        users: {
          none: { role: 'SUPER_USER' },
        },
      },
    });
    return associations;
  }

  // ── SUPER_USER: get one ───────────────────────────────────────────────────────
  async getOne(id: string) {
    const association = await prisma.association.findUnique({
      where: { id },
      include: {
        config: true,
        _count: { select: { users: true, units: true } },
      },
    });
    if (!association) throw new NotFoundError('Association');
    return association;
  }

  // ── SUPER_USER: update ────────────────────────────────────────────────────────
  async update(id: string, body: UpdateAssociationBody) {
    const association = await prisma.association.findUnique({ where: { id } });
    if (!association) throw new NotFoundError('Association');

    const updated = await prisma.association.update({
      where: { id },
      data: {
        name:      body.name,
        address:   body.address,
        city:      body.city,
        state:     body.state,
        pincode:   body.pincode,
        is_active: body.is_active,
      },
    });

    // Keep config name in sync if name changed
    if (body.name) {
      await prisma.associationConfig.updateMany({
        where: { association_id: id },
        data: { association_name: body.name },
      });
    }

    return updated;
  }

  // ── SUPER_USER: soft-delete (deactivate) ─────────────────────────────────────
  async remove(id: string) {
    const association = await prisma.association.findUnique({ where: { id } });
    if (!association) throw new NotFoundError('Association');

    await prisma.association.update({
      where: { id },
      data: { is_active: false },
    });
  }

  // ── SUPER_USER: hard-delete (permanently removes all data) ───────────────────
  async hardDelete(id: string) {
    const association = await prisma.association.findUnique({
      where: { id },
      include: { _count: { select: { units: true } } },
    });
    if (!association) throw new NotFoundError('Association');

    if (association.is_active) {
      throw new UnprocessableError('Association must be deactivated before it can be permanently deleted.');
    }
    if (association._count.units > 0) {
      throw new UnprocessableError(
        `Cannot delete: association still has ${association._count.units} unit(s). Remove all units first.`,
      );
    }

    await prisma.$transaction(async (tx) => {
      const a = id;

      // 1. Leaf-level: payments, poll votes, announcement reads
      await tx.payment.deleteMany({ where: { association_id: a } });
      await tx.pollVote.deleteMany({ where: { association_id: a } });
      await tx.announcementRead.deleteMany({ where: { association_id: a } });

      // 2. Bills (refs dues_config, one_time_due, unit)
      await tx.bill.deleteMany({ where: { association_id: a } });

      // 3. Ticket sub-records
      await tx.ticketAttachment.deleteMany({ where: { association_id: a } });
      await tx.ticketStatusLog.deleteMany({ where: { association_id: a } });
      await tx.maintenanceTicket.deleteMany({ where: { association_id: a } });

      // 4. Visitor / frequent visitor
      await tx.visitor.deleteMany({ where: { association_id: a } });
      await tx.frequentVisitor.deleteMany({ where: { association_id: a } });

      // 5. Announcements, documents, polls
      await tx.announcement.deleteMany({ where: { association_id: a } });
      await tx.document.deleteMany({ where: { association_id: a } });
      await tx.poll.deleteMany({ where: { association_id: a } });

      // 6. Expenses + related
      // expense refs recurringExpense (recurring_id FK) and vendor (vendor_id FK) — delete first
      await tx.expense.deleteMany({ where: { association_id: a } });
      await tx.expenseBudget.deleteMany({ where: { association_id: a } });
      // recurringExpense refs vendor — delete before vendor
      await tx.recurringExpense.deleteMany({ where: { association_id: a } });
      await tx.vendor.deleteMany({ where: { association_id: a } });
      await tx.expenseCategoryConfig.deleteMany({ where: { association_id: a } });

      // 7. Dues
      await tx.oneTimeDue.deleteMany({ where: { association_id: a } });
      await tx.duesConfig.deleteMany({ where: { association_id: a } });

      // 8. Auth / audit (refs users)
      await tx.userInvite.deleteMany({ where: { association_id: a } });
      await tx.auditLog.deleteMany({ where: { association_id: a } });
      await tx.refreshToken.deleteMany({ where: { association_id: a } });

      // 9. Users
      await tx.user.deleteMany({ where: { association_id: a } });

      // 10. Units
      await tx.unit.deleteMany({ where: { association_id: a } });

      // 11. Config + association
      await tx.associationConfig.deleteMany({ where: { association_id: a } });
      await tx.association.delete({ where: { id: a } });
    });
  }
}

export const associationsService = new AssociationsService();
