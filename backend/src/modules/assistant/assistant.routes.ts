import { Router } from 'express';
import { ModuleKey } from '@prisma/client';
import { authenticate } from '../../middleware/auth';
import { requireModule } from '../../middleware/entitlement';
import { userLimiter } from '../../middleware/rateLimiter';
import { assistantService } from './assistant.service';
import { ToolContext } from './assistant.tools';
import { AuthRequest } from '../../types';

/**
 * Assistant endpoints.
 *
 * `requireModule` sits at the router because the assistant costs real money per
 * message; an association that has not subscribed must not be able to spend it
 * by knowing a URL.
 */

const router = Router();
router.use(authenticate);
router.use(requireModule(ModuleKey.ASSISTANT));
router.use(userLimiter);

/**
 * The only place a ToolContext is built.
 *
 * Every field comes from the verified token. Nothing here is ever taken from
 * the request body or the query string, which is what makes the tool layer's
 * guarantee hold: the model has no way to name a person or an association.
 */
function contextOf(req: AuthRequest): ToolContext {
  const u = req.user!;
  return {
    userId:        u.id,
    associationId: u.association_id,
    role:          u.role,
    unitId:        u.unit_id ?? null,
  };
}

// GET /assistant/conversations
router.get('/conversations', async (req: AuthRequest, res, next) => {
  try {
    res.json(await assistantService.listConversations(contextOf(req)));
  } catch (err) { next(err); }
});

// GET /assistant/conversations/:id
router.get('/conversations/:id', async (req: AuthRequest, res, next) => {
  try {
    res.json(await assistantService.getConversation(contextOf(req), req.params['id'] as string));
  } catch (err) { next(err); }
});

// POST /assistant/ask
router.post('/ask', async (req: AuthRequest, res, next) => {
  try {
    res.json(await assistantService.ask(contextOf(req), {
      message:         String(req.body?.message ?? ''),
      conversation_id: req.body?.conversation_id ? String(req.body.conversation_id) : undefined,
    }));
  } catch (err) { next(err); }
});

// POST /assistant/messages/:id/confirm  — carry out a proposed action
router.post('/messages/:id/confirm', async (req: AuthRequest, res, next) => {
  try {
    res.json(await assistantService.confirmAction(contextOf(req), req.params['id'] as string));
  } catch (err) { next(err); }
});

// POST /assistant/messages/:id/cancel
router.post('/messages/:id/cancel', async (req: AuthRequest, res, next) => {
  try {
    res.json(await assistantService.cancelAction(contextOf(req), req.params['id'] as string));
  } catch (err) { next(err); }
});

export default router;
