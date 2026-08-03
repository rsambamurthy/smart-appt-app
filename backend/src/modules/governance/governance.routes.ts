import { Router } from 'express';
import {
  UserRole, ModuleKey, MeetingStatus, MeetingType, RsvpStatus, VoteChoice,
  ElectionStatus,
} from '@prisma/client';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { requireModule, requireModuleFull } from '../../middleware/entitlement';
import { AuthRequest } from '../../types';
import { UnprocessableError, ForbiddenError } from '../../utils/errors';
import { governanceService } from './governance.service';
import { committeeService } from './committee.service';
import { membershipService } from './membership.service';
import { electionService } from './election.service';

const router = Router();
router.use(authenticate);

// Governance is a paid module. At the router, so every endpoint below is
// covered including any added later. Reads survive a lapsed subscription;
// writes and reports do not.
router.use(requireModule(ModuleKey.GOVERNANCE));

// Who runs meetings. Residents read and take part but do not organise.
const organiserRoles = [UserRole.MANAGER, UserRole.COMMITTEE, UserRole.SUPER_USER];

const enumOr = <T extends Record<string, string>>(e: T, v: unknown, field: string): T[keyof T] => {
  if (typeof v === 'string' && Object.values(e).includes(v)) return v as T[keyof T];
  throw new UnprocessableError(`${field} must be one of: ${Object.values(e).join(', ')}.`);
};

/**
 * The flat a resident answers for, if they have one.
 *
 * Nullable on purpose: a committee member votes as a person and may hold no
 * flat at all. The service decides whether the absence matters, because only
 * it knows whether the meeting is general body or committee.
 */
const unitOf = (req: AuthRequest): string | null => req.user!.unit_id ?? null;

/** RSVP is by flat for a general body meeting, so this one does insist. */
const requireUnit = (req: AuthRequest): string => {
  const unitId = req.user!.unit_id;
  if (!unitId) {
    throw new UnprocessableError(
      'RSVP is by flat, and your account is not linked to one. ' +
      'Ask your manager to link it.',
    );
  }
  return unitId;
};

// ── Settings ──────────────────────────────────────────────────────────────────

router.get('/config', requireRoles(...organiserRoles), async (req: AuthRequest, res, next) => {
  try { res.json(await governanceService.getConfig(req.user!.association_id)); }
  catch (err) { next(err); }
});

router.patch('/config', requireRoles(UserRole.MANAGER, UserRole.SUPER_USER), async (req: AuthRequest, res, next) => {
  try { res.json(await governanceService.updateConfig(req.user!.association_id, req.body ?? {})); }
  catch (err) { next(err); }
});

// ── Resident view ─────────────────────────────────────────────────────────────
// Declared before '/:id' so 'my' is not read as a meeting id.

router.get('/meetings/my', async (req: AuthRequest, res, next) => {
  try {
    res.json(await governanceService.listForResident(
      req.user!.association_id, req.user!.unit_id ?? null, req.user!.id,
    ));
  } catch (err) { next(err); }
});

// ── Meetings ──────────────────────────────────────────────────────────────────

router.get('/meetings', requireRoles(...organiserRoles), async (req: AuthRequest, res, next) => {
  try {
    res.json(await governanceService.listMeetings(req.user!.association_id, {
      status:   req.query['status'] as string,
      upcoming: req.query['upcoming'] === 'true',
    }));
  } catch (err) { next(err); }
});

// Readable by everyone: a resident needs the agenda to decide how to vote.
// The service scopes vote visibility to the caller's own flat.
router.get('/meetings/:id', async (req: AuthRequest, res, next) => {
  try {
    res.json(await governanceService.getMeeting(
      req.user!.association_id, req.params['id'] as string,
      req.user!.unit_id ?? null, req.user!.id,
    ));
  } catch (err) { next(err); }
});

