import { z } from 'zod';

// The complete set of actions an Integration API Key can ever be scoped to.
// Deliberately a closed list — adding a new one is a code change (a new
// requireRolesOrApiKeyScope call on the specific endpoint it protects), never
// something a key's creator can invent from the admin screen.
export const API_KEY_SCOPES = [
  'expenses:approve',
  'dues:waive_penalty',
  'maintenance:update_ticket',
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export const createApiKeySchema = z.object({
  name: z.string().trim().min(3).max(120),
  scopes: z.array(z.enum(API_KEY_SCOPES)).min(1, 'Pick at least one scope for this key to be useful.'),
});

export type CreateApiKeyBody = z.infer<typeof createApiKeySchema>;
