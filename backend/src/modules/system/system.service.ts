import prisma from '../../config/database';
import { MobileConfig } from '@prisma/client';

export type MobileConfigBody = Omit<MobileConfig, 'id' | 'association_id' | 'created_at' | 'updated_at'>;

const MOBILE_DEFAULTS: MobileConfigBody = {
  feature_bills: true,
  feature_announcements: true,
  feature_complaints: true,
  feature_visitors: true,
  push_dues_reminder: true,
  push_announcements: true,
  push_visitor_alerts: true,
  login_mpin_enabled: true,
  login_biometric: false,
  login_otp_only: false,
  app_name: null,
  theme_color: null,
  logo_url: null,
};

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
    await prisma.$transaction(
      items.map((item) =>
        prisma.menuGroupConfig.upsert({
          where: { group_id_role: { group_id: item.group_id, role: item.role } },
          create: { group_id: item.group_id, role: item.role, enabled: item.enabled },
          update: { enabled: item.enabled },
        }),
      ),
    );
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
    const config = await prisma.mobileConfig.upsert({
      where: { association_id: associationId },
      create: { association_id: associationId, ...MOBILE_DEFAULTS, ...body },
      update: body,
    });
    return { data: config };
  }
}

export const systemService = new SystemService();
