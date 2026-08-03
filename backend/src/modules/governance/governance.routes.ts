import { Router } from 'express';
import {
  UserRole, ModuleKey, MeetingStatus, MeetingType, RsvpStatus, VoteChoice,
} from '@prisma/client';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { requireModule, requireModuleFull } from '../../middleware/entitlement';
import { AuthRequest } from '../../types';
import { UnprocessableError, ForbiddenError } from '../../utils/errors';
import { governanceService } from './governance.service';
import { committeeService } from './committee.service';

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
