import { z } from 'zod';

export const registerAssociationSchema = z.object({
  name:    z.string().min(2).max(255),
  address: z.string().max(500).optional(),
  city:    z.string().max(100).optional(),
  state:   z.string().max(100).optional(),
  pincode: z.string().max(10).optional(),
  admin_name:  z.string().min(2).max(100),
  admin_phone: z.string().min(10).max(15),
});

export const updateAssociationSchema = z.object({
  name:      z.string().min(2).max(255).optional(),
  address:   z.string().max(500).optional(),
  city:      z.string().max(100).optional(),
  state:     z.string().max(100).optional(),
  pincode:   z.string().max(10).optional(),
  is_active: z.boolean().optional(),
});

export type RegisterAssociationBody = z.infer<typeof registerAssociationSchema>;
export type UpdateAssociationBody   = z.infer<typeof updateAssociationSchema>;
