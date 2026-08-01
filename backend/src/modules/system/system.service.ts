import prisma from '../../config/database';
import { AuditAction, MobileConfig, Prisma } from '@prisma/client';
import { auditService } from '../../services/audit.service';

export type MobileConfigBody = Omit<MobileConfig, 'id' | 'association_id' | 'created_at' | 'updated_at'>;

/** Shape stored in the menu_items JSON column. */
export interface MenuItemConfig {
  enabled: boolean;
  can_post: boolean;
}
export type MenuItemsMap = Record<string, MenuItemConfig>;

const MOBILE_DEFAULTS: MobileConfigBody = {
  feature_bills: true,
  feature_announcements: true,
  feature_complaints: true,
  feature_visitors: true,
  feature_journal: true,
  feature_ledger: true,
  feature_pnl: true,
  feature_balance_sheet: true,
  feature_coa: true,
  feature_fy_closure: true,
  push_dues_reminder: true,
  push_announcements: true,
  push_visitor_alerts: true,
  login_mpin_enabled: true,
  login_biometric: false,
  login_otp_only: false,
  app_name: null,
  theme_color: null,
  logo_url: null,
  menu_items: null,
};

/**
 * Prisma's nullable JSON fields require `Prisma.DbNull` (not JS `null`) in
 * create/update inputs. This helper converts the output-typed body into a
 * safe Prisma input object.
 */
function toJsonInput(
  body: Partial<MobileConfigBody>,
  defaults?: MobileConfigBody,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...(defaults ?? {}), ...body };
  // For every key that is null and came from a Json? column, use Prisma.DbNull
  if ('menu_items' in result && result['menu_items'] === null) {
    result['menu_items'] = Prisma.DbNull;
  }
  return result;
}

export class SystemService {
  async getMenuConfig() {
    const records = await prisma.menuGroupConfig.findMany();

    // Build map: role → item_id → enabled
    // group_id column stores item IDs (e.g. 'dues_bills', 'admin_users')
    const config: Record<string, Record<string, boolean>> = {};
    for (const r of records) {
      if (!config[r.role]) config[r.role] = {};
      config[r.role][r.group_id] = r.enabled;
    }
    return { data: config };
  }

  async saveMenuConfig(items: Array<{ group_id: string; role: string; enabled: boolean }>) {
    const before = await prisma.menuGroupConfig.findMany();

    await prisma.$transaction(
      items.map((item) =>
        prisma.menuGroupConfig.upsert({
          where: { group_id_role: { group_id: item.group_id, role: item.role } },
          create: { group_id: item.group_id, role: item.role, enabled: item.enabled },
          update: { enabled: item.enabled },
        }),
      ),
    );

    // Record only what actually changed — the full matrix is large and noisy.
    const beforeMap = new Map(before.map(b => [`${b.group_id}|${b.role}`, b.enabled]));
    const changed = items.filter(i => {
      const prev = beforeMap.get(`${i.group_id}|${i.role}`);
      return prev !== undefined && prev !== i.enabled;
    });

    await auditService.record({
      entity_type: 'menu_config',
      action:      AuditAction.UPDATE,
      summary:     `Updated web menu permissions (${changed.length} change${changed.length === 1 ? '' : 's'})`,
      old_value:   changed.map(c => ({ group_id: c.group_id, role: c.role, enabled: beforeMap.get(`${c.group_id}|${c.role}`) })),
      new_value:   changed,
    });

    return this.getMenuConfig();
  }

  // ── Mobile Config ─────────────────────────────────────────────────────────────

  async getMobileConfig(associationId: string) {
    const config = await prisma.mobileConfig.findUnique({
      where: { association_id: associationId },
    });
    return { data: config ?? { ...MOBILE_DEFAULTS, association_id: associationId } };
  }

  async saveMobileConfig(associationId: string, body: Partial<MobileConfigBody>) {
    const before = await prisma.mobileConfig.findUnique({
      where: { association_id: associationId },
    });

    const createData = toJsonInput(body, MOBILE_DEFAULTS);
    const updateData = toJsonInput(body);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = await (prisma.mobileConfig.upsert as any)({
      where:  { association_id: associationId },
      create: { association_id: associationId, ...createData },
      update: updateData,
    });

    await auditService.record({
      entity_type:    'mobile_config',
      entity_id:      config.id,
      action:         before ? AuditAction.UPDATE : AuditAction.CREATE,
      association_id: associationId,
      summary:        'Updated mobile app configuration',
      old_value:      before ?? undefined,
      new_value:      body,
    });

    return { data: config };
  }
}

export const systemService = new SystemService();
