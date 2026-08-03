import prisma from '../../config/database';
import { MembershipStatus, AuditAction, Prisma } from '@prisma/client';
import { NotFoundError, UnprocessableError } from '../../utils/errors';
import { auditService } from '../../services/audit.service';

/**
 * The register of members.
 *
 * A MEMBER IS NOT A USER. A user is a login; a member is the person holding
 * membership rights in respect of a flat. Holders are stored by name, with an
 * optional link to an account — a joint holder who never opens the app is
 * still on the register, and a tenant with a login holds no membership.
 *
 * The register is the authority on WHO CASTS a flat's vote. It does not change
 * how many votes a flat has: still one, still recorded against the unit.
 */

const holderSelect = {
  id: true, name: true, phone: true, email: true, user_id: true, is_primary: true,
};

const membershipSelect = {
  id: true, member_no: true, admitted_on: true, ceased_on: true,
  cessation_reason: true, status: true, share_percent: true,
  deed_reference: true, notes: true, preceded_by_id: true,
  holders:  { select: holderSelect, orderBy: { is_primary: 'desc' as const } },
  nominees: { select: { id: true, name: true, relationship: true, share_percent: true, recorded_on: true } },
};

export interface HolderInput {
  name: string; phone?: string; email?: string; user_id?: string | null;
}

export class MembershipService {

  /** Every flat, with its current membership or an explicit gap. */
  async list(associationId: string, opts: { q?: string; gapsOnly?: boolean } = {}) {
    const units = await prisma.unit.findMany({
      where:   { association_id: associationId, deleted_at: null },
      select: {
        id: true, flat_number: true, block: true,
        memberships: {
          where:  { status: MembershipStatus.ACTIVE },
          select: { member_no: true, admitted_on: true, holders: { select: holderSelect } },
          take:   1,
        },
      },
      orderBy: [{ block: 'asc' }, { flat_number: 'asc' }],
    });

    const q = opts.q?.trim().toLowerCase();

    const rows = units.map(u => {
      const m = u.memberships[0] ?? null;
      const primary = m?.holders.find(h => h.is_primary) ?? m?.holders[0] ?? null;
      return {
        unit_id:     u.id,
        flat_number: u.flat_number,
        block:       u.block,
        member_no:   m?.member_no ?? null,
        admitted_on: m?.admitted_on ?? null,
        member_name: primary?.name ?? null,
        // The member's account, when they have one. Needed wherever the
        // register decides who may act — standing for election, for instance.
        member_user_id: primary?.user_id ?? null,
        joint_count: m ? Math.max(m.holders.length - 1, 0) : 0,
        // A flat with nobody recorded cannot vote. It still counts toward
        // quorum, so a gap makes quorum harder to reach rather than easier —
        // which is the safe direction for an incomplete register.
        has_member:  !!m,
      };
    });

    return {
      data: rows.filter(r => {
        if (opts.gapsOnly && r.has_member) return false;
        if (!q) return true;
        return r.flat_number.toLowerCase().includes(q)
            || (r.block ?? '').toLowerCase().includes(q)
            || (r.member_name ?? '').toLowerCase().includes(q);
      }),
      gaps: rows.filter(r => !r.has_member).length,
      total: rows.length,
    };
  }

  /** One flat: its current membership and everyone who held it before. */
  async getForUnit(associationId: string, unitId: string) {
    const unit = await prisma.unit.findFirst({
      where:  { id: unitId, association_id: associationId, deleted_at: null },
      select: { id: true, flat_number: true, block: true, area_sqft: true },
    });
    if (!unit) throw new NotFoundError('Unit');

    const memberships = await prisma.membership.findMany({
      where:   { unit_id: unitId },
      select:  membershipSelect,
      // Newest first: the current member is what you came to see.
      orderBy: { admitted_on: 'desc' },
    });

    const current = memberships.find(m => m.status === MembershipStatus.ACTIVE) ?? null;

    return {
      data: {
        unit,
        current,
        history: memberships.filter(m => m.status !== MembershipStatus.ACTIVE),
      },
    };
  }

  /**
   * Who may cast this flat's vote.
   *
   * The primary holder's linked account, or null. Null means either no
   * membership is recorded or the member has no app account — in both cases
   * nobody can vote in-app for that flat, and they vote in person instead.
   */
  async voterFor(associationId: string, unitId: string): Promise<string | null> {
    const holder = await prisma.membershipHolder.findFirst({
      where: {
        is_primary: true,
        user_id:    { not: null },
        membership: {
          unit_id: unitId, status: MembershipStatus.ACTIVE, association_id: associationId,
        },
      },
      select: { user_id: true },
    });
    return holder?.user_id ?? null;
  }

