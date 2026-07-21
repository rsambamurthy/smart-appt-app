import { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    // Extend Express.User so passport's req.user is compatible with AuthUser
    // The Google OAuth callback casts req.user explicitly, so this is safe.
    interface User {
      id: string;
      association_id: string;
      role: UserRole;
      unit_id?: string | null;
      phone: string;
      name: string;
    }
  }
}

export {};