router.post('/meetings', requireRoles(...organiserRoles), async (req: AuthRequest, res, next) => {
  try {
    const { title, meeting_type, scheduled_at, committee_id } = req.body ?? {};
    if (!title?.trim())  throw new UnprocessableError('Give the meeting a title.');
    if (!scheduled_at)   throw new UnprocessableError('Set the date and time.');

    const type = enumOr(MeetingType, meeting_type, 'meeting_type');

    if (type === MeetingType.COMMITTEE) {
      // A committee's own convenor may call its meetings; a manager may call
      // anyone's.
      await committeeService.assertCanConvene(
        req.user!.association_id, String(committee_id), req.user!,
      );
    } else if (req.user!.role !== UserRole.MANAGER && req.user!.role !== UserRole.SUPER_USER) {
      // A general body meeting binds the whole association, so calling one is
      // reserved to the manager.
      throw new ForbiddenError('Only a manager can call a general body meeting.');
    }

    res.status(201).json(await governanceService.createMeeting(
      req.user!.association_id, req.user!.id, { ...req.body, meeting_type: type },
    ));
  } catch (err) { next(err); }
});

router.patch('/meetings/:id', requireRoles(...organiserRoles), async (req: AuthRequest, res, next) => {
  try {
    res.json(await governanceService.updateMeeting(
      req.user!.association_id, req.params['id'] as string, req.body ?? {},
    ));
  } catch (err) { next(err); }
});

router.post('/meetings/:id/notice', requireRoles(...organiserRoles), async (req: AuthRequest, res, next) => {
  try {
    res.json(await governanceService.issueNotice(
      req.user!.association_id, req.params['id'] as string, req.user!.id,
    ));
  } catch (err) { next(err); }
});

router.post('/meetings/:id/status', requireRoles(...organiserRoles), async (req: AuthRequest, res, next) => {
  try {
    res.json(await governanceService.setStatus(
      req.user!.association_id, req.params['id'] as string,
      enumOr(MeetingStatus, req.body?.status, 'status'), req.user!.id,
    ));
  } catch (err) { next(err); }
});

// ── Agenda ────────────────────────────────────────────────────────────────────

router.post('/meetings/:id/agenda', requireRoles(...organiserRoles), async (req: AuthRequest, res, next) => {
  try {
    if (!req.body?.title?.trim()) throw new UnprocessableError('Give the agenda item a title.');
    res.status(201).json(await governanceService.addAgendaItem(
      req.user!.association_id, req.params['id'] as string, req.body,
    ));
  } catch (err) { next(err); }
});

router.patch('/agenda/:itemId', requireRoles(...organiserRoles), async (req: AuthRequest, res, next) => {
  try {
    res.json(await governanceService.updateAgendaItem(
      req.user!.association_id, req.params['itemId'] as string, req.body ?? {},
    ));
  } catch (err) { next(err); }
});

router.delete('/agenda/:itemId', requireRoles(...organiserRoles), async (req: AuthRequest, res, next) => {
  try {
    res.json(await governanceService.deleteAgendaItem(
      req.user!.association_id, req.params['itemId'] as string,
    ));
  } catch (err) { next(err); }
});

// ── RSVP and attendance ───────────────────────────────────────────────────────

/** A resident answering for their own flat. */
router.post('/meetings/:id/rsvp', async (req: AuthRequest, res, next) => {
  try {
    res.json(await governanceService.rsvp(
      req.user!.association_id, req.params['id'] as string,
      requireUnit(req), req.user!.id, enumOr(RsvpStatus, req.body?.status, 'status'),
    ));
  } catch (err) { next(err); }
});

router.get('/meetings/:id/register', requireRoles(...organiserRoles), async (req: AuthRequest, res, next) => {
  try {
    res.json(await governanceService.attendanceRegister(
      req.user!.association_id, req.params['id'] as string,
    ));
  } catch (err) { next(err); }
});

