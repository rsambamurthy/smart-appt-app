import prisma from '../../config/database';
import {
  MeetingStatus, MeetingType, ResolutionStatus, ResolutionOutcome,
  VoteChoice, RsvpStatus, AuditAction, UserRole, Prisma,
} from '@prisma/client';
import {
  NotFoundError, UnprocessableError, ForbiddenError,
} from '../../utils/errors';
import { notificationService } from '../../services/notification.service';
import { committeeService } from './committee.service';
import { auditService } from '../../services/audit.service';
import logger from '../../utils/logger';

/**
 * Meetings, agendas, resolutions and minutes.
 *
 * Two rules run through the whole module:
 *
 *  1. ONE VOTE PER FLAT. Not per person — two owners of the same unit share a
 *     single vote. Enforced by a unique index on (agenda_item_id, unit_id).
 *
 *  2. THE MEETING IS JUDGED BY THE RULES IN FORCE WHEN IT WAS CALLED. Quorum
 *     and the eligible-unit count are copied onto the meeting when notice is
 *     issued, never read live. Editing settings next year must not
 *     retroactively invalidate last year's AGM.
 */

const meetingSelect = {
  id: true, title: true, meeting_type: true, status: true,
  committee_id: true,
  committee: { select: { id: true, name: true, is_managing: true } },
  scheduled_at: true, venue: true, online_link: true,
  notice_body: true, notice_issued_at: true,
  quorum_percent: true, eligible_units: true,
  concluded_at: true, minutes_body: true, minutes_published_at: true,
  created_at: true,
};

/** Config with defaults, creating the row on first use. */
async function configFor(associationId: string) {
  return prisma.governanceConfig.upsert({
    where:  { association_id: associationId },
    create: { association_id: associationId },
    update: {},
  });
}

/** Flats that exist and count toward quorum. Deleted units never do. */
function eligibleUnitsWhere(associationId: string) {
  return { association_id: associationId, deleted_at: null };
}

/**
 * How many votes exist for this meeting.
 *
 * The fork that runs through the whole module: a general body meeting counts
 * FLATS, a committee meeting counts MEMBERS. Everything downstream — quorum,
 * the register, who may vote — follows from this one answer.
 */
async function eligibleCount(associationId: string, committeeId: string | null): Promise<number> {
  if (!committeeId) return prisma.unit.count({ where: eligibleUnitsWhere(associationId) });
  return (await committeeService.members(associationId, committeeId)).length;
}

// Typed as the full union rather than inferred from the literals: an array of
// two members infers as that narrow pair, and .includes() then refuses the
// wider MeetingStatus it is being asked about.
const OVER: MeetingStatus[]         = [MeetingStatus.CONCLUDED, MeetingStatus.CANCELLED];
const ABOUT_TO_RUN: MeetingStatus[] = [MeetingStatus.NOTICE_ISSUED, MeetingStatus.IN_PROGRESS];

export class GovernanceService {

  // ── Config ──────────────────────────────────────────────────────────────────

  async getConfig(associationId: string) {
    return { data: await configFor(associationId) };
  }

  async updateConfig(associationId: string, body: {
    notice_days?: number; quorum_percent?: number;
    adjourned_quorum_percent?: number | null; voting_window_hours?: number;
  }) {
    if (body.quorum_percent !== undefined &&
        (body.quorum_percent <= 0 || body.quorum_percent > 100)) {
      throw new UnprocessableError('Quorum must be between 0 and 100 percent.');
    }
    if (body.notice_days !== undefined && body.notice_days < 0) {
      throw new UnprocessableError('Notice period cannot be negative.');
    }

    await configFor(associationId);
    const updated = await prisma.governanceConfig.update({
      where: { association_id: associationId },
      data: {
        ...(body.notice_days              !== undefined && { notice_days: body.notice_days }),
        ...(body.quorum_percent           !== undefined && { quorum_percent: body.quorum_percent }),
        ...(body.adjourned_quorum_percent !== undefined && { adjourned_quorum_percent: body.adjourned_quorum_percent }),
        ...(body.voting_window_hours      !== undefined && { voting_window_hours: body.voting_window_hours }),
      },
    });
    return { data: updated };
  }

  // ── Meetings ────────────────────────────────────────────────────────────────

