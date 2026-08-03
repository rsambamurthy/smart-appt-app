import prisma from '../../config/database';
import { ElectionStatus, NominationStatus, AuditAction } from '@prisma/client';
import { NotFoundError, UnprocessableError, ForbiddenError } from '../../utils/errors';
import { auditService } from '../../services/audit.service';
import { membershipService } from './membership.service';

/**
 * Committee elections.
 *
 * General seats: the N candidates with most votes are elected. A nomination
 * needs a proposer and a seconder, both being other flats. Declaring the
 * result replaces the committee roster.
 *
 * SECRECY IS STRUCTURAL. The choices go on an anonymous ballot; a separate
 * voter roll records only that a flat has voted. Nothing joins the two — the
 * columns to do it do not exist. That is why a ballot cannot be changed once
 * cast: there is no way to find it again.
 */

const candidateSelect = {
  id: true, status: true, statement: true,
  proposed_by_unit_id: true, seconded_by_unit_id: true,
  seconded_at: true, accepted_at: true,
  user: { select: { id: true, name: true } },
  unit: { select: { id: true, flat_number: true, block: true } },
};

const electionSelect = {
  id: true, title: true, seats: true, status: true,
  term_starts_on: true, term_ends_on: true,
  nominations_close_at: true, voting_closes_at: true,
  declared_at: true,
  committee: { select: { id: true, name: true, is_managing: true } },
};

/** Legal phase moves. Anything not listed here is refused. */
const NEXT: Record<ElectionStatus, ElectionStatus[]> = {
  DRAFT:              [ElectionStatus.NOMINATIONS_OPEN, ElectionStatus.CANCELLED],
  NOMINATIONS_OPEN:   [ElectionStatus.NOMINATIONS_CLOSED, ElectionStatus.CANCELLED],
  NOMINATIONS_CLOSED: [ElectionStatus.VOTING_OPEN, ElectionStatus.NOMINATIONS_OPEN, ElectionStatus.CANCELLED],
  VOTING_OPEN:        [ElectionStatus.VOTING_CLOSED],
  VOTING_CLOSED:      [ElectionStatus.DECLARED],
  DECLARED:           [],
  CANCELLED:          [],
};

export class ElectionService {

  async list(associationId: string) {
    return { data: await prisma.election.findMany({
      where:   { association_id: associationId },
      select:  { ...electionSelect, _count: { select: { candidates: true, roll: true } } },
      orderBy: { term_starts_on: 'desc' },
      take:    50,
    }) };
  }

  /**
   * One election, scoped to the caller.
   *
   * `viewerUnitId` decides what they are told about themselves: whether their
   * flat has voted, and whether they are standing. It never reveals how anyone
   * voted, because that is not recoverable.
   */
  async get(associationId: string, electionId: string, viewerUnitId?: string | null) {
    const election = await prisma.election.findFirst({
      where:  { id: electionId, association_id: associationId },
      select: {
        ...electionSelect,
        candidates: { select: candidateSelect, orderBy: { created_at: 'asc' } },
      },
    });
    if (!election) throw new NotFoundError('Election');

    const [eligible, voted, iVoted] = await Promise.all([
      prisma.unit.count({ where: { association_id: associationId, deleted_at: null } }),
      prisma.electionVoterRoll.count({ where: { election_id: electionId } }),
      viewerUnitId
        ? prisma.electionVoterRoll.findUnique({
            where: { election_id_unit_id: { election_id: electionId, unit_id: viewerUnitId } },
            select: { voted_at: true },
          })
        : Promise.resolve(null),
    ]);

    // Results only exist once declared. Before that there is deliberately no
    // running tally: a visible count during voting changes how people vote.
    const results = election.status === ElectionStatus.DECLARED
      ? await this.tally(electionId, election.seats)
      : null;

    return {
      data: {
        ...election,
        turnout: { eligible, voted },
        my_vote_cast: !!iVoted,
        results,
      },
    };
  }

  async create(associationId: string, userId: string, body: {
    committee_id: string; title: string; seats: number;
    term_starts_on: string; term_ends_on: string;
  }) {
    const committee = await prisma.committee.findFirst({
      where:  { id: body.committee_id, association_id: associationId },
      select: { id: true, name: true, is_managing: true },
    });
    if (!committee) throw new NotFoundError('Committee');

    const starts = new Date(body.term_starts_on);
    const ends   = new Date(body.term_ends_on);
    if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) {
      throw new UnprocessableError('Set both term dates.');
    }
    if (ends <= starts) throw new UnprocessableError('The term must end after it starts.');

