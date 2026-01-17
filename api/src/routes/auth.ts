import { Router } from 'express';
import { z } from 'zod';
import { logAuditEvent } from '../services/auditLogger';
import { signAccessToken, validateUserCredentials } from '../services/authService';
import { requireAuth } from '../middleware/auth';
import { ensureUserRecord } from '../services/prisma';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

router.post('/login', async (req, res) => {
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
  res.json({ token, user });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export const authRouter = router;

