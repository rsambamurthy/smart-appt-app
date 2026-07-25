import { Request, Response, NextFunction } from 'express';
import { BPCategory } from '@prisma/client';
import { bpMasterService } from './bp-master.service';

class BPMasterController {

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = req.query.category as BPCategory | undefined;
      const result = await bpMasterService.list(req.user!.association_id, category);
      res.json(result);
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await bpMasterService.create(req.user!.association_id, req.body);
      res.status(201).json(result);
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await bpMasterService.update(req.user!.association_id, req.params.id, req.body);
      res.json(result);
    } catch (err) { next(err); }
  };

  toggle = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await bpMasterService.toggle(req.user!.association_id, req.params.id);
      res.json(result);
    } catch (err) { next(err); }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await bpMasterService.delete(req.user!.association_id, req.params.id);
      res.json(result);
    } catch (err) { next(err); }
  };

  listUnits = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await bpMasterService.listUnits(req.user!.association_id);
      res.json(result);
    } catch (err) { next(err); }
  };
}

export const bpMasterController = new BPMasterController();
