import { UserRole } from '@prisma/client';
import { Request } from 'express';

export interface AuthUser {
  id: string;
  association_id: string;
  role: UserRole;
  unit_id?: string | null;
  phone: string;
  name: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export interface PaginationQuery {
  cursor?: string;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    next_cursor: string | null;
    count: number;
  };
}

export interface ApiResponse<T = unknown> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
}

export interface JwtPayload {
  sub: string;       // user_id
  aid: string;       // association_id
  role: UserRole;
  unit_id?: string | null;
  iat?: number;
  exp?: number;
}

export interface NotificationJob {
  type: string;
  channels: ('PUSH' | 'SMS' | 'EMAIL')[];
  recipients: string[];  // user_ids
  data: Record<string, unknown>;
}
