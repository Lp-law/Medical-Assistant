import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
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
