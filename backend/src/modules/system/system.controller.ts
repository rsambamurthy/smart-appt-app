import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../types';
import { systemService } from './system.service';

export class SystemController {
  async getMenuConfig(_req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await systemService.getMenuConfig()); }
    catch (err) { next(err); }
  }

  async saveMenuConfig(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const items = req.body as Array<{ group_id: string; role: string; enabled: boolean }>;
      res.json(await systemService.saveMenuConfig(items));
    } catch (err) { next(err); }
  }
}

export const systemController = new SystemController();
