import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { feeConfigService } from './fee-config.service';

export class FeeConfigController {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json(await feeConfigService.listFeeConfigs(req.user!.association_id));
    } catch (err) { next(err); }
  }

  async save(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json(await feeConfigService.saveFeeConfigs(
        req.user!.association_id,
        req.body,
        req.user!.id,
      ));
    } catch (err) { next(err); }
  }

  async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json(await feeConfigService.deleteFeeConfig(req.params.id, req.user!.association_id));
    } catch (err) { next(err); }
  }
}

export const feeConfigController = new FeeConfigController();
