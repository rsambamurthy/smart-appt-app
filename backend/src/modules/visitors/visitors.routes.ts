import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { visitorsService } from './visitors.service';
import { parsePagination } from '../../utils/helpers';
import { UnprocessableError } from '../../utils/errors';
import { AuthRequest } from '../../types';

const router = Router();
router.use(authenticate);

// All authenticated users can pre-approve visitors (mobile — no role difference)
router.post('/preapprove', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user!.unit_id) throw new UnprocessableError('No unit associated.');
    res.status(201).json(await visitorsService.preApprove(req.user!.association_id, req.user!.id, req.user!.unit_id, req.body));
  } catch (err) { next(err); }
});

router.post('/walkin', requireRoles(UserRole.GATE_STAFF), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await visitorsService.walkIn(req.user!.association_id, req.user!.id, req.body)); }
  catch (err) { next(err); }
});

router.get('/log', requireRoles(UserRole.MANAGER, UserRole.GATE_STAFF), async (req: AuthRequest, res, next) => {
  try {
    const { cursor, limit } = parsePagination(req.query as never);
    res.json(await visitorsService.getLog(req.user!.association_id, {
      cursor, limit,
      unit_id: req.query['unit_id'] as string,
      date: req.query['date'] as string,
      visit_type: req.query['visit_type'] as string,
      status: req.query['status'] as string,
    }));
  } catch (err) { next(err); }
});

// All authenticated users can manage their own frequent visitors
router.get('/frequent/my', async (req: AuthRequest, res, next) => {
  try { res.json(await visitorsService.listFrequentVisitors(req.user!.association_id, req.user!.id)); }
  catch (err) { next(err); }
});

router.post('/frequent', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user!.unit_id) throw new UnprocessableError('No unit associated.');
    res.status(201).json(await visitorsService.addFrequentVisitor(req.user!.association_id, req.user!.id, req.user!.unit_id, req.body));
  } catch (err) { next(err); }
});

router.patch('/frequent/:id', async (req: AuthRequest, res, next) => {
  try { res.json(await visitorsService.updateFrequentVisitor(req.user!.association_id, req.params['id'], req.user!.id, req.body)); }
  catch (err) { next(err); }
});

router.post('/emergency', requireRoles(UserRole.GATE_STAFF), async (req: AuthRequest, res, next) => {
  try { res.json(await visitorsService.triggerEmergency(req.user!.association_id, req.user!.id, req.body)); }
  catch (err) { next(err); }
});

router.get('/qr/:token', requireRoles(UserRole.GATE_STAFF), async (req: AuthRequest, res, next) => {
  try { res.json(await visitorsService.lookupByQr(req.user!.association_id, req.params['token'])); }
  catch (err) { next(err); }
});

router.post('/:id/approve', async (req: AuthRequest, res, next) => {
  try { res.json(await visitorsService.approveVisitor(req.user!.association_id, req.params['id'], req.user!.id, req.body.decision)); }
  catch (err) { next(err); }
});

router.post('/:id/entry', requireRoles(UserRole.GATE_STAFF), async (req: AuthRequest, res, next) => {
  try { res.json(await visitorsService.recordEntry(req.user!.association_id, req.params['id'])); }
  catch (err) { next(err); }
});

router.post('/:id/exit', requireRoles(UserRole.GATE_STAFF), async (req: AuthRequest, res, next) => {
  try { res.json(await visitorsService.recordExit(req.user!.association_id, req.params['id'])); }
  catch (err) { next(err); }
});

export default router;
