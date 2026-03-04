import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { logAuditEvent } from '../services/auditLogger';
import { signAccessToken, validateUserCredentials } from '../services/authService';
import { requireAuth } from '../middleware/auth';
import { ensureUserRecord } from '../services/prisma';
import { config } from '../services/env';

const router = Router();
router.use(generalAuthLimiter);
const COOKIE_NAME = 'lm_access_token';

const AUTH_LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const AUTH_LOGIN_RETRY_SECONDS = Math.ceil(AUTH_LOGIN_WINDOW_MS / 1000);
// Rate limiting for login - prevent brute force attacks
const loginLimiter = rateLimit({
  windowMs: AUTH_LOGIN_WINDOW_MS,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    res.setHeader('Retry-After', String(AUTH_LOGIN_RETRY_SECONDS));
    res.status(429).json({ error: 'rate_limited', retryAfterSeconds: AUTH_LOGIN_RETRY_SECONDS });
    console.warn('[rate-limit] auth/login 429', { ip: req.ip });
  },
});

// General auth routes (e.g. /me, /logout): 10 per minute per IP
const generalAuthLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const retryAfterSeconds = 60;
    res.setHeader('Retry-After', String(retryAfterSeconds));
    res.status(429).json({ error: 'rate_limited', retryAfterSeconds });
    console.warn('[rate-limit] auth 429', { ip: req.ip });
  },
});

// Sanitize string inputs - remove control characters and trim
const sanitizeString = (str: string): string => {
  return str
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\s+/g, ' '); // Normalize whitespace
};

const loginSchema = z.object({
  username: z
    .string()
    .min(1)
    .transform(sanitizeString)
    .pipe(z.string().min(1)),
  password: z.string().min(1), // Don't sanitize password - keep as-is
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'invalid_body' });
      return;
    }
    const { username, password } = parseResult.data;
    const user = await validateUserCredentials(username, password);
    if (!user) {
      await logAuditEvent({
        action: 'AUTH_LOGIN_FAILED',
        metadata: { username },
      });
      res.status(401).json({ error: 'invalid_credentials' });
      return;
    }
    const token = signAccessToken(user);
    await ensureUserRecord(user.id, user.username, user.role);
    await logAuditEvent({
      action: 'AUTH_LOGIN_SUCCESS',
      userId: user.id,
    });
    // Persist session via httpOnly cookie so refresh doesn't log the user out (cross-site cookie)
    const maxAgeMs = (config.auth.accessTtlMinutes ?? 30) * 60 * 1000;
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: maxAgeMs,
      path: '/',
    });
    res.json({ token, user });
  } catch (error) {
    console.error('[auth] login failed', error);
    res.status(500).json({ error: 'server_error' });
  }
});

router.post('/logout', (_req, res) => {
  res.cookie(COOKIE_NAME, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 0,
    path: '/',
  });
  res.status(204).send();
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export const authRouter = router;

