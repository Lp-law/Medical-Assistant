import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from './env';

export type UserRole = 'admin' | 'attorney';

export interface AuthenticatedUser {
  id: string;
  username: string;
  role: UserRole;
}

interface StoredUser extends AuthenticatedUser {
  passwordHash: string;
}

interface JwtClaims extends AuthenticatedUser {
  iat: number;
  exp: number;
}

const userDirectory: StoredUser[] = config.auth.users.map((user) => ({
  id: user.username,
  username: user.username,
  role: user.role,
  passwordHash: user.passwordHash,
}));

export const findUserByUsername = (username: string): StoredUser | undefined => {
  const normalized = username.trim().toLowerCase();
  return userDirectory.find((user) => user.username.toLowerCase() === normalized);
};

export const validateUserCredentials = async (
  username: string,
  password: string,
): Promise<AuthenticatedUser | null> => {
  const user = findUserByUsername(username);
  if (!user) {
    return null;
  }
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return null;
  }
  return {
    id: user.id,
    username: user.username,
    role: user.role,
  };
};

export const signAccessToken = (user: AuthenticatedUser): string => {
  return jwt.sign(user, config.auth.jwtSecret, {
    expiresIn: `${config.auth.accessTtlMinutes}m`,
  });
};

export const verifyAccessToken = (token: string): AuthenticatedUser => {
  const decoded = jwt.verify(token, config.auth.jwtSecret) as JwtClaims;
  return {
    id: decoded.id,
    username: decoded.username,
    role: decoded.role,
  };
};