router.post('/meetings/:id/attendance', requireRoles(...organiserRoles), async (req: AuthRequest, res, next) => {
  try {
    const { unit_id, user_id, attended } = req.body ?? {};
    res.json(await governanceService.markAttendance(
      req.user!.association_id, req.params['id'] as string,
      { unit_id, user_id }, attended !== false,
    ));
  } catch (err) { next(err); }
});

// ── Voting ────────────────────────────────────────────────────────────────────

router.post('/agenda/:itemId/open', requireRoles(...organiserRoles), async (req: AuthRequest, res, next) => {
  try {
    res.json(await governanceService.openVoting(
      req.user!.association_id, req.params['itemId'] as string, req.user!.id,
    ));
  } catch (err) { next(err); }
});

router.post('/agenda/:itemId/close', requireRoles(...organiserRoles), async (req: AuthRequest, res, next) => {
  try {
    res.json(await governanceService.closeVoting(
      req.user!.association_id, req.params['itemId'] as string, req.user!.id,
    ));
  } catch (err) { next(err); }
});

/** Any resident with a flat, present or not, while voting is open. */
router.post('/agenda/:itemId/vote', async (req: AuthRequest, res, next) => {
  try {
    res.json(await governanceService.castVote(
      req.user!.association_id, req.params['itemId'] as string,
      unitOf(req), req.user!.id, enumOr(VoteChoice, req.body?.choice, 'choice'),
    ));
  } catch (err) { next(err); }
});

/** Who voted how. Refused for a secret ballot. Producing the record is output. */
router.get('/agenda/:itemId/votes',
  requireModuleFull(ModuleKey.GOVERNANCE), requireRoles(...organiserRoles),
  async (req: AuthRequest, res, next) => {
    try {
      res.json(await governanceService.voteBreakdown(
        req.user!.association_id, req.params['itemId'] as string,
      ));
    } catch (err) { next(err); }
  });

// ── Committees ────────────────────────────────────────────────────────────────
// Readable by any signed-in user: a resident should be able to see which
// committees exist and who sits on them. Editing is restricted.

router.get('/committees', async (req: AuthRequest, res, next) => {
  try { res.json(await committeeService.list(req.user!.association_id)); }
  catch (err) { next(err); }
});

router.get('/committees/:id/members', async (req: AuthRequest, res, next) => {
  try {
    res.json({ data: await committeeService.members(
      req.user!.association_id, req.params['id'] as string,
    ) });
  } catch (err) { next(err); }
});

router.post('/committees', requireRoles(UserRole.MANAGER, UserRole.SUPER_USER), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await committeeService.create(req.user!.association_id, req.body ?? {})); }
  catch (err) { next(err); }
});

router.patch('/committees/:id', requireRoles(UserRole.MANAGER, UserRole.SUPER_USER), async (req: AuthRequest, res, next) => {
  try {
    res.json(await committeeService.update(
      req.user!.association_id, req.params['id'] as string, req.body ?? {},
    ));
  } catch (err) { next(err); }
});

router.post('/committees/:id/members', requireRoles(UserRole.MANAGER, UserRole.SUPER_USER), async (req: AuthRequest, res, next) => {
  try {
    const { user_id, is_convenor } = req.body ?? {};
    if (!user_id) throw new UnprocessableError('Choose who to appoint.');
    res.status(201).json(await committeeService.addMember(
      req.user!.association_id, req.params['id'] as string, user_id, is_convenor === true,
    ));
  } catch (err) { next(err); }
});

router.delete('/committees/:id/members/:userId', requireRoles(UserRole.MANAGER, UserRole.SUPER_USER), async (req: AuthRequest, res, next) => {
  try {
    res.json(await committeeService.endMembership(
      req.user!.association_id, req.params['id'] as string, req.params['userId'] as string,
    ));
  } catch (err) { next(err); }
});

// ── Elections ─────────────────────────────────────────────────────────────────
//
// Readable by any signed-in member: standing, seconding and voting are all
// things a member does. Running the election is organiser-only.

router.get('/elections', async (req: AuthRequest, res, next) => {
  try { res.json(await electionService.list(req.user!.association_id)); }
  catch (err) { next(err); }
});