    const seats = Number(body.seats);
    if (!Number.isFinite(seats) || seats < 1) {
      throw new UnprocessableError('How many seats are being contested?');
    }

    const election = await prisma.election.create({
      data: {
        association_id: associationId,
        committee_id:   committee.id,
        title:          body.title.trim(),
        seats,
        term_starts_on: starts,
        term_ends_on:   ends,
      },
      select: electionSelect,
    });

    await auditService.record({
      entity_type: 'election', entity_id: election.id, action: AuditAction.CREATE,
      association_id: associationId, performed_by: userId,
      summary: `Election created for ${committee.name}: ${seats} seats`,
    });

    return { data: election };
  }

  async setStatus(associationId: string, electionId: string, next: ElectionStatus, userId: string) {
    const election = await this.mustFind(associationId, electionId);

    if (!NEXT[election.status].includes(next)) {
      throw new UnprocessableError(
        `An election at "${election.status.toLowerCase().replace(/_/g, ' ')}" cannot move to ` +
        `"${next.toLowerCase().replace(/_/g, ' ')}".`,
      );
    }

    // Opening the ballot with nobody standing produces a meaningless result.
    if (next === ElectionStatus.VOTING_OPEN) {
      const standing = await prisma.electionCandidate.count({
        where: { election_id: electionId, status: NominationStatus.ACCEPTED },
      });
      if (standing === 0) {
        throw new UnprocessableError('No candidate has accepted a nomination, so there is nothing to vote on.');
      }
      if (standing <= election.seats) {
        // Not an error — an uncontested election is a real outcome. Say so
        // rather than pretending a ballot is meaningful.
        await auditService.record({
          entity_type: 'election', entity_id: electionId, action: AuditAction.UPDATE,
          association_id: associationId, performed_by: userId,
          summary: `Voting opened with ${standing} candidates for ${election.seats} seats — uncontested`,
        });
      }
    }

    const updated = await prisma.election.update({
      where: { id: electionId }, data: { status: next }, select: electionSelect,
    });

    await auditService.record({
      entity_type: 'election', entity_id: electionId, action: AuditAction.UPDATE,
      association_id: associationId, performed_by: userId,
      summary: `Election "${election.title}" moved to ${next}`,
    });

    return { data: updated };
  }

  // ── Nominations ─────────────────────────────────────────────────────────────

  /**
   * Propose a candidate.
   *
   * Eligibility comes from the register: only a member of record may stand.
   * A flat cannot propose itself — the point of a proposer is that somebody
   * else thinks you should stand.
   */
  async propose(associationId: string, electionId: string, proposerUnitId: string, candidateUserId: string) {
    const election = await this.mustFind(associationId, electionId);
    if (election.status !== ElectionStatus.NOMINATIONS_OPEN) {
      throw new UnprocessableError('Nominations are not open.');
    }

    const candidate = await prisma.user.findFirst({
      where:  { id: candidateUserId, association_id: associationId, is_active: true, deleted_at: null },
      select: { id: true, name: true, unit_id: true },
    });
    if (!candidate?.unit_id) {
      throw new UnprocessableError('A candidate must be linked to a flat.');
    }

    const voter = await membershipService.voterFor(associationId, candidate.unit_id);
    if (voter !== candidate.id) {
      throw new UnprocessableError(
        `${candidate.name} is not the member of record for their flat, so cannot stand. ` +
        `The register decides who may stand and who may vote.`,
      );
    }
    if (candidate.unit_id === proposerUnitId) {
      throw new UnprocessableError('A nomination must be proposed by a different flat.');
    }

    const created = await prisma.electionCandidate.create({
      data: {
        election_id:         electionId,
        user_id:             candidate.id,
        unit_id:             candidate.unit_id,
        proposed_by_unit_id: proposerUnitId,
        status:              NominationStatus.PROPOSED,
      },
      select: candidateSelect,
    });

    return { data: created };
  }

  /** Second an existing nomination. A third flat, distinct from the other two. */
  async second(associationId: string, candidateId: string, seconderUnitId: string) {
    const c = await this.mustFindCandidate(associationId, candidateId);

    if (c.election.status !== ElectionStatus.NOMINATIONS_OPEN) {
      throw new UnprocessableError('Nominations are not open.');
    }
    if (c.status !== NominationStatus.PROPOSED) {
      throw new UnprocessableError('This nomination has already been seconded.');
    }
    if (seconderUnitId === c.unit_id || seconderUnitId === c.proposed_by_unit_id) {
      throw new UnprocessableError(
        'A seconder must be a different flat from the candidate and the proposer.',
      );
    }

    return { data: await prisma.electionCandidate.update({
      where: { id: candidateId },
      data:  {
        status:              NominationStatus.SECONDED,
        seconded_by_unit_id: seconderUnitId,
        seconded_at:         new Date(),
      },
      select: candidateSelect,
    }) };
  }

  /** The candidate accepts, and stands. Nobody can be made to stand. */
  async accept(associationId: string, candidateId: string, userId: string, statement?: string) {
    const c = await this.mustFindCandidate(associationId, candidateId);

    if (c.user_id !== userId) throw new ForbiddenError('Only the candidate can accept their nomination.');
    if (c.status !== NominationStatus.SECONDED) {
      throw new UnprocessableError('A nomination must be seconded before it can be accepted.');
    }

    return { data: await prisma.electionCandidate.update({
      where: { id: candidateId },
      data:  {
        status:      NominationStatus.ACCEPTED,
        accepted_at: new Date(),
        statement:   statement?.trim() || null,
      },
      select: candidateSelect,
    }) };
  }

  /** Stand down, or be ruled ineligible. Kept on the record either way. */
  async withdraw(associationId: string, candidateId: string, userId: string, byOrganiser: boolean) {
    const c = await this.mustFindCandidate(associationId, candidateId);

    if (!byOrganiser && c.user_id !== userId) {
      throw new ForbiddenError('Only the candidate, or an organiser, can withdraw a nomination.');
    }
    if (c.election.status === ElectionStatus.VOTING_OPEN) {
      throw new UnprocessableError(
        'Voting has started and ballots may already name this candidate. ' +
        'A withdrawal now would change what people voted on.',
      );
    }

    return { data: await prisma.electionCandidate.update({
      where: { id: candidateId },
      data:  { status: byOrganiser ? NominationStatus.REJECTED : NominationStatus.WITHDRAWN },
      select: candidateSelect,
    }) };
  }

  // ── Voting ──────────────────────────────────────────────────────────────────

  /**
   * Cast a ballot.
   *
   * Two rows in one transaction: the anonymous ballot with its choices, and a
   * roll entry saying this flat has voted. The unique index on the roll is
   * what prevents a second ballot — the ballot itself cannot know whose it is.
   */
  async castBallot(
    associationId: string, electionId: string,
    unitId: string, userId: string, candidateIds: string[],
  ) {
    const election = await this.mustFind(associationId, electionId);
    if (election.status !== ElectionStatus.VOTING_OPEN) {
      throw new UnprocessableError('Voting is not open.');
    }

    // The register decides who votes, exactly as for a general body meeting.
    const voter = await membershipService.voterFor(associationId, unitId);
    if (voter && voter !== userId) {
      throw new ForbiddenError(
        'Your flat\'s ballot is cast by the member on the register.',
      );
    }

    const unique = [...new Set(candidateIds)];
    if (unique.length === 0) throw new UnprocessableError('Choose at least one candidate.');
    if (unique.length > election.seats) {
      throw new UnprocessableError(
        `There are ${election.seats} seats, so you may choose at most ${election.seats} candidates.`,
      );
    }

    const valid = await prisma.electionCandidate.count({
      where: { id: { in: unique }, election_id: electionId, status: NominationStatus.ACCEPTED },
    });
    if (valid !== unique.length) {
      throw new UnprocessableError('One of those candidates is not standing in this election.');
    }

    const already = await prisma.electionVoterRoll.findUnique({
      where: { election_id_unit_id: { election_id: electionId, unit_id: unitId } },
      select: { id: true },
    });
    if (already) {
      throw new UnprocessableError(
        'A ballot has already been cast for your flat. A secret ballot cannot be found again to change it.',
      );
    }

    await prisma.$transaction(async tx => {
      await tx.electionBallot.create({
        data: {
          election_id: electionId,
          choices: { create: unique.map(candidate_id => ({ candidate_id })) },
        },
      });
      // Written second so a failure leaves no roll entry, letting them retry.
      // The reverse order would mark them as having voted with no ballot.
      await tx.electionVoterRoll.create({
        data: { election_id: electionId, unit_id: unitId },
      });
    });

    return { data: { cast: true } };
  }

  /** Count the ballots. Never exposed while voting is open. */
  private async tally(electionId: string, seats: number) {
    const rows = await prisma.electionBallotChoice.groupBy({
      by:     ['candidate_id'],
      where:  { ballot: { election_id: electionId } },
      _count: { _all: true },
    });

    const byCandidate = new Map(rows.map(r => [r.candidate_id, r._count._all]));

    const candidates = await prisma.electionCandidate.findMany({
      where:  { election_id: electionId, status: NominationStatus.ACCEPTED },
      select: candidateSelect,
    });

    const scored = candidates
      .map(c => ({ ...c, votes: byCandidate.get(c.id) ?? 0 }))
      .sort((a, b) => b.votes - a.votes || a.user.name.localeCompare(b.user.name));

    // A tie on the last seat is not something software should decide. The
    // boundary is reported and the bye-laws — usually a draw of lots at the
    // meeting — settle it.
    const cutoff = scored[seats - 1]?.votes ?? 0;
    const tiedAtCutoff = scored.filter(c => c.votes === cutoff).length;
    const clearWinners = scored.filter(c => c.votes > cutoff).length;
    const tied = tiedAtCutoff > 1 && clearWinners + tiedAtCutoff > seats;

    return {
      standing: scored,
      elected:  tied ? [] : scored.slice(0, seats).map(c => c.id),
      tied,
      tie_at_votes: tied ? cutoff : null,
    };
  }

  /**
   * Declare the result.
   *
   * One transaction: the outgoing members' terms end and the winners are
   * appointed. Doing it in two steps would allow a committee that is briefly
   * empty or briefly doubled.
   */
  async declare(associationId: string, electionId: string, userId: string) {
    const election = await this.mustFind(associationId, electionId);
    if (election.status !== ElectionStatus.VOTING_CLOSED) {
      throw new UnprocessableError('Close the voting before declaring a result.');
    }

    const result = await this.tally(electionId, election.seats);
    if (result.tied) {
      throw new UnprocessableError(
        `The result is tied at ${result.tie_at_votes} votes for the last seat. ` +
        `Settle it under your bye-laws, then record the outcome by appointing members directly.`,
      );
    }

    const committee = await prisma.committee.findUniqueOrThrow({
      where:  { id: election.committee_id },
      select: { id: true, name: true, is_managing: true },
    });

    // The managing committee's roster is derived from user roles, so there are
    // no seats to write. Declaring still records the result; the manager
    // changes roles in Manage Users.
    if (committee.is_managing) {
      await prisma.election.update({
        where: { id: electionId },
        data:  { status: ElectionStatus.DECLARED, declared_at: new Date(), declared_by_id: userId },
      });

      await auditService.record({
        entity_type: 'election', entity_id: electionId, action: AuditAction.APPROVE,
        association_id: associationId, performed_by: userId,
        summary: `Result declared for "${election.title}". The managing committee's roster follows ` +
                 `user roles, so the winners must be given the Committee role in Manage Users.`,
      });

      return { data: { ...result, roster_updated: false } };
    }

    await prisma.$transaction(async tx => {
      await tx.committeeMember.updateMany({
        where: { committee_id: committee.id, ended_on: null },
        data:  { ended_on: election.term_starts_on, is_convenor: false },
      });

      for (const id of result.elected) {
        const c = result.standing.find(x => x.id === id)!;
        await tx.committeeMember.upsert({
          where:  { committee_id_user_id: { committee_id: committee.id, user_id: c.user.id } },
          create: {
            committee_id: committee.id, user_id: c.user.id,
            appointed_on: election.term_starts_on, ended_on: null,
          },
          update: { appointed_on: election.term_starts_on, ended_on: null, is_convenor: false },
        });
      }

      await tx.election.update({
        where: { id: electionId },
        data:  { status: ElectionStatus.DECLARED, declared_at: new Date(), declared_by_id: userId },
      });
    });

    await auditService.record({
      entity_type: 'election', entity_id: electionId, action: AuditAction.APPROVE,
      association_id: associationId, performed_by: userId,
      summary: `Result declared for "${election.title}": ` +
               result.standing.filter(c => result.elected.includes(c.id))
                 .map(c => `${c.user.name} (${c.votes})`).join(', ') +
               ` — ${committee.name} roster replaced`,
    });

    return { data: { ...result, roster_updated: true } };
  }

  private async mustFind(associationId: string, electionId: string) {
    const e = await prisma.election.findFirst({
      where: { id: electionId, association_id: associationId },
    });
    if (!e) throw new NotFoundError('Election');
    return e;
  }

  private async mustFindCandidate(associationId: string, candidateId: string) {
    const c = await prisma.electionCandidate.findFirst({
      where:   { id: candidateId, election: { association_id: associationId } },
      include: { election: { select: { id: true, status: true, seats: true } } },
    });
    if (!c) throw new NotFoundError('Candidate');
    return c;
  }
}

export const electionService = new ElectionService();
