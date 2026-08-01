import { Request, Response, NextFunction } from 'express';
import { journalService } from './journal.service';
import { validate } from '../../middleware/validate';
import { createJournalEntrySchema } from './journal.schema';

class JournalController {
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const associationId = (req as never as { user: { association_id: string } }).user.association_id;
      const { cursor, limit, type, from, to } = req.query as Record<string, string>;
      const result = await journalService.listEntries(associationId, {
        cursor, type, from, to,
        limit: limit ? parseInt(limit) : undefined,
      });
      res.json(result);
    } catch (err) { next(err); }
  };

  getPnL = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const associationId = (req as never as { user: { association_id: string } }).user.association_id;
      const { from, to } = req.query as Record<string, string>;
      if (!from || !to) { res.status(400).json({ message: 'from and to are required' }); return; }
      const result = await journalService.getPnL(associationId, { from, to });
      res.json(result);
    } catch (err) { next(err); }
  };

  getLedger = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const associationId = (req as never as { user: { association_id: string } }).user.association_id;
      const { account_id, from, to } = req.query as Record<string, string>;
      if (!account_id) { res.status(400).json({ message: 'account_id is required' }); return; }
      const result = await journalService.getLedger(associationId, account_id, { from, to });
      res.json(result);
    } catch (err) { next(err); }
  };

  getAllLedger = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const associationId = (req as never as { user: { association_id: string } }).user.association_id;
      const { from, to } = req.query as Record<string, string>;
      const result = await journalService.getLedgerAll(associationId, { from, to });
      res.json(result);
    } catch (err) { next(err); }
  };

  getSubLedger = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const associationId = (req as never as { user: { association_id: string } }).user.association_id;
      const { account_id, from, to } = req.query as Record<string, string>;
      if (!account_id) { res.status(400).json({ message: 'account_id is required' }); return; }
      const result = await journalService.getSubLedger(associationId, account_id, { from, to });
      res.json(result);
    } catch (err) { next(err); }
  };

  backfill = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const associationId = (req as never as { user: { association_id: string } }).user.association_id;
      const result = await journalService.backfillTransactions(associationId);
      res.json(result);
    } catch (err) { next(err); }
  };

  backfillBPTags = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const associationId = (req as never as { user: { association_id: string } }).user.association_id;
      const result = await journalService.backfillBPTags(associationId);
      res.json(result);
    } catch (err) { next(err); }
  };

  getBalanceSheet = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const associationId = (req as never as { user: { association_id: string } }).user.association_id;
      const { asOf, compare, schedules } = req.query as Record<string, string>;
      if (!asOf) { res.status(400).json({ message: 'asOf date is required' }); return; }
      const result = await journalService.getBalanceSheet(associationId, {
        asOf,
        compare:   compare   === 'true' || compare   === '1',
        schedules: schedules === 'true' || schedules === '1',
      });
      res.json(result);
    } catch (err) { next(err); }
  };

  getTrialBalance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const associationId = (req as never as { user: { association_id: string } }).user.association_id;
      const { asOf, from } = req.query as Record<string, string>;
      if (!asOf) { res.status(400).json({ message: 'asOf date is required' }); return; }
      const result = await journalService.getTrialBalance(associationId, { asOf, from });
      res.json(result);
    } catch (err) { next(err); }
  };

  getDayBook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const associationId = (req as never as { user: { association_id: string } }).user.association_id;
      const { from, to } = req.query as Record<string, string>;
      if (!from || !to) { res.status(400).json({ message: 'from and to are required' }); return; }
      const result = await journalService.getDayBook(associationId, { from, to });
      res.json(result);
    } catch (err) { next(err); }
  };

  getCashBook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const associationId = (req as never as { user: { association_id: string } }).user.association_id;
      const { from, to, kind, account_id } = req.query as Record<string, string>;
      if (!from || !to) { res.status(400).json({ message: 'from and to are required' }); return; }
      const bookKind = kind === 'BANK' ? 'BANK' : 'CASH';
      const result = await journalService.getCashBook(associationId, { kind: bookKind, account_id, from, to });
      res.json(result);
    } catch (err) { next(err); }
  };

  getIncomeExpenditure = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const associationId = (req as never as { user: { association_id: string } }).user.association_id;
      const { from, to, compare } = req.query as Record<string, string>;
      if (!from || !to) { res.status(400).json({ message: 'from and to are required' }); return; }
      const result = await journalService.getIncomeExpenditure(associationId, {
        from, to, compare: compare === 'true' || compare === '1',
      });
      res.json(result);
    } catch (err) { next(err); }
  };

  getReceiptsAndPayments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const associationId = (req as never as { user: { association_id: string } }).user.association_id;
      const { from, to, cash_codes } = req.query as Record<string, string>;
      if (!from || !to) { res.status(400).json({ message: 'from and to are required' }); return; }
      const result = await journalService.getReceiptsAndPayments(associationId, { from, to, cash_codes });
      res.json(result);
    } catch (err) { next(err); }
  };

  createManual = [
    validate(createJournalEntrySchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { user } = req as never as { user: { association_id: string; id: string } };
        const result = await journalService.createManual(user.association_id, req.body, user.id);
        res.status(201).json(result);
      } catch (err) { next(err); }
    },
  ];

  updateEntry = [
    validate(createJournalEntrySchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const associationId = (req as never as { user: { association_id: string } }).user.association_id;
        const result = await journalService.updateEntry(req.params.id, associationId, req.body);
        res.json(result);
      } catch (err) { next(err); }
    },
  ];
}

export const journalController = new JournalController();
