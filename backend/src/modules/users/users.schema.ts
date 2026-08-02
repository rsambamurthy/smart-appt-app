import { z } from 'zod';
import { UserRole } from '@prisma/client';

// Roles a MANAGER may assign within their own association. SUPER_USER is a
// platform role belonging to no association — allowing it here would let any
// manager mint a platform administrator, which is privilege escalation. Super
// users are created out-of-band (scripts/create-super-user.js).
const assignableRole = z.enum([
  UserRole.MANAGER,
  UserRole.RESIDENT,
  UserRole.COMMITTEE,
  UserRole.TREASURER,
  UserRole.GATE_STAFF,
]);

export const createUserSchema = z.object({
  phone: z.string().min(10).max(15),
  email: z.string().email().optional(),
  name: z.string().min(1).max(255),
  role: assignableRole,
  unit_id: z.string().uuid().optional(),
  is_owner: z.boolean().optional().default(false),
  move_in_date: z.string().datetime().optional(),
  vehicle_numbers: z.array(z.string().max(20)).optional().default([]),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional().nullable(),
  // Also restricted: promoting an existing user would be the same escalation.
  role: assignableRole.optional(),
  unit_id: z.string().uuid().optional().nullable(),
  is_owner: z.boolean().optional(),
  move_in_date: z.string().datetime().optional().nullable(),
  move_out_date: z.string().datetime().optional().nullable(),
  vehicle_numbers: z.array(z.string().max(20)).optional(),
  fcm_token: z.string().optional(),
  is_active: z.boolean().optional(),
});

export const createUnitSchema = z.object({
  flat_number: z.string().min(1).max(20),
  block: z.string().max(20).optional(),
  floor: z.number().int(),
  area_sqft: z.number().positive().optional(),
  unit_type: z.string().max(50).optional(),
});

export const updateUnitSchema = createUnitSchema.partial();

export const inviteUserSchema = z.object({
  phone: z.string().min(10).max(15),
  email: z.string().email().optional(),
  name: z.string().min(1).max(255).optional(),
  role: assignableRole,
  unit_id: z.string().uuid().optional(),
});

export const paginationSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(20),
  role: z.nativeEnum(UserRole).optional(),
  unit_id: z.string().uuid().optional(),
  association_id: z.string().uuid().optional(),
  is_active: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

export type CreateUserBody = z.infer<typeof createUserSchema>;
export type UpdateUserBody = z.infer<typeof updateUserSchema>;
export type CreateUnitBody = z.infer<typeof createUnitSchema>;
export type InviteUserBody = z.infer<typeof inviteUserSchema>;
