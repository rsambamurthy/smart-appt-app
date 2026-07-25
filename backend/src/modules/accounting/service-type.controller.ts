import { Request, Response, NextFunction } from 'express';
import { serviceTypeService } from './service-type.service';

class ServiceTypeController {

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await serviceTypeService.list(req.user!.association_id);
      res.json(result);
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await serviceTypeService.create(req.user!.association_id, req.body);
      res.status(201).json(result);
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await serviceTypeService.update(req.user!.association_id, req.params.id, req.body);
      res.json(result);
    } catch (err) { next(err); }
  };

  toggle = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await serviceTypeService.toggle(req.user!.association_id, req.params.id);
      res.json(result);
    } catch (err) { next(err); }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await serviceTypeService.delete(req.user!.association_id, req.params.id);
      res.json(result);
    } catch (err) { next(err); }
  };
}

export const serviceTypeController = new ServiceTypeController();
