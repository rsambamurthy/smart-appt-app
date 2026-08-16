import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../types';
import { systemService } from './system.service';
import { auditReadService } from './audit.service';
import { parsePagination } from '../../utils/helpers';
import { scopeAssociation, editableRolesFor } from './menu-scope';

export class SystemController {
  /**
   * GET /system/menu-config — the caller's own association's web menu.
   * Every authenticated user reads this: Layout needs it to draw the menu.
   */
  async getMenuConfig(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await systemService.getMenuConfig(req.user!.association_id)); }
    catch (err) { next(err); }
  }

  /** GET /system/menu-config/:associationId — super user, any association. */
  async getMenuConfigById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const associationId = scopeAssociation(req.user!, req.params['associationId']);
      res.json({
        ...(await systemService.getMenuConfig(associationId)),
        association_id:  associationId,
        editable_roles:  editableRolesFor(req.user!),
      });
    } catch (err) { next(err); }
  }

  async saveMenuConfig(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const associationId = scopeAssociation(req.user!, req.params['associationId']);
      const items = (req.body?.items ?? req.body) as Array<{ group_id: string; role: string; enabled: boolean }>;
      res.json(await systemService.saveMenuConfig(
        associationId, Array.isArray(items) ? items : [], editableRolesFor(req.user!),
      ));
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
      const associationId = scopeAssociation(req.user!, req.params['associationId']);
      const result = await systemService.getMobileMenuMatrix(associationId);
      res.json({
        data: { ...result.data, association_id: associationId,
                editable_roles: editableRolesFor(req.user!) },
      });
    } catch (err) { next(err); }
  }

  /** PUT /system/mobile-menu/:associationId — save the role matrix. */
  async saveMobileMenu(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const associationId = scopeAssociation(req.user!, req.params['associationId']);
      res.json(await systemService.saveMobileMenu(
        associationId, req.body?.overrides ?? req.body ?? {}, editableRolesFor(req.user!),
      ));
    } catch (err) { next(err); }
  }

  /**
   * GET /system/mobile-config/:associationId — SUPER_USER: any association.
   * MANAGER: their own only, enforced by scopeAssociation rather than trusting
   * the id in the URL.
   */
  async getMobileConfigById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const associationId = scopeAssociation(req.user!, req.params['associationId']);
      res.json(await systemService.getMobileConfig(associationId));
    } catch (err) { next(err); }
  }

  /** Fields a MANAGER's Branding access right may touch — nothing else on
   *  this config, which also covers feature flags, push/login settings and
   *  the mobile menu matrix. SUPER_USER keeps unrestricted access. */
  private static readonly MANAGER_BRANDING_FIELDS = ['app_name', 'logo_url', 'theme_color'] as const;

  /**
   * PUT /system/mobile-config/:associationId — SUPER_USER: upsert any field,
   * any association. MANAGER: their own association, branding fields only —
   * anything else in the body is silently dropped rather than 400ing, since a
   * generic client (or a future version of this screen) sending the full
   * object back should not become an error.
   */
  async saveMobileConfig(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const associationId = scopeAssociation(req.user!, req.params['associationId']);
      const body = req.user!.role === 'MANAGER'
        ? Object.fromEntries(
            Object.entries(req.body ?? {}).filter(
              ([k]) => (SystemController.MANAGER_BRANDING_FIELDS as readonly string[]).includes(k),
            ),
          )
        : req.body;
      res.json(await systemService.saveMobileConfig(associationId, body));
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
