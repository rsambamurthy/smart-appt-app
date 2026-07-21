import { z } from 'zod';
import { TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';

export const createTicketSchema = z.object({
  category: z.nativeEnum(TicketCategory),
  priority: z.nativeEnum(TicketPriority),
  title: z.string().min(1).max(255),
  description: z.string().min(1),
});

export const assignTicketSchema = z.object({
  assigned_to: z.string().uuid(),
  sla_due_at: z.string().datetime().optional(),
  note: z.string().optional(),
});

export const updateStatusSchema = z.object({
  status: z.nativeEnum(TicketStatus),
  note: z.string().optional(),
});

export const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

export const listTicketsQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(TicketStatus).optional(),
  category: z.nativeEnum(TicketCategory).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  unit_id: z.string().uuid().optional(),
  assigned_to: z.string().uuid().optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
});

export type CreateTicketBody = z.infer<typeof createTicketSchema>;
export type AssignTicketBody = z.infer<typeof assignTicketSchema>;
export type UpdateStatusBody = z.infer<typeof updateStatusSchema>;
export type FeedbackBody = z.infer<typeof feedbackSchema>;