  async listMeetings(associationId: string, opts: { status?: string; upcoming?: boolean } = {}) {
    const where: Prisma.MeetingWhereInput = { association_id: associationId };

    if (opts.status) where.status = opts.status as MeetingStatus;
    if (opts.upcoming) {
      where.scheduled_at = { gte: new Date() };
      where.status = { notIn: [MeetingStatus.CANCELLED, MeetingStatus.CONCLUDED] };
    }

    const meetings = await prisma.meeting.findMany({
      where,
      select: {
        ...meetingSelect,
        _count: { select: { agenda_items: true, attendees: true } },
      },
      orderBy: { scheduled_at: 'desc' },
      take: 100,
    });

    return { data: meetings };
  }

  /**
   * A meeting with everything needed to render it.
   *
   * `viewerUnitId` scopes the response to one flat: their RSVP, and how they
   * voted. Committee callers pass undefined and get the aggregate view.
   */
  async getMeeting(
    associationId: string, meetingId: string,
    viewerUnitId?: string | null, viewerUserId?: string | null,
  ) {
    const meeting = await prisma.meeting.findFirst({
      where:  { id: meetingId, association_id: associationId },
      select: {
        ...meetingSelect,
        agenda_items: {
          orderBy: { seq: 'asc' },
          select: {
            id: true, seq: true, title: true, description: true,
            is_resolution: true, is_secret: true, voting_status: true,
            pass_threshold_percent: true, outcome: true,
            voting_opened_at: true, voting_closed_at: true,
          },
        },
      },
    });
    if (!meeting) throw new NotFoundError('Meeting');

    // A committee meeting attributes the viewer's vote to the PERSON; a
    // general body meeting attributes it to their FLAT. Looking it up by the
    // wrong key would show a member someone else's vote as their own.
    const byMember = !!meeting.committee_id;
    const voteWhere = byMember
      ? (viewerUserId ? { user_id: viewerUserId } : null)
      : (viewerUnitId ? { unit_id: viewerUnitId } : null);

    const [attendance, tallies, myVotes, myRsvp] = await Promise.all([
      this.attendanceSummary(
        associationId, meetingId, meeting.eligible_units,
        meeting.quorum_percent, meeting.committee_id,
      ),
      this.talliesFor(meeting.agenda_items.map(a => a.id)),
      voteWhere
        ? prisma.resolutionVote.findMany({
            where:  { ...voteWhere, agenda_item: { meeting_id: meetingId } },
            select: { agenda_item_id: true, choice: true },
          })
        : Promise.resolve([]),
      (byMember ? viewerUserId : viewerUnitId)
        ? prisma.meetingAttendee.findFirst({
            where: byMember
              ? { meeting_id: meetingId, user_id: viewerUserId! }
              : { meeting_id: meetingId, unit_id: viewerUnitId! },
            select: { rsvp: true, attended: true },
          })
        : Promise.resolve(null),
    ]);

    const myVoteBy = new Map(myVotes.map(v => [v.agenda_item_id, v.choice]));

    return {
      data: {
        ...meeting,
        attendance,
        agenda_items: meeting.agenda_items.map(item => ({
          ...item,
          tally:   tallies.get(item.id) ?? { for: 0, against: 0, abstain: 0, total: 0 },
          my_vote: myVoteBy.get(item.id) ?? null,
        })),
        my_rsvp:     myRsvp?.rsvp ?? null,
        my_attended: myRsvp?.attended ?? false,
      },
    };
  }

  async createMeeting(associationId: string, userId: string, body: {
    title: string; meeting_type: MeetingType; scheduled_at: string;
    committee_id?: string | null;
    venue?: string; online_link?: string; notice_body?: string;
  }) {
    const when = new Date(body.scheduled_at);
    if (Number.isNaN(when.getTime())) throw new UnprocessableError('Invalid meeting date and time.');

    // A general body meeting has no committee; a committee meeting must have
    // one. Allowing an AGM to be filed under Finance would quietly change who
    // is entitled to vote in it.
    const committeeId = body.committee_id || null;
    if (body.meeting_type === MeetingType.COMMITTEE && !committeeId) {
      throw new UnprocessableError('Choose which committee is meeting.');
    }
    if (body.meeting_type !== MeetingType.COMMITTEE && committeeId) {
      throw new UnprocessableError('An AGM or EGM is a meeting of the whole association, not of a committee.');
    }

    const meeting = await prisma.meeting.create({
      data: {
        association_id: associationId,
        title:          body.title.trim(),
        meeting_type:   body.meeting_type,
        committee_id:   committeeId,
        scheduled_at:   when,
        venue:          body.venue?.trim() || null,
        online_link:    body.online_link?.trim() || null,
        notice_body:    body.notice_body ?? null,
        created_by_id:  userId,
      },
      select: meetingSelect,
    });

    await auditService.record({
      entity_type: 'meeting', entity_id: meeting.id, action: AuditAction.CREATE,
      association_id: associationId, performed_by: userId,
      summary: `${body.meeting_type} "${meeting.title}" created as draft`,
    });

    return { data: meeting };
  }

