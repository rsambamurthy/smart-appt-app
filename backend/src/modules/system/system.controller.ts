import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../types';
import { systemService } from './system.service';
import { auditReadService } from './audit.service';
import { parsePagination } from '../../utils/helpers';

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

  /**
   * GET /system/mobile-config — the caller's own config, with the menu already
   * resolved for their role. The device receives only its own role's menu.
   */
  async getMyMobileConfig(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json(await systemService.getMobileConfigForUser(
        req.user!.association_id, req.user!.role,
      ));
    } catch (err) { next(err); }
  }

  /** GET /system/mobile-menu/:associationId — full role matrix for the admin screen. */
  async getMobileMenuMatrix(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json(await systemService.getMobileMenuMatrix(req.params['associationId'] as string));
    } catch (err) { next(err); }
  }

  /** PUT /system/mobile-menu/:associationId — save the role matrix. */
  async saveMobileMenu(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json(await systemService.saveMobileMenu(
        req.params['associationId'] as string, req.body?.overrides ?? req.body ?? {},
      ));
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

  // ── Audit Trail ───────────────────────────────────────────────────────────────

  /** GET /system/audit-logs — filtered, paginated audit trail. */
  async listAuditLogs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { cursor, limit } = parsePagination(req.query as { cursor?: string; limit?: string });
      const q = req.query as Record<string, string>;

      // SUPER_USER may target a specific association, or omit it to see all.
      const associationId = req.user!.role === 'SUPER_USER'
        ? (q['association_id'] ?? null)
        : req.user!.association_id;

      res.json(await auditReadService.list(associationId, req.user!.role, {
        cursor, limit,
        entity_type:  q['entity_type'],
        entity_id:    q['entity_id'],
        action:       q['action'],
        performed_by: q['performed_by'],
        date_from:    q['date_from'],
        date_to:      q['date_to'],
        search:       q['search'],
      }));
    } catch (err) { next(err); }
  }

  /** GET /system/audit-logs/facets — values available for the filter dropdowns. */
  async auditFacets(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const associationId = req.user!.role === 'SUPER_USER'
        ? ((req.query['association_id'] as string) ?? null)
        : req.user!.association_id;
      res.json(await auditReadService.facets(associationId, req.user!.role));
    } catch (err) { next(err); }
  }
}

export const systemController = new SystemController();
