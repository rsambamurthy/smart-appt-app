import { Request, Response, NextFunction } from 'express';
import { fyClosureService } from './fy-closure.service';

type AuthReq = { user: { association_id: string; id: string } };

class FYClosureController {

  getConfig = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { association_id } = (req as never as AuthReq).user;
      const result = await fyClosureService.getConfig(association_id);
      res.json({ data: result });
    } catch (err) { next(err); }
  };

  updateConfig = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { association_id } = (req as never as AuthReq).user;
      const { financial_year_start_month } = req.body as { financial_year_start_month: number };
      const result = await fyClosureService.updateConfig(association_id, Number(financial_year_start_month));
      res.json(result);
    } catch (err) { next(err); }
  };

  listFYs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { association_id } = (req as never as AuthReq).user;
      const result = await fyClosureService.listFYs(association_id);
      res.json(result);
    } catch (err) { next(err); }
  };

  previewClosure = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { association_id } = (req as never as AuthReq).user;
      const { fy } = req.query as { fy: string };
      if (!fy) { res.status(400).json({ message: 'fy is required' }); return; }
      const result = await fyClosureService.previewClosure(association_id, fy);
      res.json(result);
    } catch (err) { next(err); }
  };

  closeFY = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { association_id, id: userId } = (req as never as AuthReq).user;
      const { fy, surplus_account_id, notes } = req.body as { fy: string; surplus_account_id: string; notes?: string };
      if (!fy || !surplus_account_id) { res.status(400).json({ message: 'fy and surplus_account_id are required' }); return; }
      const result = await fyClosureService.closeFY(association_id, fy, surplus_account_id, userId, notes);
      res.json(result);
    } catch (err) { next(err); }
  };

  reopenFY = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { association_id, id: userId } = (req as never as AuthReq).user;
      const { fy } = req.body as { fy: string };
      if (!fy) { res.status(400).json({ message: 'fy is required' }); return; }
      const result = await fyClosureService.reopenFY(association_id, fy, userId);
      res.json(result);
    } catch (err) { next(err); }
  };
}

export const fyClosureController = new FYClosureController();
