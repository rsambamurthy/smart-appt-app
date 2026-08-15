import { Router, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth';
import { AuthRequest } from '../../types';
import { ForbiddenError } from '../../utils/errors';
import { parsePagination } from '../../utils/helpers';
import { chatService } from './chat.service';

const router = Router();
router.use(authenticate);

/**
 * Who chat is for.
 *
 * `requireRoles` (used everywhere else in this app) always waves SUPER_USER
 * through, on the reasoning that a platform administrator can reach
 * anything. Chat is the one place that reasoning does not apply — a
 * platform administrator has no legitimate reason to read residents'
 * conversations at all, so this checks the role list directly instead of
 * going through that middleware. GATE_STAFF is excluded the ordinary way:
 * simply not in the list, same as every other resident-facing screen they
 * have no reason to see.
 */
const CHAT_ROLES: UserRole[] = [
  UserRole.RESIDENT, UserRole.COMMITTEE, UserRole.TREASURER, UserRole.MANAGER,
];
router.use((req: AuthRequest, _res: Response, next: NextFunction) => {
  if (!CHAT_ROLES.includes(req.user!.role)) {
    return next(new ForbiddenError('Chat is between association members.'));
  }
  next();
});

// ── Directory ────────────────────────────────────────────────────────────────

router.get('/directory', async (req: AuthRequest, res, next) => {
  try { res.json(await chatService.directory(req.user!.association_id, req.user!.id)); }
  catch (err) { next(err); }
});

// ── Channels ─────────────────────────────────────────────────────────────────

router.get('/channels', async (req: AuthRequest, res, next) => {
  try { res.json(await chatService.listChannels(req.user!.association_id, req.user!.id)); }
  catch (err) { next(err); }
});

router.post('/channels/direct', async (req: AuthRequest, res, next) => {
  try {
    const otherId = String(req.body?.user_id ?? '');
    res.json(await chatService.getOrCreateDirectChannel(req.user!.association_id, req.user!.id, otherId));
  } catch (err) { next(err); }
});

router.post('/channels/group', async (req: AuthRequest, res, next) => {
  try {
    res.json(await chatService.createGroup(req.user!.association_id, req.user!.id, req.body ?? {}));
  } catch (err) { next(err); }
});

router.patch('/channels/:id', async (req: AuthRequest, res, next) => {
  try { res.json(await chatService.renameGroup(req.params.id!, req.user!.id, req.body?.name)); }
  catch (err) { next(err); }
});

router.post('/channels/:id/members', async (req: AuthRequest, res, next) => {
  try {
    const userId = String(req.body?.user_id ?? '');
    res.json(await chatService.addMember(req.user!.association_id, req.params.id!, req.user!.id, userId));
  } catch (err) { next(err); }
});

router.delete('/channels/:id/members/:userId', async (req: AuthRequest, res, next) => {
  try { res.json(await chatService.removeMember(req.params.id!, req.user!.id, req.params.userId!)); }
  catch (err) { next(err); }
});

router.post('/channels/:id/leave', async (req: AuthRequest, res, next) => {
  try { res.json(await chatService.leaveGroup(req.params.id!, req.user!.id)); }
  catch (err) { next(err); }
});

// ── Messages ─────────────────────────────────────────────────────────────────

router.get('/channels/:id/messages', async (req: AuthRequest, res, next) => {
  try {
    const { cursor, limit } = parsePagination(req.query as { cursor?: string; limit?: string });
    res.json(await chatService.listMessages(req.params.id!, req.user!.id, { cursor, limit: limit ?? 30 }));
  } catch (err) { next(err); }
});

router.post('/channels/:id/messages', async (req: AuthRequest, res, next) => {
  try {
    res.json(await chatService.sendMessage(
      req.user!.association_id, req.params.id!, req.user!.id, req.user!.name, req.body ?? {},
    ));
  } catch (err) { next(err); }
});

router.post('/channels/:id/read', async (req: AuthRequest, res, next) => {
  try { res.json(await chatService.markRead(req.params.id!, req.user!.id)); }
  catch (err) { next(err); }
});

export default router;
