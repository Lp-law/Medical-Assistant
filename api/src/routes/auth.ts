import { Router } from 'express';
import { z } from 'zod';
import { logAuditEvent } from '../services/auditLogger';
import { signAccessToken, validateUserCredentials } from '../services/authService';
import { requireAuth } from '../middleware/auth';
import { ensureUserRecord } from '../services/prisma';
import { config } from '../services/env';

const router = Router();
const COOKIE_NAME = 'lm_access_token';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

router.post('/login', async (req, res) => {
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

