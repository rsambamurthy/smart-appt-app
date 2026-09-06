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

/** The identity attached to a request authenticated by an Integration API Key
 * instead of a real user login — see middleware/auth.ts and
 * middleware/api-key-scope.ts. Deliberately has no `role`: a key is scoped to
 * exact action scopes, never a role, so nothing downstream should ever branch
 * on "what role does this request have" for one of these. */
export interface AuthApiKey {
  id:             string;
  association_id: string;
  name:           string;
  scopes:         string[];
}

export interface AuthRequest extends Request {
  user?: AuthUser;
  /** Set instead of `user` when the request authenticated via an Integration
   * API Key (X-API-Key header) rather than a user's Bearer token. The two are
   * mutually exclusive on any given request. */
  apiKey?: AuthApiKey;
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
