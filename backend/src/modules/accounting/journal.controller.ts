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
}

export const journalController = new JournalController();
