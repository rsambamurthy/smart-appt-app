import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../types';
import { duesService } from './dues.service';
import { parsePagination } from '../../utils/helpers';
import { UnprocessableError } from '../../utils/errors';

export class DuesController {
  async getConfig(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await duesService.getConfig(req.user!.association_id)); }
    catch (err) { next(err); }
  }

  async upsertConfig(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await duesService.upsertConfig(req.user!.association_id, req.body, req.user!.id)); }
    catch (err) { next(err); }
  }

  async generateBills(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await duesService.generateBills(req.user!.association_id, req.body)); }
    catch (err) { next(err); }
  }

  async listBills(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { cursor, limit } = parsePagination(req.query as never);
      res.json(await duesService.listBills(req.user!.association_id, {
        cursor, limit,
        unit_id: req.query['unit_id'] as string,
        month: req.query['month'] ? parseInt(req.query['month'] as string) : undefined,
        year: req.query['year'] ? parseInt(req.query['year'] as string) : undefined,
        status: req.query['status'] as string,
        from_date: req.query['from_date'] as string,
        to_date: req.query['to_date'] as string,
      }));
    } catch (err) { next(err); }
  }

  async listMyBills(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user!.unit_id) throw new UnprocessableError('No unit associated with your account.');
      const { cursor, limit } = parsePagination(req.query as never);
      res.json(await duesService.listMyBills(req.user!.association_id, req.user!.unit_id, { cursor, limit }));
    } catch (err) { next(err); }
  }

  async initiatePayment(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await duesService.initiatePayment(req.user!.association_id, req.user!.id, req.body)); }
    catch (err) { next(err); }
  }

  async verifyPayment(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await duesService.verifyPayment(req.user!.association_id, req.user!.id, req.body)); }
    catch (err) { next(err); }
  }

  async webhook(req: Request, res: Response, next: NextFunction) {
    try {
      const sig = req.headers['x-razorpay-signature'] as string;
      const result = await duesService.handleWebhook(JSON.stringify(req.body), sig);
      res.json(result);
    } catch (err) { next(err); }
  }

  async offlinePayment(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.status(201).json(await duesService.recordOfflinePayment(req.user!.association_id, req.body, req.user!.id)); }
    catch (err) { next(err); }
  }

  async rollbackBills(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await duesService.rollbackBills(req.user!.association_id, req.body)); }
    catch (err) { next(err); }
  }

  async arrears(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await duesService.getArrears(req.user!.association_id)); }
    catch (err) { next(err); }
  }

  async createLevy(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.status(201).json(await duesService.createLevy(req.user!.association_id, req.body)); }
    catch (err) { next(err); }
  }

  async dashboard(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await duesService.getDashboard(req.user!.association_id)); }
    catch (err) { next(err); }
  }

  // ── One-Time Dues ─────────────────────────────────────────────────────────
  async createOneTimeDue(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.status(201).json(await duesService.createOneTimeDue(req.user!.association_id, req.body, req.user!.id)); }
    catch (err) { next(err); }
  }

  async listOneTimeDues(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await duesService.listOneTimeDues(req.user!.association_id)); }
    catch (err) { next(err); }
  }

  async getOneTimeDue(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await duesService.getOneTimeDue(req.user!.association_id, req.params.id)); }
    catch (err) { next(err); }
  }

  async updateOneTimeDue(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await duesService.updateOneTimeDue(req.user!.association_id, req.params.id, req.body)); }
    catch (err) { next(err); }
  }

  async deleteOneTimeDue(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await duesService.deleteOneTimeDue(req.user!.association_id, req.params.id)); }
    catch (err) { next(err); }
  }

  async deleteOneTimeDueBills(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await duesService.deleteOneTimeDueBills(req.user!.association_id, req.params.id)); }
    catch (err) { next(err); }
  }

  async generateOneTimeDueBills(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await duesService.generateOneTimeDueBills(req.user!.association_id, req.params.id, req.body)); }
    catch (err) { next(err); }
  }

  async closeOneTimeDue(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await duesService.closeOneTimeDue(req.user!.association_id, req.params.id)); }
    catch (err) { next(err); }
  }
}

export const duesController = new DuesController();