  async updateMeeting(associationId: string, meetingId: string, body: {
    title?: string; scheduled_at?: string; venue?: string;
    online_link?: string; notice_body?: string;
  }) {
    const meeting = await this.mustFind(associationId, meetingId);

    // The agenda and the date are what the notice told everyone. Changing them
    // afterwards means the notice was wrong, which is a governance problem
    // rather than an editing convenience — cancel and re-issue instead.
    if (meeting.status !== MeetingStatus.DRAFT && body.scheduled_at) {
      throw new UnprocessableError(
        'The date cannot change once notice has been issued. Cancel this meeting and call a new one.',
      );
    }

    const updated = await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        ...(body.title        !== undefined && { title: body.title.trim() }),
        ...(body.scheduled_at !== undefined && { scheduled_at: new Date(body.scheduled_at) }),
        ...(body.venue        !== undefined && { venue: body.venue?.trim() || null }),
        ...(body.online_link  !== undefined && { online_link: body.online_link?.trim() || null }),
        ...(body.notice_body  !== undefined && { notice_body: body.notice_body }),
      },
      select: meetingSelect,
    });

    return { data: updated };
  }

  /**
   * Issue the notice.
   *
   * This is the point of no return: the agenda is fixed, residents can see the
   * meeting, and the quorum rules are frozen onto the record.
   */
  async issueNotice(associationId: string, meetingId: string, userId: string) {
    const meeting = await this.mustFind(associationId, meetingId);

    if (meeting.status !== MeetingStatus.DRAFT) {
      throw new UnprocessableError('Notice has already been issued for this meeting.');
    }

    const [config, agendaCount, eligibleUnits] = await Promise.all([
      configFor(associationId),
      prisma.agendaItem.count({ where: { meeting_id: meetingId } }),
      eligibleCount(associationId, meeting.committee_id),
    ]);

    if (agendaCount === 0) {
      throw new UnprocessableError('Add at least one agenda item before issuing the notice.');
    }
    if (eligibleUnits === 0) {
      throw new UnprocessableError(meeting.committee_id
        ? 'This committee has no members, so there is nobody to call to a meeting.'
        : 'This association has no units, so there is nobody to call to a meeting.');
    }

    // Short notice is a validity risk, so it is surfaced rather than silently
    // allowed — but it is not blocked. Associations do hold valid meetings on
    // short notice with consent, and the product should not claim to know
    // better than the committee.
    const clearDays = Math.floor(
      (meeting.scheduled_at.getTime() - Date.now()) / 86_400_000,
    );
    const shortNotice = clearDays < config.notice_days;

    const updated = await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        status:           MeetingStatus.NOTICE_ISSUED,
        notice_issued_at: new Date(),
        quorum_percent:   config.quorum_percent,
        eligible_units:   eligibleUnits,
      },
      select: meetingSelect,
    });

    await auditService.record({
      entity_type: 'meeting', entity_id: meetingId, action: AuditAction.APPROVE,
      association_id: associationId, performed_by: userId,
      summary: `Notice issued for "${meeting.title}" — ${clearDays} days' notice, ` +
               `quorum ${config.quorum_percent}% of ${eligibleUnits} flats` +
               (shortNotice ? ' (SHORT NOTICE)' : ''),
    });

    // Everyone with a flat needs to know. Failure here must not undo the
    // notice — it is issued, and can be re-sent from the meeting screen.
    try {
      // A committee meeting concerns its members. Telling all 200 residents
      // about the water sub-committee's Tuesday call is how people learn to
      // ignore notifications.
      const recipients = meeting.committee_id
        ? (await committeeService.members(associationId, meeting.committee_id)).map(m => m.user_id)
        : (await prisma.user.findMany({
            where:  { association_id: associationId, unit_id: { not: null }, is_active: true, deleted_at: null },
            select: { id: true },
          })).map(r => r.id);

      await notificationService.dispatch({
        type: 'MEETING_NOTICE',
        channels: ['PUSH', 'EMAIL'],
        recipients,
        data: {
          meeting_id: meetingId,
          title: meeting.title,
          scheduled_at: meeting.scheduled_at.toISOString(),
        },
      });
    } catch (err) {
      logger.error('Meeting notice dispatched but notification failed', {
        meeting_id: meetingId, error: (err as Error).message,
      });
    }

    return { data: { ...updated, short_notice: shortNotice, clear_days: clearDays } };
  }

  async setStatus(associationId: string, meetingId: string, status: MeetingStatus, userId: string) {
    const meeting = await this.mustFind(associationId, meetingId);

    const allowed: Record<MeetingStatus, MeetingStatus[]> = {
      DRAFT:         [MeetingStatus.CANCELLED],
      NOTICE_ISSUED: [MeetingStatus.IN_PROGRESS, MeetingStatus.CANCELLED],
      IN_PROGRESS:   [MeetingStatus.CONCLUDED],
      CONCLUDED:     [],
      CANCELLED:     [],
    };

    if (!allowed[meeting.status].includes(status)) {
      throw new UnprocessableError(
        `A ${meeting.status.toLowerCase().replace('_', ' ')} meeting cannot become ${status.toLowerCase()}.`,
      );
    }

    // Concluding closes any resolution still open, so nothing is left in a
    // state where votes could trickle in against a meeting that has ended.
    // Absentee voting continues only for items explicitly left open.
    const updated = await prisma.$transaction(async tx => {
      if (status === MeetingStatus.CONCLUDED) {
        const open = await tx.agendaItem.findMany({
          where:  { meeting_id: meetingId, voting_status: ResolutionStatus.OPEN },
          select: { id: true },
        });
        for (const item of open) await this.closeVotingIn(tx, item.id);
      }

      return tx.meeting.update({
        where: { id: meetingId },
        data: {
          status,
          ...(status === MeetingStatus.CONCLUDED && { concluded_at: new Date() }),
        },
        select: meetingSelect,
      });
    });

    await auditService.record({
      entity_type: 'meeting', entity_id: meetingId, action: AuditAction.UPDATE,
      association_id: associationId, performed_by: userId,
      summary: `"${meeting.title}" marked ${status}`,
    });

    return { data: updated };
  }

  // ── Agenda ──────────────────────────────────────────────────────────────────

  async addAgendaItem(associationId: string, meetingId: string, body: {
    title: string; description?: string; is_resolution?: boolean;
    is_secret?: boolean; pass_threshold_percent?: number;
  }) {
    const meeting = await this.mustFind(associationId, meetingId);

    // The agenda is what the notice promised. Adding to it afterwards means
    // members were asked to a meeting that is no longer the one being held.
    if (meeting.status !== MeetingStatus.DRAFT) {
      throw new UnprocessableError(
        'The agenda is fixed once notice has been issued. Any other business ' +
        'can be recorded in the minutes.',
      );
    }

    const threshold = body.pass_threshold_percent ?? 50;
    if (threshold <= 0 || threshold > 100) {
      throw new UnprocessableError('The majority needed must be between 0 and 100 percent.');
    }

    const last = await prisma.agendaItem.findFirst({
      where:   { meeting_id: meetingId },
      orderBy: { seq: 'desc' },
      select:  { seq: true },
    });

    const item = await prisma.agendaItem.create({
      data: {
        meeting_id:  meetingId,
        seq:         (last?.seq ?? 0) + 1,
        title:       body.title.trim(),
        description: body.description?.trim() || null,
        is_resolution: body.is_resolution ?? false,
        is_secret:     body.is_secret ?? false,
        pass_threshold_percent: threshold,
      },
    });

    return { data: item };
  }

  async updateAgendaItem(associationId: string, itemId: string, body: {
    title?: string; description?: string; is_resolution?: boolean;
    is_secret?: boolean; pass_threshold_percent?: number;
  }) {
    const item = await this.mustFindItem(associationId, itemId);

    if (item.meeting.status !== MeetingStatus.DRAFT) {
      throw new UnprocessableError('The agenda is fixed once notice has been issued.');
    }

    const updated = await prisma.agendaItem.update({
      where: { id: itemId },
      data: {
        ...(body.title       !== undefined && { title: body.title.trim() }),
        ...(body.description !== undefined && { description: body.description?.trim() || null }),
        ...(body.is_resolution !== undefined && { is_resolution: body.is_resolution }),
        ...(body.is_secret     !== undefined && { is_secret: body.is_secret }),
        ...(body.pass_threshold_percent !== undefined && { pass_threshold_percent: body.pass_threshold_percent }),
      },
    });

    return { data: updated };
  }

  async deleteAgendaItem(associationId: string, itemId: string) {
    const item = await this.mustFindItem(associationId, itemId);
    if (item.meeting.status !== MeetingStatus.DRAFT) {
      throw new UnprocessableError('The agenda is fixed once notice has been issued.');
    }
    await prisma.agendaItem.delete({ where: { id: itemId } });
    return { data: { deleted: true } };
  }

  // ── RSVP and attendance ─────────────────────────────────────────────────────

  /** A resident answering for their own flat. One answer per flat. */
  async rsvp(associationId: string, meetingId: string, unitId: string, userId: string, status: RsvpStatus) {
    const meeting = await this.mustFind(associationId, meetingId);
    if (meeting.status === MeetingStatus.DRAFT) throw new NotFoundError('Meeting');
    if (OVER.includes(meeting.status)) {
      throw new UnprocessableError('This meeting is over.');
    }

    const record = await prisma.meetingAttendee.upsert({
      where:  { meeting_id_unit_id: { meeting_id: meetingId, unit_id: unitId } },
      create: { meeting_id: meetingId, unit_id: unitId, user_id: userId, rsvp: status },
      update: { rsvp: status, user_id: userId },
    });

    return { data: record };
  }

  /**
   * Marking someone present.
   *
   * Takes whichever identifier the meeting uses: a flat for the general body,
   * a member for a committee. Passing the wrong one is rejected rather than
   * silently creating a row nobody counts.
   */
  async markAttendance(
    associationId: string, meetingId: string,
    who: { unit_id?: string; user_id?: string }, attended: boolean,
  ) {
    const meeting = await this.mustFind(associationId, meetingId);
    if (!ABOUT_TO_RUN.includes(meeting.status)) {
      throw new UnprocessableError('Attendance can only be marked for a meeting that is about to start or under way.');
    }

    if (meeting.committee_id) {
      if (!who.user_id) throw new UnprocessableError('A committee meeting marks members present, not flats.');
      await prisma.meetingAttendee.upsert({
        where:  { meeting_id_user_id: { meeting_id: meetingId, user_id: who.user_id } },
        create: { meeting_id: meetingId, user_id: who.user_id, attended, marked_at: new Date() },
        update: { attended, marked_at: new Date() },
      });
    } else {
      if (!who.unit_id) throw new UnprocessableError('Which flat?');
      await prisma.meetingAttendee.upsert({
        where:  { meeting_id_unit_id: { meeting_id: meetingId, unit_id: who.unit_id } },
        create: { meeting_id: meetingId, unit_id: who.unit_id, attended, marked_at: new Date() },
        update: { attended, marked_at: new Date() },
      });
    }

    return {
      data: await this.attendanceSummary(
        associationId, meetingId, meeting.eligible_units,
        meeting.quorum_percent, meeting.committee_id,
      ),
    };
  }

  /**
   * The register.
   *
   * A general body meeting lists every FLAT; a committee meeting lists every
   * MEMBER. Same shape either way so the screen does not need two renderers —
   * `unit_id` is null and `user_id` carries the identity for a committee.
   */
  async attendanceRegister(associationId: string, meetingId: string) {
    const meeting = await this.mustFind(associationId, meetingId);

    if (meeting.committee_id) {
      const [members, rows] = await Promise.all([
        committeeService.members(associationId, meeting.committee_id),
        prisma.meetingAttendee.findMany({
          where:  { meeting_id: meetingId },
          select: { user_id: true, rsvp: true, attended: true },
        }),
      ]);
      const byUser = new Map(rows.map(r => [r.user_id, r]));

      return {
        data: members.map(m => ({
          unit_id:     null,
          user_id:     m.user_id,
          flat_number: m.name,
          block:       m.is_convenor ? 'Convenor' : m.flat_number,
          rsvp:        byUser.get(m.user_id)?.rsvp ?? null,
          attended:    byUser.get(m.user_id)?.attended ?? false,
          answered_by: null,
        })),
      };
    }

    const [units, rows] = await Promise.all([
      prisma.unit.findMany({
        where:   eligibleUnitsWhere(associationId),
        select:  { id: true, flat_number: true, block: true },
        orderBy: [{ block: 'asc' }, { flat_number: 'asc' }],
      }),
      prisma.meetingAttendee.findMany({
        where:  { meeting_id: meetingId },
        select: { unit_id: true, rsvp: true, attended: true, user: { select: { name: true } } },
      }),
    ]);

    const byUnit = new Map(rows.map(r => [r.unit_id, r]));

    return {
      data: units.map(u => ({
        unit_id:     u.id,
        user_id:     null,
        flat_number: u.flat_number,
        block:       u.block,
        rsvp:        byUnit.get(u.id)?.rsvp ?? null,
        attended:    byUnit.get(u.id)?.attended ?? false,
        answered_by: byUnit.get(u.id)?.user?.name ?? null,
      })),
    };
  }

  /**
   * Quorum.
   *
   * Counted in flats against the eligible count SNAPSHOTTED at notice, not
   * against today's unit list. A flat sold and re-registered between notice
   * and meeting must not silently move the bar.
   */
  private async attendanceSummary(
    associationId: string,
    meetingId: string,
    eligibleUnits: number | null,
    quorumPercent: Prisma.Decimal | null,
    committeeId: string | null = null,
  ) {
    const [present, rsvpYes, liveUnits] = await Promise.all([
      prisma.meetingAttendee.count({ where: { meeting_id: meetingId, attended: true } }),
      prisma.meetingAttendee.count({ where: { meeting_id: meetingId, rsvp: RsvpStatus.YES } }),
      eligibleUnits === null
        ? eligibleCount(associationId, committeeId)
        : Promise.resolve(eligibleUnits),
    ]);

    const eligible = eligibleUnits ?? liveUnits;
    const percent  = quorumPercent ? Number(quorumPercent) : null;
    const required = percent !== null && eligible > 0
      ? Math.ceil((percent / 100) * eligible)
      : null;

    return {
      // Named units for continuity, but it is members for a committee meeting.
      counts_members: !!committeeId,
      eligible_units: eligible,
      present,
      rsvp_yes:       rsvpYes,
      quorum_percent: percent,
      quorum_required: required,
      // Null until notice fixes the rules — an unanswerable question rather
      // than a false "no".
      quorum_met: required === null ? null : present >= required,
    };
  }

  // ── Voting ──────────────────────────────────────────────────────────────────

  async openVoting(associationId: string, itemId: string, userId: string) {
    const item = await this.mustFindItem(associationId, itemId);

    if (!item.is_resolution) throw new UnprocessableError('This agenda item is for discussion, not a vote.');
    if (item.meeting.status !== MeetingStatus.IN_PROGRESS) {
      throw new UnprocessableError('Start the meeting before opening a resolution for voting.');
    }
    if (item.voting_status === ResolutionStatus.CLOSED) {
      throw new UnprocessableError('Voting on this resolution has already closed.');
    }

    const updated = await prisma.agendaItem.update({
      where: { id: itemId },
      data:  { voting_status: ResolutionStatus.OPEN, voting_opened_at: new Date() },
    });

    await auditService.record({
      entity_type: 'resolution', entity_id: itemId, action: AuditAction.UPDATE,
      association_id: associationId, performed_by: userId,
      summary: `Voting opened on "${item.title}"`,
    });

    return { data: updated };
  }

  async closeVoting(associationId: string, itemId: string, userId: string) {
    const item = await this.mustFindItem(associationId, itemId);
    if (item.voting_status !== ResolutionStatus.OPEN) {
      throw new UnprocessableError('Voting is not open on this resolution.');
    }

    const result = await prisma.$transaction(tx => this.closeVotingIn(tx, itemId));

    await auditService.record({
      entity_type: 'resolution', entity_id: itemId, action: AuditAction.CLOSE,
      association_id: associationId, performed_by: userId,
      summary: `"${item.title}" ${result.outcome} — ` +
               `${result.tally.for} for, ${result.tally.against} against, ${result.tally.abstain} abstained`,
    });

    return { data: result };
  }

  /**
   * Tally and decide, inside a transaction.
   *
   * Abstentions are recorded but excluded from the denominator: a member who
   * abstains has declined to influence the outcome, which is not the same as
   * voting against. A resolution with no votes for or against is DEFEATED
   * rather than carried by a vacuous majority.
   */
  private async closeVotingIn(tx: Prisma.TransactionClient, itemId: string) {
    const item = await tx.agendaItem.findUniqueOrThrow({
      where:  { id: itemId },
      select: { pass_threshold_percent: true },
    });

    const rows = await tx.resolutionVote.groupBy({
      by: ['choice'],
      where: { agenda_item_id: itemId },
      _count: { _all: true },
    });

    const count = (c: VoteChoice) => rows.find(r => r.choice === c)?._count._all ?? 0;
    const tally = {
      for:     count(VoteChoice.FOR),
      against: count(VoteChoice.AGAINST),
      abstain: count(VoteChoice.ABSTAIN),
      total:   0,
    };
    tally.total = tally.for + tally.against + tally.abstain;

    const decisive = tally.for + tally.against;
    const share    = decisive > 0 ? (tally.for / decisive) * 100 : 0;
    const outcome  = decisive > 0 && share >= Number(item.pass_threshold_percent)
      ? ResolutionOutcome.CARRIED
      : ResolutionOutcome.DEFEATED;

    await tx.agendaItem.update({
      where: { id: itemId },
      data: {
        voting_status:    ResolutionStatus.CLOSED,
        voting_closed_at: new Date(),
        outcome,
      },
    });

    return { outcome, tally, share: Math.round(share * 100) / 100 };
  }

  /**
   * Cast or change a vote.
   *
   * Open to every flat while voting is open, whether or not it was marked
   * present — members who could not attend still get a say, and the vote can
   * be changed until the moment it closes.
   */
  async castVote(
    associationId: string, itemId: string,
    unitId: string | null, userId: string, choice: VoteChoice,
  ) {
    const item = await this.mustFindItem(associationId, itemId);

    if (!item.is_resolution) throw new UnprocessableError('This agenda item is not a resolution.');
    if (item.voting_status !== ResolutionStatus.OPEN) {
      throw new UnprocessableError(
        item.voting_status === ResolutionStatus.CLOSED
          ? 'Voting on this resolution has closed.'
          : 'Voting has not opened on this resolution yet.',
      );
    }

    const committeeId = item.meeting.committee_id;

    if (committeeId) {
      // Committee resolution: the vote belongs to the PERSON. Only members may
      // cast one, and unit_id stays null so the per-flat constraint does not
      // apply — Postgres treats those NULLs as distinct.
      const members = await committeeService.members(associationId, committeeId);
      if (!members.some(m => m.user_id === userId)) {
        throw new ForbiddenError('Only members of this committee can vote on its resolutions.');
      }

      const vote = await prisma.resolutionVote.upsert({
        where:  { agenda_item_id_user_id: { agenda_item_id: itemId, user_id: userId } },
        create: { agenda_item_id: itemId, user_id: userId, unit_id: null, choice },
        update: { choice, cast_at: new Date() },
        select: { choice: true, cast_at: true },
      });
      return { data: vote };
    }

    // General body: the vote belongs to the FLAT. A second occupant of the
    // same flat changes it rather than adding to it.
    if (!unitId) {
      throw new UnprocessableError(
        'Voting in a general body meeting is by flat, and your account is not ' +
        'linked to one. Ask your manager to link it.',
      );
    }

    const vote = await prisma.resolutionVote.upsert({
      where:  { agenda_item_id_unit_id: { agenda_item_id: itemId, unit_id: unitId } },
      create: { agenda_item_id: itemId, unit_id: unitId, user_id: userId, choice },
      update: { choice, user_id: userId, cast_at: new Date() },
      select: { choice: true, cast_at: true },
    });

    return { data: vote };
  }

  /** Running counts per agenda item. */
  private async talliesFor(itemIds: string[]) {
    if (itemIds.length === 0) return new Map<string, { for: number; against: number; abstain: number; total: number }>();

    const rows = await prisma.resolutionVote.groupBy({
      by: ['agenda_item_id', 'choice'],
      where: { agenda_item_id: { in: itemIds } },
      _count: { _all: true },
    });

    const out = new Map<string, { for: number; against: number; abstain: number; total: number }>();
    for (const id of itemIds) out.set(id, { for: 0, against: 0, abstain: 0, total: 0 });

    for (const r of rows) {
      const t = out.get(r.agenda_item_id)!;
      const n = r._count._all;
      if (r.choice === VoteChoice.FOR) t.for = n;
      else if (r.choice === VoteChoice.AGAINST) t.against = n;
      else t.abstain = n;
      t.total += n;
    }
    return out;
  }

  /**
   * Who voted how — for an open ballot only.
   *
   * A secret resolution returns tallies and nothing else. The rows exist (they
   * are what stops double-voting), so this is enforced discretion rather than
   * true secrecy, and the API refuses rather than pretending the data is gone.
   */
  async voteBreakdown(associationId: string, itemId: string) {
    const item = await this.mustFindItem(associationId, itemId);

    if (item.is_secret) {
      throw new ForbiddenError(
        'This was a secret ballot. Only the totals are available, by design.',
      );
    }

    const votes = await prisma.resolutionVote.findMany({
      where: { agenda_item_id: itemId },
      select: {
        choice: true, cast_at: true,
        unit: { select: { flat_number: true, block: true } },
        user: { select: { name: true } },
      },
      orderBy: { cast_at: 'asc' },
    });

    return { data: votes };
  }

  // ── Minutes ─────────────────────────────────────────────────────────────────

  async saveMinutes(associationId: string, meetingId: string, body: string, publish: boolean, userId: string) {
    const meeting = await this.mustFind(associationId, meetingId);

    if (publish && meeting.status !== MeetingStatus.CONCLUDED) {
      throw new UnprocessableError('Conclude the meeting before publishing its minutes.');
    }

    const updated = await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        minutes_body: body,
        ...(publish && { minutes_published_at: new Date() }),
      },
      select: meetingSelect,
    });

    if (publish) {
      await auditService.record({
        entity_type: 'meeting', entity_id: meetingId, action: AuditAction.APPROVE,
        association_id: associationId, performed_by: userId,
        summary: `Minutes published for "${meeting.title}"`,
      });
    }

    return { data: updated };
  }

  // ── Resident view ───────────────────────────────────────────────────────────

  /**
   * Meetings a resident can see.
   *
   * General body meetings are open to everyone once notice is issued.
   * Sub-committee business stays within the sub-committee until its minutes
   * are published — at which point it becomes part of the association's
   * record and everyone may read it.
   */
  async listForResident(associationId: string, unitId: string | null, userId?: string | null) {
    const mySeats = userId
      ? await prisma.committeeMember.findMany({
          where:  { user_id: userId, ended_on: null },
          select: { committee_id: true },
        })
      : [];

    // The managing committee's roster comes from the role, not from seats.
    const me = userId
      ? await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
      : null;

    const managingIds = me?.role === UserRole.COMMITTEE
      ? (await prisma.committee.findMany({
          where: { association_id: associationId, is_managing: true }, select: { id: true },
        })).map(c => c.id)
      : [];

    const visibleCommitteeIds = [...mySeats.map(s => s.committee_id), ...managingIds];

    const meetings = await prisma.meeting.findMany({
      where: {
        association_id: associationId,
        status: { not: MeetingStatus.DRAFT },
        OR: [
          { committee_id: null },
          { committee_id: { in: visibleCommitteeIds } },
          { minutes_published_at: { not: null } },
        ],
      },
      select: {
        ...meetingSelect,
        attendees: unitId
          ? { where: { unit_id: unitId }, select: { rsvp: true, attended: true } }
          : false,
        agenda_items: {
          where:  { is_resolution: true, voting_status: ResolutionStatus.OPEN },
          select: { id: true },
        },
      },
      orderBy: { scheduled_at: 'desc' },
      take: 50,
    });

    return {
      data: meetings.map(m => ({
        ...m,
        my_rsvp:      m.attendees?.[0]?.rsvp ?? null,
        my_attended:  m.attendees?.[0]?.attended ?? false,
        open_votes:   m.agenda_items.length,
        attendees:    undefined,
        agenda_items: undefined,
      })),
    };
  }

  private async mustFind(associationId: string, meetingId: string) {
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, association_id: associationId },
    });
    if (!meeting) throw new NotFoundError('Meeting');
    return meeting;
  }

  private async mustFindItem(associationId: string, itemId: string) {
    const item = await prisma.agendaItem.findFirst({
      where:   { id: itemId, meeting: { association_id: associationId } },
      include: { meeting: { select: { id: true, status: true, title: true, committee_id: true } } },
    });
    if (!item) throw new NotFoundError('Agenda item');
    return item;
  }
}

export const governanceService = new GovernanceService();
