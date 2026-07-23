import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../types';
import { receiptsService } from './receipts.service';
import { parsePagination } from '../../utils/helpers';

export class ReceiptsController {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { cursor, limit } = parsePagination(req.query as never);
      res.json(await receiptsService.list(req.user!.association_id, { cursor, limit }));
    } catch (err) { next(err); }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await receiptsService.create(req.user!.association_id, req.body, req.user!.id));
    } catch (err) { next(err); }
  }

  async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json(await receiptsService.remove(req.user!.association_id, req.params.id));
    } catch (err) { next(err); }
  }
}

export const receiptsController = new ReceiptsController();
