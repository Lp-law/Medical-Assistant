import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { config } from '../services/env';
import { prisma } from '../services/prisma';
import { uploadTextHealthcheck } from '../services/blobStorage';

export const adminRouter = Router();

const requireAdminTestToken = (req: any, res: any, next: any): void => {
  const configured = process.env.ADMIN_TEST_TOKEN?.trim();
  if (!configured) {
    // Keep endpoint unavailable unless explicitly enabled.
    res.status(503).json({ error: 'blob_healthcheck_disabled' });
    return;
  }
  const provided = String(req.header('x-admin-token') ?? '').trim();
  if (!provided || provided !== configured) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  next();
};

// Temporary endpoint for Azure Blob connectivity validation (remove after verification).
adminRouter.get('/blob-healthcheck', requireAdminTestToken, async (_req, res) => {
  try {
    const uploaded = await uploadTextHealthcheck();
    res.json({
      ok: true,
      container: uploaded.container,
      blobName: uploaded.blobName,
      etag: uploaded.etag,
    });
  } catch (error: any) {
    const message = typeof error?.message === 'string' ? error.message : 'blob_healthcheck_failed';
    res.status(500).json({ ok: false, error: message });
  }
});

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

/** Delete all documents from the knowledge base (admin only). Use with caution. */
adminRouter.delete('/documents/all', requireAdmin, async (_req, res) => {
  try {
    const result = await prisma.document.deleteMany({});
    res.json({ deleted: result.count });
  } catch (error) {
    console.error('[admin] delete all documents failed', error);
    res.status(500).json({ error: 'delete_failed' });
  }
});

// Check Azure OCR configuration
adminRouter.get('/config/ocr', requireAdmin, (_req, res) => {
  const hasOcr = !!(config.ocr.endpoint && config.ocr.key);
  res.json({
    configured: hasOcr,
    endpoint: config.ocr.endpoint ? '***configured***' : 'missing',
    modelId: config.ocr.modelId,
    supportsDoc: hasOcr, // DOC files require Azure OCR
  });
});
