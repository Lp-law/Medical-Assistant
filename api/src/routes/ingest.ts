import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { logAuditEvent } from '../services/auditLogger';
import { orchestrateIngestion } from '../services/knowledgeIngest';
import { isValidPdfUpload } from '../utils/pdfValidation';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const ingestLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate_limited' },
});

const bodySchema = z.object({
  docType: z.enum(['chapter', 'precedent']).default('chapter'),
  tags: z
    .preprocess(
      (val) => {
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') {
          return val
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean);
        }
        return [];
      },
      z.array(z.string()).optional()
    )
    .optional(),
  metadata: z
    .preprocess(
      (val) => {
        if (typeof val === 'string') {
          try {
            return JSON.parse(val);
          } catch {
            return {};
          }
        }
        return val ?? {};
      },
      z.record(z.any()).optional()
    )
    .optional(),
  forceEnhancedOcr: z
    .preprocess((val) => {
      if (val === '' || val === undefined || val === null) return undefined;
      if (typeof val === 'string') {
        if (val.toLowerCase() === 'true') return true;
        if (val.toLowerCase() === 'false') return false;
      }
      return val;
    }, z.boolean().optional())
    .optional(),
});

export const ingestRouter = Router();

ingestRouter.post(
  '/pdf',
  requireAuth,
  requireRole('admin'),
  ingestLimiter,
  upload.single('file'),
  async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'file_required' });
      return;
    }

    if (!isValidPdfUpload(req.file)) {
      res.status(400).json({ error: 'invalid_pdf' });
      return;
    }

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_body', details: parsed.error.errors });
      return;
    }

    try {
      const result = await orchestrateIngestion({
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        docType: parsed.data.docType,
        tags: parsed.data.tags ?? [],
        metadata: parsed.data.metadata ?? {},
        forceEnhancedOcr: parsed.data.forceEnhancedOcr ?? false,
      });

      await logAuditEvent({
        action: 'INGEST_PDF',
        userId: req.user?.id,
        entityId: result.id,
        entityType: 'document',
        metadata: { filename: req.file.originalname, size: req.file.size, docType: parsed.data.docType },
      });

      res.json(result);
    } catch (error) {
      console.error('[ingest/pdf] error:', error);
      res.status(500).json({ error: 'ingestion_failed' });
    }
  },
);