  /**
   * Admit a member to a flat that has none.
   *
   * Member numbers are allocated inside the transaction from the current
   * maximum rather than a sequence: a sequence leaves gaps whenever an insert
   * rolls back, and unexplained gaps in a register invite exactly the
   * questions it exists to answer.
   */
  async admit(associationId: string, unitId: string, userId: string, body: {
    admitted_on: string;
    holders: HolderInput[];
    primary_index?: number;
    share_percent?: number | null;
    deed_reference?: string | null;
    notes?: string | null;
    preceded_by_id?: string | null;
  }) {
    const unit = await prisma.unit.findFirst({
      where:  { id: unitId, association_id: associationId, deleted_at: null },
      select: { id: true, flat_number: true },
    });
    if (!unit) throw new NotFoundError('Unit');

    const admitted = new Date(body.admitted_on);
    if (Number.isNaN(admitted.getTime())) throw new UnprocessableError('Invalid admission date.');

    const holders = (body.holders ?? []).filter(h => h.name?.trim());
    if (holders.length === 0) throw new UnprocessableError('Name at least one member.');

    const primaryIndex = body.primary_index ?? 0;
    if (primaryIndex < 0 || primaryIndex >= holders.length) {
      throw new UnprocessableError('Choose which holder carries the vote.');
    }

    const created = await prisma.$transaction(async tx => {
      const existing = await tx.membership.findFirst({
        where:  { unit_id: unitId, status: MembershipStatus.ACTIVE },
        select: { id: true },
      });
      if (existing) {
        throw new UnprocessableError(
          `Flat ${unit.flat_number} already has a member on the register. ` +
          `Record a transfer instead — that closes the current membership and opens the new one.`,
        );
      }

      const last = await tx.membership.aggregate({
        where: { association_id: associationId },
        _max:  { member_no: true },
      });

      return tx.membership.create({
        data: {
          association_id: associationId,
          unit_id:        unitId,
          member_no:      (last._max.member_no ?? 0) + 1,
          admitted_on:    admitted,
          share_percent:  body.share_percent ?? null,
          deed_reference: body.deed_reference?.trim() || null,
          notes:          body.notes?.trim() || null,
          preceded_by_id: body.preceded_by_id ?? null,
          holders: {
            create: holders.map((h, i) => ({
              name:       h.name.trim(),
              phone:      h.phone?.trim() || null,
              email:      h.email?.trim() || null,
              user_id:    h.user_id || null,
              is_primary: i === primaryIndex,
            })),
          },
        },
        select: membershipSelect,
      });
    });

    await auditService.record({
      entity_type: 'membership', entity_id: created.id, action: AuditAction.CREATE,
      association_id: associationId, performed_by: userId,
      summary: `Member ${created.member_no} admitted for flat ${unit.flat_number}: ` +
               holders.map(h => h.name.trim()).join(', '),
    });

    return { data: created };
  }

  /**
   * A transfer of ownership.
   *
   * One transaction: the outgoing membership is closed and the incoming one
   * opened, linked by preceded_by_id. Doing it as two separate calls would
   * leave a window in which a flat has either two members or none — and the
   * partial unique index would reject the first of those anyway.
   */
  async transfer(associationId: string, unitId: string, userId: string, body: {
    transferred_on: string;
    holders: HolderInput[];
    primary_index?: number;
    cessation_reason?: string;
    share_percent?: number | null;
    deed_reference?: string | null;
  }) {
    const on = new Date(body.transferred_on);
    if (Number.isNaN(on.getTime())) throw new UnprocessableError('Invalid transfer date.');

    const outgoing = await prisma.membership.findFirst({
      where:  { unit_id: unitId, status: MembershipStatus.ACTIVE, association_id: associationId },
      select: { id: true, admitted_on: true, unit: { select: { flat_number: true } } },
    });
    if (!outgoing) {
      throw new UnprocessableError(
        'This flat has no member on the register, so there is nothing to transfer from. Admit a member instead.',
      );
    }
    if (on < outgoing.admitted_on) {
      throw new UnprocessableError(
        'A transfer cannot pre-date the admission of the member transferring out.',
      );
    }

    const holders = (body.holders ?? []).filter(h => h.name?.trim());
    if (holders.length === 0) throw new UnprocessableError('Name at least one incoming member.');
    const primaryIndex = body.primary_index ?? 0;

    const result = await prisma.$transaction(async tx => {
      await tx.membership.update({
        where: { id: outgoing.id },
        data: {
          status:           MembershipStatus.CEASED,
          ceased_on:        on,
          cessation_reason: body.cessation_reason?.trim() || 'Transfer of ownership',
        },
      });

      const last = await tx.membership.aggregate({
        where: { association_id: associationId },
        _max:  { member_no: true },
      });

      return tx.membership.create({
        data: {
          association_id: associationId,
          unit_id:        unitId,
          member_no:      (last._max.member_no ?? 0) + 1,
          admitted_on:    on,
          share_percent:  body.share_percent ?? null,
          deed_reference: body.deed_reference?.trim() || null,
          preceded_by_id: outgoing.id,
          holders: {
            create: holders.map((h, i) => ({
              name:       h.name.trim(),
              phone:      h.phone?.trim() || null,
              email:      h.email?.trim() || null,
              user_id:    h.user_id || null,
              is_primary: i === primaryIndex,
            })),
          },
        },
        select: membershipSelect,
      });
    });

    await auditService.record({
      entity_type: 'membership', entity_id: result.id, action: AuditAction.UPDATE,
      association_id: associationId, performed_by: userId,
      summary: `Flat ${outgoing.unit.flat_number} transferred on ` +
               `${on.toISOString().slice(0, 10)} to ${holders.map(h => h.name.trim()).join(', ')} ` +
               `(member ${result.member_no})`,
    });

    return { data: result };
  }

