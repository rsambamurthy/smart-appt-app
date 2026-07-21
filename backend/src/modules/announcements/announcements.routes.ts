import { Router } from 'express';
import multer from 'multer';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { announcementsService } from './announcements.service';
import { parsePagination } from '../../utils/helpers';
import { AuthRequest } from '../../types';

const router = Router();
router.use(authenticate);

const upload = multer({ storage: multer.memoryStorage(), limits: { files: 5, fileSize: 20 * 1024 * 1024 } });

// ── Polls (must come before /:id wildcard) ────────────────────────────────────
router.post('/polls', requireRoles(UserRole.MANAGER, UserRole.COMMITTEE), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await announcementsService.createPoll(req.user!.association_id, req.body, req.user!.id)); }
  catch (err) { next(err); }
});

router.post('/polls/:id/vote', requireRoles(UserRole.RESIDENT, UserRole.COMMITTEE), async (req: AuthRequest, res, next) => {
  try { res.json(await announcementsService.vote(req.user!.association_id, req.params['id'], req.user!.id, req.body.answer)); }
  catch (err) { next(err); }
});

router.get('/polls/:id/results', async (req: AuthRequest, res, next) => {
  try { res.json(await announcementsService.getPollResults(req.user!.association_id, req.params['id'])); }
  catch (err) { next(err); }
});

// ── Documents (must come before /:id wildcard) ────────────────────────────────
router.post('/documents', requireRoles(UserRole.MANAGER, UserRole.COMMITTEE), upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    const file = req.file ?? undefined;
    const fileInfo = file
      ? { buffer: file.buffer, originalname: file.originalname, mimetype: file.mimetype }
      : null;
    res.status(201).json(await announcementsService.uploadDocument(req.user!.association_id, req.body, fileInfo, req.user!.id));
  } catch (err) { next(err); }
});

router.get('/documents', async (req: AuthRequest, res, next) => {
  try { res.json(await announcementsService.listDocuments(req.user!.association_id, req.query['category'] as string)); }
  catch (err) { next(err); }
});

router.delete('/documents/:id', requireRoles(UserRole.MANAGER), async (req: AuthRequest, res, next) => {
  try { res.json(await announcementsService.deactivateDocument(req.user!.association_id, req.params['id'])); }
  catch (err) { next(err); }
});

router.get('/documents/:id/download', async (req: AuthRequest, res, next) => {
  try {
    const doc = await announcementsService.getDocumentFile(req.user!.association_id, req.params['id']);
    if (!doc.file_data) {
      res.status(404).json({ title: 'File not found', detail: 'No file data stored for this document.' });
      return;
    }
    const filename = doc.file_name ?? doc.title ?? 'document';
    const mimeType = doc.mime_type ?? 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Length', doc.file_data.length);
    res.end(doc.file_data);
  } catch (err) { next(err); }
});

// ── Announcements ─────────────────────────────────────────────────────────────
router.post('/', requireRoles(UserRole.MANAGER, UserRole.COMMITTEE), upload.array('files', 5), async (req: AuthRequest, res, next) => {
  try {
    const files = (req.files as Express.Multer.File[]) ?? [];
    const keys = files.map((f) => (f as unknown as { key: string }).key ?? f.originalname);
    res.status(201).json(await announcementsService.post(req.user!.association_id, req.body, req.user!.id, keys));
  } catch (err) { next(err); }
});

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { cursor, limit } = parsePagination(req.query as never);
    res.json(await announcementsService.list(req.user!.association_id, {
      cursor, limit,
      category: req.query['category'] as string,
      date_from: req.query['date_from'] as string,
      date_to: req.query['date_to'] as string,
    }));
  } catch (err) { next(err); }
});

// ── Wildcard /:id routes last ─────────────────────────────────────────────────
router.get('/:id', async (req: AuthRequest, res, next) => {
  try { res.json(await announcementsService.getOne(req.user!.association_id, req.params['id'])); }
  catch (err) { next(err); }
});

router.post('/:id/read', requireRoles(UserRole.RESIDENT, UserRole.COMMITTEE), async (req: AuthRequest, res, next) => {
  try { res.json(await announcementsService.markRead(req.user!.association_id, req.params['id'], req.user!.id)); }
  catch (err) { next(err); }
});

router.get('/:id/reads', requireRoles(UserRole.MANAGER), async (req: AuthRequest, res, next) => {
  try { res.json(await announcementsService.getReadReceipts(req.user!.association_id, req.params['id'])); }
  catch (err) { next(err); }
});

export default router;
