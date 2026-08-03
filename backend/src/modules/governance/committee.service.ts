import prisma from '../../config/database';
import { UserRole } from '@prisma/client';
import { NotFoundError, UnprocessableError, ForbiddenError } from '../../utils/errors';

/**
 * Sub-committees, and who is entitled to vote in one.
 *
 * There are two rules in this product and they must not be confused:
 *
 *   General body (AGM, EGM) — committee_id is NULL. ONE VOTE PER FLAT.
 *   Sub-committee           — committee_id is set.  ONE VOTE PER MEMBER.
 *
 * The second exists because a committee is a group of appointed people. Two
 * members who happen to share a flat get a vote each; that is the point of
 * appointing individuals rather than households.
 *
 * The managing committee is special: its roster is not stored as rows but
 * derived from UserRole.COMMITTEE, so there is one source of truth for who
 * sits on it rather than two that drift apart the first time someone's role
 * is edited outside this module.
 */

export interface Voter {
  user_id: string;
  name: string;
  unit_id: string | null;
  flat_number: string | null;
  is_convenor: boolean;
}

export class CommitteeService {

  async list(associationId: string) {
    const committees = await prisma.committee.findMany({
      where:   { association_id: associationId, is_active: true },
      orderBy: [{ is_managing: 'desc' }, { name: 'asc' }],
      select: {
        id: true, name: true, description: true, is_managing: true,
        _count: { select: { members: { where: { ended_on: null } } } },
      },
    });

    // The managing committee's count comes from roles, not rows.
    const managingCount = await prisma.user.count({
      where: { association_id: associationId, role: UserRole.COMMITTEE, is_active: true, deleted_at: null },
    });

    return {
      data: committees.map(c => ({
        id: c.id, name: c.name, description: c.description, is_managing: c.is_managing,
        member_count: c.is_managing ? managingCount : c._count.members,
      })),
    };
  }

  async create(associationId: string, body: { name: string; description?: string }) {
    const name = body.name?.trim();
    if (!name) throw new UnprocessableError('Give the committee a name.');

    const clash = await prisma.committee.findFirst({
      where: { association_id: associationId, name },
    });
    if (clash) throw new UnprocessableError(`There is already a committee called "${name}".`);

    return { data: await prisma.committee.create({
      data: { association_id: associationId, name, description: body.description?.trim() || null },
    }) };
  }

  async update(associationId: string, committeeId: string, body: { name?: string; description?: string; is_active?: boolean }) {
    const c = await this.mustFind(associationId, committeeId);

    // Renaming the managing committee is allowed; unmaking it is not, because
    // its membership rule is structural rather than a setting.
    if (c.is_managing && body.is_active === false) {
      throw new UnprocessableError('The managing committee cannot be deactivated.');
    }

    return { data: await prisma.committee.update({
      where: { id: committeeId },
      data: {
        ...(body.name        !== undefined && { name: body.name.trim() }),
        ...(body.description !== undefined && { description: body.description?.trim() || null }),
        ...(body.is_active   !== undefined && { is_active: body.is_active }),
      },
    }) };
  }

  /**
   * Current members, whether stored or derived.
   *
   * `asOf` is honoured for stored rosters so historic meetings resolve against
   * the committee as it stood then. The managing committee cannot do that —
   * roles carry no history — which is a known limitation worth knowing about
   * rather than papering over.
   */
  async members(associationId: string, committeeId: string, asOf?: Date): Promise<Voter[]> {
    const c = await this.mustFind(associationId, committeeId);

    if (c.is_managing) {
      const users = await prisma.user.findMany({
        where: {
          association_id: associationId, role: UserRole.COMMITTEE,
          is_active: true, deleted_at: null,
        },
        select: { id: true, name: true, unit_id: true, unit: { select: { flat_number: true } } },
        orderBy: { name: 'asc' },
      });
      return users.map(u => ({
        user_id: u.id, name: u.name, unit_id: u.unit_id ?? null,
        flat_number: u.unit?.flat_number ?? null, is_convenor: false,
      }));
    }

    const rows = await prisma.committeeMember.findMany({
      where: {
        committee_id: committeeId,
        // A seat counts if it had not ended by the date in question.
        OR: [{ ended_on: null }, ...(asOf ? [{ ended_on: { gte: asOf } }] : [])],
        user: { is_active: true, deleted_at: null },
      },
      select: {
        is_convenor: true,
        user: { select: { id: true, name: true, unit_id: true, unit: { select: { flat_number: true } } } },
      },
      orderBy: [{ is_convenor: 'desc' }, { user: { name: 'asc' } }],
    });

    return rows.map(r => ({
      user_id: r.user.id, name: r.user.name, unit_id: r.user.unit_id ?? null,
      flat_number: r.user.unit?.flat_number ?? null, is_convenor: r.is_convenor,
    }));
  }

  async addMember(associationId: string, committeeId: string, userId: string, isConvenor: boolean) {
    const c = await this.mustFind(associationId, committeeId);
    if (c.is_managing) {
      throw new UnprocessableError(
        'Membership of the managing committee follows the Committee user role. ' +
        'Change the role in Manage Users instead.',
      );
    }

    const user = await prisma.user.findFirst({
      where:  { id: userId, association_id: associationId, deleted_at: null },
      select: { id: true },
    });
    if (!user) throw new NotFoundError('User');

    // Re-appointing someone who stepped down reopens their seat rather than
    // creating a second one, so the history stays a single row per person.
    return { data: await prisma.committeeMember.upsert({
      where:  { committee_id_user_id: { committee_id: committeeId, user_id: userId } },
      create: { committee_id: committeeId, user_id: userId, is_convenor: isConvenor },
      update: { is_convenor: isConvenor, ended_on: null },
    }) };
  }

  /** Stepping down. The row is kept so past meetings still resolve correctly. */
  async endMembership(associationId: string, committeeId: string, userId: string) {
    const c = await this.mustFind(associationId, committeeId);
    if (c.is_managing) {
      throw new UnprocessableError('Change the user\'s role in Manage Users instead.');
    }

    await prisma.committeeMember.update({
      where: { committee_id_user_id: { committee_id: committeeId, user_id: userId } },
      data:  { ended_on: new Date(), is_convenor: false },
    });
    return { data: { ended: true } };
  }

  /** Can this user call or run a meeting of this committee? */
  async canConvene(associationId: string, committeeId: string, user: { id: string; role: UserRole }) {
    if (user.role === UserRole.MANAGER || user.role === UserRole.SUPER_USER) return true;

    const c = await this.mustFind(associationId, committeeId);
    if (c.is_managing) return user.role === UserRole.COMMITTEE;

    const seat = await prisma.committeeMember.findUnique({
      where:  { committee_id_user_id: { committee_id: committeeId, user_id: user.id } },
      select: { is_convenor: true, ended_on: true },
    });
    return !!seat && seat.ended_on === null && seat.is_convenor;
  }

  async assertCanConvene(associationId: string, committeeId: string, user: { id: string; role: UserRole }) {
    if (!(await this.canConvene(associationId, committeeId, user))) {
      throw new ForbiddenError('Only the convenor of this committee, or a manager, can call its meetings.');
    }
  }

  private async mustFind(associationId: string, committeeId: string) {
    const c = await prisma.committee.findFirst({
      where: { id: committeeId, association_id: associationId },
    });
    if (!c) throw new NotFoundError('Committee');
    return c;
  }
}

export const committeeService = new CommitteeService();
