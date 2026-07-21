import prisma from '../../config/database';

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
}

export const systemService = new SystemService();
