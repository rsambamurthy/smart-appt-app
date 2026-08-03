import { Router } from 'express';
import {
  UserRole, ModuleKey, MeetingStatus, MeetingType, RsvpStatus, VoteChoice,
} from '@prisma/client';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { requireModule, requireModuleFull } from '../../middleware/entitlement';
import { AuthRequest } from '../../types';
import { UnprocessableError } from '../../utils/errors';
import { governanceService } from './governance.service';

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

/** The flat a resident answers for. Committee members without a flat cannot vote. */
const unitOf = (req: AuthRequest): string => {
  const unitId = req.user!.unit_id;
  if (!unitId) {
    throw new UnprocessableError(
      'Voting and RSVP are by flat, and your account is not linked to one. ' +
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
      req.user!.association_id, req.user!.unit_id ?? null,
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
      req.user!.association_id, req.params['id'] as string, req.user!.unit_id ?? null,
    ));
  } catch (err) { next(err); }
});

router.post('/meetings', requireRoles(...organiserRoles), async (req: AuthRequest, res, next) => {
  try {
    const { title, meeting_type, scheduled_at } = req.body ?? {};
    if (!title?.trim())  throw new UnprocessableError('Give the meeting a title.');
    if (!scheduled_at)   throw new UnprocessableError('Set the date and time.');

    res.status(201).json(await governanceService.createMeeting(
      req.user!.association_id, req.user!.id,
      { ...req.body, meeting_type: enumOr(MeetingType, meeting_type, 'meeting_type') },
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
      unitOf(req), req.user!.id, enumOr(RsvpStatus, req.body?.status, 'status'),
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
    const { unit_id, attended } = req.body ?? {};
    if (!unit_id) throw new UnprocessableError('Which flat?');
    res.json(await governanceService.markAttendance(
      req.user!.association_id, req.params['id'] as string, unit_id, attended !== false,
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
