import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { config } from '../services/env';
import { prisma } from '../services/prisma';

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
