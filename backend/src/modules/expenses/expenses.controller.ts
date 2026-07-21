import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../types';
import { expensesService } from './expenses.service';
import { parsePagination } from '../../utils/helpers';

export class ExpensesController {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const file = req.file as (Express.Multer.File & { key?: string }) | undefined;
      const result = await expensesService.createExpense(req.user!.association_id, req.body, req.user!.id, file?.key);
      res.status(201).json(result);
    } catch (err) { next(err); }
  }

  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { cursor, limit } = parsePagination(req.query as never);
      res.json(await expensesService.listExpenses(req.user!.association_id, {
        cursor, limit,
        category: req.query['category'] as string,
        vendor_id: req.query['vendor_id'] as string,
        status: req.query['status'] as string,
        date_from: req.query['date_from'] as string,
        date_to: req.query['date_to'] as string,
      }));
    } catch (err) { next(err); }
  }

  async getOne(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await expensesService.getExpense(req.user!.association_id, req.params['id'])); }
    catch (err) { next(err); }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await expensesService.updateExpense(req.user!.association_id, req.params['id'], req.body, req.user!.id)); }
    catch (err) { next(err); }
  }

  async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await expensesService.deleteExpense(req.user!.association_id, req.params['id'], req.user!.id)); }
    catch (err) { next(err); }
  }

  async approve(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await expensesService.approveExpense(req.user!.association_id, req.params['id'], req.body, req.user!.id)); }
    catch (err) { next(err); }
  }

  async dashboard(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await expensesService.getDashboard(req.user!.association_id)); }
    catch (err) { next(err); }
  }

  async transparency(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await expensesService.getTransparencyView(req.user!.association_id)); }
    catch (err) { next(err); }
  }

  async setBudget(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await expensesService.setBudget(req.user!.association_id, req.params['category'], req.body, req.user!.id)); }
    catch (err) { next(err); }
  }

  async createRecurring(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.status(201).json(await expensesService.createRecurring(req.user!.association_id, req.body, req.user!.id)); }
    catch (err) { next(err); }
  }

  async listRecurring(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await expensesService.listRecurring(req.user!.association_id)); }
    catch (err) { next(err); }
  }

  async updateRecurring(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await expensesService.updateRecurring(req.user!.association_id, req.params['id'], req.body)); }
    catch (err) { next(err); }
  }

  // ── Category Config ──────────────────────────────────────────────────────────
  async listCategories(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await expensesService.listCategories(req.user!.association_id)); }
    catch (err) { next(err); }
  }

  async createCategory(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.status(201).json(await expensesService.createCategory(req.user!.association_id, req.body)); }
    catch (err) { next(err); }
  }

  async updateCategory(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await expensesService.updateCategory(req.user!.association_id, req.params['id'], req.body)); }
    catch (err) { next(err); }
  }

  async deleteCategory(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await expensesService.deleteCategory(req.user!.association_id, req.params['id'])); }
    catch (err) { next(err); }
  }
}

export const expensesController = new ExpensesController();
