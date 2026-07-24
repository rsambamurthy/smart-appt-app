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

  // ── Mobile Config ─────────────────────────────────────────────────────────────

  /** GET /system/mobile-config — returns config for the caller's own association (mobile app use) */
  async getMyMobileConfig(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json(await systemService.getMobileConfig(req.user!.association_id));
    } catch (err) { next(err); }
  }

  /** GET /system/mobile-config/:associationId — SUPER_USER admin: get config for any association */
  async getMobileConfigById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json(await systemService.getMobileConfig(req.params['associationId']));
    } catch (err) { next(err); }
  }

  /** PUT /system/mobile-config/:associationId — SUPER_USER admin: upsert config */
  async saveMobileConfig(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json(await systemService.saveMobileConfig(req.params['associationId'], req.body));
    } catch (err) { next(err); }
  }
}

export const systemController = new SystemController();
