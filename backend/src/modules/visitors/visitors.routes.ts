import { Router } from 'express';
import multer from 'multer';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { visitorsService } from './visitors.service';
import { parsePagination } from '../../utils/helpers';
import { UnprocessableError } from '../../utils/errors';
import { AuthRequest } from '../../types';

const router = Router();
router.use(authenticate);

// Gate photos come straight off a phone camera. 5 MB is generous for a single
// snap and keeps a mis-selected video out of the database.
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024, files: 1 },
});

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

// Visitor log is readable by every authenticated member of the association.
// (Write actions — walk-in, approve, check-in/out — remain role-restricted.)
router.get('/log', async (req: AuthRequest, res, next) => {
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

// Visitors waiting on THIS resident's decision, plus what happened recently.
// Declared before '/:id' so 'my-requests' is not read as a visitor id.
router.get('/my-requests', async (req: AuthRequest, res, next) => {
  try { res.json(await visitorsService.getMyVisitorRequests(req.user!.association_id, req.user!.id)); }
  catch (err) { next(err); }
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

// ── Gate console ──────────────────────────────────────────────────────────────
// Declared before '/:id' routes so 'gate' is never read as a visitor id.
router.get('/gate/units', requireRoles(UserRole.GATE_STAFF, UserRole.MANAGER), async (req: AuthRequest, res, next) => {
  try { res.json(await visitorsService.getGateUnits(req.user!.association_id)); }
  catch (err) { next(err); }
});

router.get('/gate/board', requireRoles(UserRole.GATE_STAFF, UserRole.MANAGER), async (req: AuthRequest, res, next) => {
  try { res.json(await visitorsService.getGateBoard(req.user!.association_id)); }
  catch (err) { next(err); }
});

// ── Deliveries ────────────────────────────────────────────────────────────────
router.post('/delivery', requireRoles(UserRole.GATE_STAFF, UserRole.MANAGER), async (req: AuthRequest, res, next) => {
  try {
    const { unit_id, provider, handling } = req.body ?? {};
    if (!unit_id)  throw new UnprocessableError('Choose the flat the delivery is for.');
    if (!provider) throw new UnprocessableError('Choose the delivery company.');
    if (handling !== 'AT_GATE' && handling !== 'SENT_UP') {
      throw new UnprocessableError('handling must be AT_GATE or SENT_UP.');
    }
    res.status(201).json(await visitorsService.logDelivery(req.user!.association_id, req.user!.id, req.body));
  } catch (err) { next(err); }
});

router.post('/:id/collected', requireRoles(UserRole.GATE_STAFF, UserRole.MANAGER), async (req: AuthRequest, res, next) => {
  try { res.json(await visitorsService.markDeliveryCollected(req.user!.association_id, req.params['id'] as string)); }
  catch (err) { next(err); }
});

// ── Visitor photo ─────────────────────────────────────────────────────────────
router.post('/:id/photo', requireRoles(UserRole.GATE_STAFF, UserRole.MANAGER), photoUpload.single('photo'), async (req: AuthRequest, res, next) => {
  try {
    const file = (req as never as { file?: { buffer: Buffer; mimetype: string } }).file;
    if (!file) throw new UnprocessableError('No photo was uploaded.');
    res.json(await visitorsService.attachPhoto(req.user!.association_id, req.params['id'] as string, file));
  } catch (err) { next(err); }
});

// Readable by staff and by residents (their own flat's visitors are shown in
// the app). Bytes are streamed straight out; they never appear in a list.
router.get('/:id/photo', async (req: AuthRequest, res, next) => {
  try {
    const v = await visitorsService.getPhoto(req.user!.association_id, req.params['id'] as string);
    res.setHeader('Content-Type', v.photo_mime ?? 'image/jpeg');
    res.setHeader('Content-Length', v.photo_data!.length);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.end(v.photo_data);
  } catch (err) { next(err); }
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
