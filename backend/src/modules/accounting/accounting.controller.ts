import { Request, Response, NextFunction } from 'express';
import { accountingService } from './accounting.service';
import { createAccountSchema, updateAccountSchema } from './accounting.schema';
import { validate } from '../../middleware/validate';

class AccountingController {

  listAccounts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await accountingService.listAccounts(req.user!.association_id);
      res.json(result);
    } catch (err) { next(err); }
  };

  seedDefaults = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await accountingService.seedDefaults(req.user!.association_id);
      res.json(result);
    } catch (err) { next(err); }
  };

  createAccount = [
    validate(createAccountSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await accountingService.createAccount(req.user!.association_id, req.body);
        res.status(201).json(result);
      } catch (err) { next(err); }
    },
  ];

  updateAccount = [
    validate(updateAccountSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await accountingService.updateAccount(req.user!.association_id, req.params.id, req.body);
        res.json(result);
      } catch (err) { next(err); }
    },
  ];

  toggleActive = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await accountingService.toggleActive(req.user!.association_id, req.params.id);
      res.json(result);
    } catch (err) { next(err); }
  };

  deleteAccount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await accountingService.deleteAccount(req.user!.association_id, req.params.id);
      res.json(result);
    } catch (err) { next(err); }
  };
}

export const accountingController = new AccountingController();
