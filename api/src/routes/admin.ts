import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { runEmailFetcherOnce } from '../jobs/emailFetcher';

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
    const result = await runEmailFetcherOnce();
    res.json({
      processedMessages: result.fetched,
      documentsCreated: result.processed,
      lastUid: safeNumber(result.lastUid),
      success: true,
    });
  } catch (error: any) {
    res.status(500).json({
      processedMessages: 0,
      documentsCreated: 0,
      lastUid: 0,
      success: false,
      error: error?.message ?? 'email_ingest_failed',
    });
  }
});


