import { NextFunction, Request, Response } from 'express';
import { AuthenticatedUser, verifyAccessToken } from '../services/authService';

const extractToken = (req: Request): string | null => {
  const header = req.get('authorization');
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return null;
};

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ error: 'auth_required' });
      return;
    }
    const user = verifyAccessToken(token);
    req.user = user;
    next();
  } catch (error) {
    console.error('[auth] invalid token', error);
    res.status(401).json({ error: 'invalid_token' });
  }
};

export const requireRole = (role: AuthenticatedUser['role']) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'auth_required' });
      return;
    }
    if (req.user.role !== role) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    next();
  };
};

