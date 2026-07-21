import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../types';
import { usersService } from './users.service';
import { parsePagination } from '../../utils/helpers';

export class UsersController {
  // Units
  async listUnits(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // SUPER_USER can pass ?association_id to view units of any association
      const associationId = (req.user!.role === 'SUPER_USER' && req.query['association_id'])
        ? req.query['association_id'] as string
        : req.user!.association_id;
      const result = await usersService.listUnits(associationId);
      res.json(result);
    } catch (err) { next(err); }
  }

  async createUnit(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const associationId = (req.user!.role === 'SUPER_USER' && req.body.association_id)
        ? req.body.association_id
        : req.user!.association_id;
      const { association_id: _, ...body } = req.body;
      const result = await usersService.createUnit(associationId, body);
      res.status(201).json(result);
    } catch (err) { next(err); }
  }

  async updateUnit(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const associationId = (req.user!.role === 'SUPER_USER' && req.query['association_id'])
        ? req.query['association_id'] as string
        : req.user!.association_id;
      const result = await usersService.updateUnit(associationId, req.params['unitId'], req.body);
      res.json(result);
    } catch (err) { next(err); }
  }

  async deleteUnit(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const associationId = (req.user!.role === 'SUPER_USER' && req.query['association_id'])
        ? req.query['association_id'] as string
        : req.user!.association_id;
      const result = await usersService.deleteUnit(associationId, req.params['unitId']);
      res.json(result);
    } catch (err) { next(err); }
  }

  // Users
  async listUsers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { cursor, limit } = parsePagination(req.query as { cursor?: string; limit?: string });
      // SUPER_USER can pass ?association_id to view users of any association
      const associationId = (req.user!.role === 'SUPER_USER' && req.query['association_id'])
        ? req.query['association_id'] as string
        : req.user!.association_id;
      const result = await usersService.listUsers(associationId, {
        cursor, limit,
        role: req.query['role'] as string,
        unit_id: req.query['unit_id'] as string,
        is_active: req.query['is_active'] !== undefined ? req.query['is_active'] === 'true' : undefined,
        search: req.query['search'] as string,
      });
      res.json(result);
    } catch (err) { next(err); }
  }

  async getUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await usersService.getUser(req.user!.association_id, req.params['userId']);
      res.json(result);
    } catch (err) { next(err); }
  }

  async createUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await usersService.createUser(req.user!.association_id, req.body, req.user!.id);
      res.status(201).json(result);
    } catch (err) { next(err); }
  }

  async updateUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await usersService.updateUser(req.user!.association_id, req.params['userId'], req.body, req.user!.id);
      res.json(result);
    } catch (err) { next(err); }
  }

  async deactivateUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await usersService.deactivateUser(req.user!.association_id, req.params['userId'], req.user!.id);
      res.json(result);
    } catch (err) { next(err); }
  }

  async inviteUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await usersService.inviteUser(req.user!.association_id, req.body, req.user!.id);
      res.status(201).json(result);
    } catch (err) { next(err); }
  }

  async bulkImport(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await usersService.bulkImport(req.user!.association_id, req.body.records, req.user!.id);
      res.json(result);
    } catch (err) { next(err); }
  }
}

export const usersController = new UsersController();