router.get('/elections/:id', async (req: AuthRequest, res, next) => {
  try {
    res.json(await electionService.get(
      req.user!.association_id, req.params['id'] as string, req.user!.unit_id ?? null,
    ));
  } catch (err) { next(err); }
});

router.post('/elections', requireRoles(UserRole.MANAGER, UserRole.SUPER_USER), async (req: AuthRequest, res, next) => {
  try {
    const { committee_id, title, seats, term_starts_on, term_ends_on } = req.body ?? {};
    if (!committee_id)   throw new UnprocessableError('Which committee is being elected?');
    if (!title?.trim())  throw new UnprocessableError('Give the election a title.');
    if (!term_starts_on || !term_ends_on) throw new UnprocessableError('Set the term dates.');

    res.status(201).json(await electionService.create(
      req.user!.association_id, req.user!.id,
      { committee_id, title, seats, term_starts_on, term_ends_on },
    ));
  } catch (err) { next(err); }
});

router.post('/elections/:id/status', requireRoles(...organiserRoles), async (req: AuthRequest, res, next) => {
  try {
    res.json(await electionService.setStatus(
      req.user!.association_id, req.params['id'] as string,
      enumOr(ElectionStatus, req.body?.status, 'status'), req.user!.id,
    ));
  } catch (err) { next(err); }
});

/** Declaring replaces the committee roster, so it is manager-only. */
router.post('/elections/:id/declare', requireRoles(UserRole.MANAGER, UserRole.SUPER_USER), async (req: AuthRequest, res, next) => {
  try {
    res.json(await electionService.declare(
      req.user!.association_id, req.params['id'] as string, req.user!.id,
    ));
  } catch (err) { next(err); }
});

// ── Nominations ───────────────────────────────────────────────────────────────

/** A member proposes someone. Never their own flat. */
router.post('/elections/:id/nominations', async (req: AuthRequest, res, next) => {
  try {
    if (!req.body?.user_id) throw new UnprocessableError('Who is being nominated?');
    res.status(201).json(await electionService.propose(
      req.user!.association_id, req.params['id'] as string,
      requireUnit(req), req.body.user_id,
    ));
  } catch (err) { next(err); }
});

router.post('/nominations/:candidateId/second', async (req: AuthRequest, res, next) => {
  try {
    res.json(await electionService.second(
      req.user!.association_id, req.params['candidateId'] as string, requireUnit(req),
    ));
  } catch (err) { next(err); }
});

/** Only the candidate may accept. Nobody can be made to stand. */
router.post('/nominations/:candidateId/accept', async (req: AuthRequest, res, next) => {
  try {
    res.json(await electionService.accept(
      req.user!.association_id, req.params['candidateId'] as string,
      req.user!.id, req.body?.statement,
    ));
  } catch (err) { next(err); }
});

router.post('/nominations/:candidateId/withdraw', async (req: AuthRequest, res, next) => {
  try {
    const byOrganiser = req.user!.role === UserRole.MANAGER
                     || req.user!.role === UserRole.SUPER_USER
                     || req.user!.role === UserRole.COMMITTEE;
    res.json(await electionService.withdraw(
      req.user!.association_id, req.params['candidateId'] as string,
      req.user!.id, byOrganiser && req.body?.as_organiser === true,
    ));
  } catch (err) { next(err); }
});

/** Cast the ballot. One per flat, anonymous, and final. */
router.post('/elections/:id/ballot', async (req: AuthRequest, res, next) => {
  try {
    const ids = req.body?.candidate_ids;
    if (!Array.isArray(ids)) throw new UnprocessableError('Choose your candidates.');
    res.status(201).json(await electionService.castBallot(
      req.user!.association_id, req.params['id'] as string,
      requireUnit(req), req.user!.id, ids,
    ));
  } catch (err) { next(err); }
});

