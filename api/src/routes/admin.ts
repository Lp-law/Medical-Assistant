import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { runEmailFetcherOnce } from '../jobs/emailFetcher';
import { config } from '../services/env';

export const adminRouter = Router();

adminRouter.use(requireAuth);

const requireAdmin = (req: any, res: any, next: any): void => {
  if (!req.user) {
    res.status(401).json({ error: 'auth_required' });
    return;
  }
  if (req.user.isAdmin !== true) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  next();
};

const safeNumber = (value: bigint): number | string => {
  const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
  if (value > maxSafe) return value.toString();
  return Number(value);
};

// Manual trigger for IMAP ingestion (same logic as cron), admin-only.
adminRouter.post('/email-ingest-now', requireAdmin, async (_req, res) => {
  try {
    if (!config.imap.enabled) {
      res.status(400).json({
        processedMessages: 0,
        documentsCreated: 0,
        lastUid: 0,
        success: false,
        error: 'imap_disabled',
      });
      return;
    }
    const result = await runEmailFetcherOnce();
    res.json({
      processedMessages: result.fetched,
      documentsCreated: result.processed,
      lastUid: safeNumber(result.lastUid),
      success: true,
    });
  } catch (error: any) {
    const message = error?.message ?? 'email_ingest_failed';
    if (message === 'imap_config_missing') {
      res.status(400).json({
        processedMessages: 0,
        documentsCreated: 0,
        lastUid: 0,
        success: false,
        error: 'imap_config_missing',
      });
      return;
    }
    if (message === 'imap_auth_failed') {
      res.status(401).json({
        processedMessages: 0,
        documentsCreated: 0,
        lastUid: 0,
        success: false,
        error: message,
      });
      return;
    }
    if (message === 'imap_connect_failed' || message === 'imap_mailbox_open_failed') {
      res.status(400).json({
        processedMessages: 0,
        documentsCreated: 0,
        lastUid: 0,
        success: false,
        error: message,
      });
      return;
    }
    res.status(500).json({
      processedMessages: 0,
      documentsCreated: 0,
      lastUid: 0,
      success: false,
      error: message,
    });
  }
});


