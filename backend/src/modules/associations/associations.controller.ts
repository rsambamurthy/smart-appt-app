import { Request, Response, NextFunction } from 'express';
import { associationsService } from './associations.service';

export class AssociationsController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await associationsService.register(req.body);
      res.status(201).json({ data: result, message: 'Association registered successfully. You can now log in with your phone number.' });
    } catch (err) { next(err); }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await associationsService.list();
      res.json({ data });
    } catch (err) { next(err); }
  }

  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await associationsService.getOne(req.params.id);
      res.json({ data });
    } catch (err) { next(err); }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await associationsService.update(req.params.id, req.body);
      res.json({ data, message: 'Association updated.' });
    } catch (err) { next(err); }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await associationsService.remove(req.params.id);
      res.json({ data: null, message: 'Association deactivated.' });
    } catch (err) { next(err); }
  }

  async hardDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await associationsService.hardDelete(req.params.id);
      res.json({ data: null, message: 'Association and all related data permanently deleted.' });
    } catch (err) { next(err); }
  }
}

export const associationsController = new AssociationsController();