// ── Register of members ───────────────────────────────────────────────────────
//
// Readable by organisers. The register names people who may have no account
// and records nominees, so it is not resident-facing: a member sees their own
// standing through their flat, not by browsing everyone else's.
//
// Editing is manager-only. Membership is a legal record, not an operational
// one — a committee member should not be able to change who owns a flat.

const registrar = [UserRole.MANAGER, UserRole.SUPER_USER];

router.get('/register', requireRoles(...organiserRoles), async (req: AuthRequest, res, next) => {
  try {
    res.json(await membershipService.list(req.user!.association_id, {
      q:        req.query['q'] as string,
      gapsOnly: req.query['gaps'] === 'true',
    }));
  } catch (err) { next(err); }
});

router.get('/register/units/:unitId', requireRoles(...organiserRoles), async (req: AuthRequest, res, next) => {
  try {
    res.json(await membershipService.getForUnit(
      req.user!.association_id, req.params['unitId'] as string,
    ));
  } catch (err) { next(err); }
});

/** Admit a member to a flat that has none. */
router.post('/register/units/:unitId', requireRoles(...registrar), async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await membershipService.admit(
      req.user!.association_id, req.params['unitId'] as string, req.user!.id, req.body ?? {},
    ));
  } catch (err) { next(err); }
});

/** Transfer: closes the outgoing membership and opens the incoming one. */
router.post('/register/units/:unitId/transfer', requireRoles(...registrar), async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await membershipService.transfer(
      req.user!.association_id, req.params['unitId'] as string, req.user!.id, req.body ?? {},
    ));
  } catch (err) { next(err); }
});

router.patch('/register/:membershipId', requireRoles(...registrar), async (req: AuthRequest, res, next) => {
  try {
    res.json(await membershipService.update(
      req.user!.association_id, req.params['membershipId'] as string, req.body ?? {},
    ));
  } catch (err) { next(err); }
});

// ── Holders ───────────────────────────────────────────────────────────────────

router.post('/register/:membershipId/holders', requireRoles(...registrar), async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await membershipService.addHolder(
      req.user!.association_id, req.params['membershipId'] as string, req.body ?? {},
    ));
  } catch (err) { next(err); }
});

/** Move the vote to a different joint holder. */
router.post('/register/:membershipId/holders/:holderId/primary', requireRoles(...registrar), async (req: AuthRequest, res, next) => {
  try {
    res.json(await membershipService.setPrimary(
      req.user!.association_id, req.params['membershipId'] as string, req.params['holderId'] as string,
    ));
  } catch (err) { next(err); }
});

router.delete('/register/:membershipId/holders/:holderId', requireRoles(...registrar), async (req: AuthRequest, res, next) => {
  try {
    res.json(await membershipService.removeHolder(
      req.user!.association_id, req.params['membershipId'] as string, req.params['holderId'] as string,
    ));
  } catch (err) { next(err); }
});

// ── Nominees ──────────────────────────────────────────────────────────────────

router.post('/register/:membershipId/nominees', requireRoles(...registrar), async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await membershipService.addNominee(
      req.user!.association_id, req.params['membershipId'] as string, req.body ?? {},
    ));
  } catch (err) { next(err); }
});

router.delete('/register/:membershipId/nominees/:nomineeId', requireRoles(...registrar), async (req: AuthRequest, res, next) => {
  try {
    res.json(await membershipService.removeNominee(
      req.user!.association_id, req.params['membershipId'] as string, req.params['nomineeId'] as string,
    ));
  } catch (err) { next(err); }
});

// ── Minutes ───────────────────────────────────────────────────────────────────

router.put('/meetings/:id/minutes', requireRoles(...organiserRoles), async (req: AuthRequest, res, next) => {
  try {
    res.json(await governanceService.saveMinutes(
      req.user!.association_id, req.params['id'] as string,
      String(req.body?.body ?? ''), req.body?.publish === true, req.user!.id,
    ));
  } catch (err) { next(err); }
});

export default router;