  // ── Editing an existing membership ──────────────────────────────────────────

  async update(associationId: string, membershipId: string, body: {
    admitted_on?: string; share_percent?: number | null;
    deed_reference?: string | null; notes?: string | null;
  }) {
    await this.mustFind(associationId, membershipId);

    const data: Prisma.MembershipUpdateInput = {};
    if (body.admitted_on !== undefined) {
      const d = new Date(body.admitted_on);
      if (Number.isNaN(d.getTime())) throw new UnprocessableError('Invalid admission date.');
      data.admitted_on = d;
    }
    if (body.share_percent  !== undefined) data.share_percent  = body.share_percent;
    if (body.deed_reference !== undefined) data.deed_reference = body.deed_reference?.trim() || null;
    if (body.notes          !== undefined) data.notes          = body.notes?.trim() || null;

    return { data: await prisma.membership.update({
      where: { id: membershipId }, data, select: membershipSelect,
    }) };
  }

  async addHolder(associationId: string, membershipId: string, holder: HolderInput) {
    await this.mustFind(associationId, membershipId);
    if (!holder.name?.trim()) throw new UnprocessableError('Give the joint holder a name.');

    await prisma.membershipHolder.create({
      data: {
        membership_id: membershipId,
        name:    holder.name.trim(),
        phone:   holder.phone?.trim() || null,
        email:   holder.email?.trim() || null,
        user_id: holder.user_id || null,
        is_primary: false,
      },
    });
    return this.reload(membershipId);
  }

  /**
   * Move the vote to a different holder.
   *
   * Cleared then set, in a transaction: the partial unique index permits only
   * one primary per membership, so setting the new one first would collide
   * with the old.
   */
  async setPrimary(associationId: string, membershipId: string, holderId: string) {
    await this.mustFind(associationId, membershipId);

    await prisma.$transaction([
      prisma.membershipHolder.updateMany({
        where: { membership_id: membershipId }, data: { is_primary: false },
      }),
      prisma.membershipHolder.update({
        where: { id: holderId }, data: { is_primary: true },
      }),
    ]);
    return this.reload(membershipId);
  }

  async removeHolder(associationId: string, membershipId: string, holderId: string) {
    await this.mustFind(associationId, membershipId);

    const holder = await prisma.membershipHolder.findUnique({
      where: { id: holderId }, select: { is_primary: true },
    });
    if (holder?.is_primary) {
      throw new UnprocessableError(
        'That holder carries the vote. Make someone else the voting member first.',
      );
    }

    await prisma.membershipHolder.delete({ where: { id: holderId } });
    return this.reload(membershipId);
  }

  async addNominee(associationId: string, membershipId: string, body: {
    name: string; relationship?: string; share_percent?: number | null;
  }) {
    await this.mustFind(associationId, membershipId);
    if (!body.name?.trim()) throw new UnprocessableError('Give the nominee a name.');

    await prisma.membershipNominee.create({
      data: {
        membership_id: membershipId,
        name:          body.name.trim(),
        relationship:  body.relationship?.trim() || null,
        share_percent: body.share_percent ?? null,
      },
    });
    return this.reload(membershipId);
  }

  async removeNominee(associationId: string, membershipId: string, nomineeId: string) {
    await this.mustFind(associationId, membershipId);
    await prisma.membershipNominee.delete({ where: { id: nomineeId } });
    return this.reload(membershipId);
  }

  private async reload(membershipId: string) {
    return { data: await prisma.membership.findUniqueOrThrow({
      where: { id: membershipId }, select: membershipSelect,
    }) };
  }

  private async mustFind(associationId: string, membershipId: string) {
    const m = await prisma.membership.findFirst({
      where:  { id: membershipId, association_id: associationId },
      select: { id: true, status: true },
    });
    if (!m) throw new NotFoundError('Membership');
    return m;
  }
}

export const membershipService = new MembershipService();
