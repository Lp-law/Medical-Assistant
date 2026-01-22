import type { AuthenticatedUser } from '../services/authService';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser & { isAdmin?: boolean };
    }
  }
}

export {};

