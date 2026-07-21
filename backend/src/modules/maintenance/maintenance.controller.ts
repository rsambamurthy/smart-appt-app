import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../types';
import { maintenanceService } from './maintenance.service';
import { parsePagination } from '../../utils/helpers';
import { UnprocessableError } from '../../utils/errors';

export class MaintenanceController {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      if (!user.unit_id) throw new UnprocessableError('You must be associated with a unit to raise a ticket.');
      const files = (req.files as Express.Multer.File[]) ?? [];
      const keys = files.map((f) => (f as unknown as { key: string }).key ?? f.filename);
      const result = await maintenanceService.createTicket(user.association_id, user.id, user.unit_id, req.body, keys);
      res.status(201).json(result);
    } catch (err) { next(err); }
  }

  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { cursor, limit } = parsePagination(req.query as { cursor?: string; limit?: string });
      const result = await maintenanceService.listTickets(req.user!.association_id, {
        cursor, limit,
        status: req.query['status'] as string,
        category: req.query['category'] as string,
        priority: req.query['priority'] as string,
        unit_id: req.query['unit_id'] as string,
        assigned_to: req.query['assigned_to'] as string,
        date_from: req.query['date_from'] as string,
        date_to: req.query['date_to'] as string,
      });
      res.json(result);
    } catch (err) { next(err); }
  }

  async listMine(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { cursor, limit } = parsePagination(req.query as { cursor?: string; limit?: string });
      const result = await maintenanceService.listTickets(req.user!.association_id, {
        cursor, limit,
        unit_id: req.user!.unit_id ?? undefined,
      });
      res.json(result);
    } catch (err) { next(err); }
  }

  async getOne(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await maintenanceService.getTicket(
        req.user!.association_id, req.params['id'], req.user!.id, req.user!.role,
      );
      res.json(result);
    } catch (err) { next(err); }
  }

  async assign(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await maintenanceService.assignTicket(req.user!.association_id, req.params['id'], req.body, req.user!.id);
      res.json(result);
    } catch (err) { next(err); }
  }

  async updateStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await maintenanceService.updateStatus(req.user!.association_id, req.params['id'], req.body, req.user!.id);
      res.json(result);
    } catch (err) { next(err); }
  }

  async feedback(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await maintenanceService.submitFeedback(req.user!.association_id, req.params['id'], req.user!.id, req.body);
      res.json(result);
    } catch (err) { next(err); }
  }

  async dashboard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await maintenanceService.getDashboard(req.user!.association_id);
      res.json(result);
    } catch (err) { next(err); }
  }
}

export const maintenanceController = new MaintenanceController();
