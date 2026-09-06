import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../types';
import { integrationsService } from './integrations.service';

export class IntegrationsController {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await integrationsService.list(req.user!.association_id)); }
    catch (err) { next(err); }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.status(201).json(await integrationsService.create(req.user!.association_id, req.body, req.user!.id)); }
    catch (err) { next(err); }
  }

  async revoke(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await integrationsService.revoke(req.user!.association_id, req.params['id'] as string, req.user!.id)); }
    catch (err) { next(err); }
  }
}

export const integrationsController = new IntegrationsController();
