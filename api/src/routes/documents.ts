import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { simpleParser } from 'mailparser';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import { BlobServiceClient } from '@azure/storage-blob';
import os from 'os';
import { prisma } from '../services/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { uploadFileToStorage } from '../services/storageClient';
import { classifyText } from '../services/documentClassifier';
import { extractTextFromAttachment } from '../services/textExtraction';
import { extractSummaryFromEmailBody, summarizeFromText } from '../services/summaryUtils';
import { Prisma } from '@prisma/client';
import { config } from '../services/env';
import { getEmailBodyText } from '../services/emailBody';
import { normalizeAttachmentFilename } from '../services/attachmentUtils';
import { extractEmailsFromPst, convertEmailToEml } from '../services/pstExtractor';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } }); // 500MB for PST files

// Sanitize string inputs - remove control characters and trim
const sanitizeString = (str: string): string => {
  return str
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\s+/g, ' '); // Normalize whitespace
};

const DOC_TYPES = ['פסק דין', 'חוות דעת', 'תחשיב נזק', 'סיכומים', 'מאמר', 'ספר'] as const;

const manualUploadSchema = z.object({
  title: z
    .string()
    .max(240)
    .optional()
    .transform((val) => (val ? sanitizeString(val) : undefined)),
  docType: z.enum(DOC_TYPES),
  categoryId: z.string().min(1).optional(),
  categoryName: z
    .string()
    .min(1)
    .optional()
    .transform((val) => (val ? sanitizeString(val) : val)),
  field: z.string().max(200).optional().transform((val) => (val ? sanitizeString(val) : undefined)),
  expertName: z.string().max(200).optional().transform((val) => (val ? sanitizeString(val) : undefined)),
  articleAuthor: z.string().max(200).optional().transform((val) => (val ? sanitizeString(val) : undefined)),
  articleTitle: z.string().max(400).optional().transform((val) => (val ? sanitizeString(val) : undefined)),
  bookAuthor: z.string().max(200).optional().transform((val) => (val ? sanitizeString(val) : undefined)),
  bookName: z.string().max(400).optional().transform((val) => (val ? sanitizeString(val) : undefined)),
  bookChapter: z.string().max(200).optional().transform((val) => (val ? sanitizeString(val) : undefined)),
  notes: z.string().max(2000).optional().transform((val) => (val ? sanitizeString(val) : undefined)),
  summary: z
    .string()
    .max(4000)
    .optional()
    .default('')
    .transform((val) => (val ? sanitizeString(val) : val)),
});

const searchSchema = z.object({
  q: z
    .string()
    .optional()
    .transform((val) => (val ? sanitizeString(val) : val)),
  categoryId: z.string().min(1).optional(),
  categoryName: z
    .string()
    .optional()
    .transform((val) => (val ? sanitizeString(val) : val)),
  source: z.enum(['email', 'manual']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  matchMode: z.enum(['all', 'any']).optional(),
  phrase: z
    .string()
    .optional()
    .transform((val) => (val ? sanitizeString(val) : val)),
  include: z
    .preprocess(
      (val) => {
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') return val.split(',').map((v) => v.trim()).filter(Boolean);
        return [];
      },
      z.array(z.string()).optional(),
    )
    .optional(),
  exclude: z
    .preprocess(
      (val) => {
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') return val.split(',').map((v) => v.trim()).filter(Boolean);
        return [];
      },
      z.array(z.string()).optional(),
    )
    .optional(),
  categories: z
    .preprocess(
      (val) => {
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') return val.split(',').map((v) => v.trim()).filter(Boolean);
        return [];
      },
      z.array(z.string()).optional(),
    )
    .optional(),
  fieldScope: z.enum(['title', 'title_summary', 'all']).optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

const mapSource = (value: 'email' | 'manual') => (value === 'email' ? ('EMAIL' as const) : ('MANUAL' as const));

const unwrapQuotedPhrase = (input: string): string => {
  const s = (input ?? '').trim();
  if (!s) return '';
  const pairs: Array<[string, string]> = [
    ['"', '"'],
    ['“', '”'],
    ['״', '״'],
  ];
  for (const [open, close] of pairs) {
    if (s.startsWith(open) && s.endsWith(close) && s.length >= open.length + close.length + 1) {
      return s.slice(open.length, s.length - close.length).trim();
    }
  }
  return s;
};

const extractFirstQuotedPhrase = (input: string): string => {
  const s = (input ?? '').trim();
  if (!s) return '';
  const patterns = [/"([^"]{2,200})"/, /“([^”]{2,200})”/, /״([^״]{2,200})״/];
  for (const pattern of patterns) {
    const match = s.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return '';
};

const removeQuotedPhrases = (input: string): string => {
  return (input ?? '')
    .replace(/"[^"]{2,200}"/g, ' ')
    .replace(/“[^”]{2,200}”/g, ' ')
    .replace(/״[^״]{2,200}״/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const parseDateOrUndefined = (value?: string): Date | undefined => {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

const DEFAULT_CATEGORY_NAME = 'פסקי דין';

const buildPublicBaseUrl = (req: any): string => `${req.protocol}://${req.get('host')}`;
const buildAttachmentDownloadUrl = (req: any, id: string): string =>
  `${buildPublicBaseUrl(req)}/api/documents/${encodeURIComponent(id)}/attachment`;

const LOCAL_UPLOADS_DIR = process.env.LOCAL_UPLOADS_DIR
  ? path.resolve(process.env.LOCAL_UPLOADS_DIR)
  : path.join(os.tmpdir(), 'lexmedical-uploads');

const tryParseAzureBlobNameFromUrl = (url: string): string | null => {
  try {
    const u = new URL(url);
    const pathname = decodeURIComponent(u.pathname || '');
    // Expected: /<container>/<blobName>
    const prefix = `/${config.storage.container}/`;
    if (!pathname.startsWith(prefix)) return null;
    const blobName = pathname.slice(prefix.length);
    return blobName || null;
  } catch {
    return null;
  }
};

const resolveCategoryId = async (input: { categoryId?: string; categoryName?: string }): Promise<string> => {
  if (input.categoryId) {
    const existing = await prisma.category.findUnique({ where: { id: input.categoryId } });
    if (existing) return existing.id;
  }
  const name = (input.categoryName ?? DEFAULT_CATEGORY_NAME).trim();
  const existingByName = await prisma.category.findUnique({ where: { name } });
  if (existingByName) return existingByName.id;
  const created = await prisma.category.create({ data: { name } });
  return created.id;
};

type EmlAttachmentCandidate = { filename: string; contentType?: string; content: Buffer };

// Only Word (DOCX) and PDF allowed
const isSupportedAttachment = (filename: string, contentType?: string): boolean => {
  const lower = (filename ?? '').toLowerCase();
  if (lower.endsWith('.pdf') || lower.endsWith('.docx')) return true;
  if (!contentType) return false;
  return (
    contentType === 'application/pdf' ||
    contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
};

const collectEmlAttachments = (parsed: any): EmlAttachmentCandidate[] => {
  const attachments = Array.isArray(parsed?.attachments) ? parsed.attachments : [];
  return attachments
    .map((att: any) => ({
      filename: normalizeAttachmentFilename(att?.filename, att?.contentType),
      contentType: att?.contentType,
      content: Buffer.isBuffer(att?.content) ? att.content : Buffer.from(att?.content ?? ''),
    }))
    .filter((att: EmlAttachmentCandidate) => Boolean(att.filename && att.content?.length))
    .filter((att: EmlAttachmentCandidate) => isSupportedAttachment(att.filename, att.contentType));
};

// Suggestions for field (תחום) and expert name – from existing documents
documentsRouter.get('/field-suggestions', async (_req, res) => {
  const rows = await prisma.$queryRaw<Array<{ field: string | null }>>(
    Prisma.sql`SELECT DISTINCT "field" FROM "Document" WHERE "field" IS NOT NULL AND TRIM("field") <> '' ORDER BY "field" ASC`,
  );
  res.json({ suggestions: rows.map((r) => r.field).filter(Boolean) as string[] });
});

documentsRouter.get('/expert-suggestions', async (_req, res) => {
  const rows = await prisma.$queryRaw<Array<{ expertName: string | null }>>(
    Prisma.sql`SELECT DISTINCT "expertName" FROM "Document" WHERE "expertName" IS NOT NULL AND TRIM("expertName") <> '' ORDER BY "expertName" ASC`,
  );
  res.json({ suggestions: rows.map((r) => r.expertName).filter(Boolean) as string[] });
});

// Manual upload (PDF/DOCX)
documentsRouter.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'file_required' });
    return;
  }

  const parsed = manualUploadSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', details: parsed.error.errors });
    return;
  }

  // Check if file type is supported (only PDF and Word/DOCX)
  const filename = req.file.originalname;
  if (!isSupportedAttachment(filename, req.file.mimetype)) {
    const ext = filename.toLowerCase().split('.').pop() || 'unknown';
    res.status(400).json({ error: 'unsupported_file_type', message: `סוג קובץ לא נתמך: ${ext}. ניתן להעלות רק קבצי PDF ו-Word (DOCX).` });
    return;
  }

  const { docType, field, expertName, articleAuthor, articleTitle, bookAuthor, bookName, bookChapter, notes, summary } = parsed.data;
  const titleFromBody = parsed.data.title?.trim();
  const titleFromFile = (req.file.originalname || 'document').replace(/\.(pdf|docx)$/i, '').trim() || 'מסמך';
  const title = (titleFromBody && titleFromBody.length >= 2) ? titleFromBody.slice(0, 240) : titleFromFile.slice(0, 240);
  const attachmentUrl = await uploadFileToStorage(req.file.buffer, req.file.originalname, req.file.mimetype);

  // Ensure attachmentUrl is always set if we have a valid file
  if (!attachmentUrl) {
    res.status(500).json({ error: 'upload_failed', message: 'שגיאה בשמירת הקובץ לאחסון' });
    return;
  }

  let content = '';
  try {
    content = await extractTextFromAttachment(req.file.buffer, req.file.originalname, req.file.mimetype);
  } catch (error) {
    console.warn('[documents/upload] text extraction failed', error);
  }
  const autoSummary = summary?.trim() ? summary.trim() : summarizeFromText(content);
  const classifierInput = `${title}\n${autoSummary}\n${content ?? ''}`.slice(0, 20000);
  const { topics, keywords } = classifyText(classifierInput);

  const categoryId = await resolveCategoryId({
    categoryId: parsed.data.categoryId,
    categoryName: docType,
  });

  const created = await prisma.document.create({
    data: {
      id: uuid(),
      title,
      summary: autoSummary ?? '',
      content: content ? content.slice(0, 100_000) : null,
      categoryId,
      keywords,
      topics,
      source: mapSource('manual'),
      docType,
      field: field ?? null,
      expertName: expertName ?? null,
      articleAuthor: articleAuthor ?? null,
      articleTitle: articleTitle ?? null,
      bookAuthor: bookAuthor ?? null,
      bookName: bookName ?? null,
      bookChapter: bookChapter ?? null,
      notes: notes ?? null,
      attachmentUrl,
      attachmentMime: req.file.mimetype,
    },
    include: { category: true },
  });

  res.status(201).json({
    document: {
      ...created,
      attachmentUrl: created.attachmentUrl ? buildAttachmentDownloadUrl(req, created.id) : null,
    },
  });
});

// Download attachment (works for Azure blobs and local fallback storage)
documentsRouter.get('/:id/attachment', async (req, res) => {
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: 'document_id_required' });
    return;
  }

  const doc = await prisma.document.findUnique({
    where: { id },
    select: { id: true, title: true, attachmentUrl: true, attachmentMime: true },
  });
  if (!doc || !doc.attachmentUrl) {
    res.status(404).json({ error: 'attachment_not_found' });
    return;
  }

  const mime = doc.attachmentMime ?? 'application/octet-stream';
  res.setHeader('Content-Type', mime);
  // Force download to avoid opening binary content in-browser unexpectedly.
  const fallbackName = (doc.title ?? 'attachment').toString().slice(0, 180);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fallbackName)}`);

  // Local fallback storage: "local:<storedName>"
  if (doc.attachmentUrl.startsWith('local:')) {
    const storedName = doc.attachmentUrl.slice('local:'.length);
    const fullPath = path.join(LOCAL_UPLOADS_DIR, storedName);
    try {
      // Ensure file exists before streaming
      await fs.stat(fullPath);
      createReadStream(fullPath).pipe(res);
      return;
    } catch (e) {
      res.status(404).json({ error: 'attachment_file_missing' });
      return;
    }
  }

  // Azure blob storage (preferred) – try server-side download using credentials if configured.
  const blobName = tryParseAzureBlobNameFromUrl(doc.attachmentUrl);
  if (blobName && config.storage.connectionString) {
    try {
      const svc = BlobServiceClient.fromConnectionString(config.storage.connectionString);
      const containerClient = svc.getContainerClient(config.storage.container);
      const blobClient = containerClient.getBlobClient(blobName);
      const download = await blobClient.download();
      if (!download.readableStreamBody) {
        res.status(502).json({ error: 'attachment_download_failed' });
        return;
      }
      download.readableStreamBody.pipe(res);
      return;
    } catch (e) {
      console.warn('[documents/attachment] azure download failed, falling back to direct fetch', e);
    }
  }

  // Last resort: direct HTTP fetch (works for public blobs or signed URLs)
  try {
    const r = await fetch(doc.attachmentUrl);
    if (!r.ok || !r.body) {
      res.status(502).json({ error: 'attachment_fetch_failed' });
      return;
    }
    const { Readable } = await import('stream');
    Readable.fromWeb(r.body as unknown as any).pipe(res);
    return;
  } catch (e) {
    res.status(502).json({ error: 'attachment_fetch_failed' });
    return;
  }
});

// Manual email import (.eml) → parse body + attachments, ingest like IMAP
documentsRouter.post('/upload-eml', upload.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'file_required' });
    return;
  }
  const name = (req.file.originalname ?? '').toLowerCase();
  const isEml = name.endsWith('.eml') || req.file.mimetype === 'message/rfc822';
  if (!isEml) {
    res.status(400).json({ error: 'eml_required' });
    return;
  }

  let parsed: any;
  try {
    parsed = await simpleParser(req.file.buffer);
  } catch (error) {
    console.warn('[documents/upload-eml] failed to parse eml', error);
    res.status(400).json({ error: 'eml_parse_failed' });
    return;
  }

  const bodyText = getEmailBodyText(parsed);
  const bodySummary = extractSummaryFromEmailBody(bodyText) ?? '';
  const allAttachments = Array.isArray(parsed?.attachments) ? parsed.attachments : [];
  const attachments = collectEmlAttachments(parsed);
  if (!attachments.length) {
    const total = allAttachments.length;
    const unsupported = allAttachments.filter((att: any) => {
      const filename = normalizeAttachmentFilename(att?.filename, att?.contentType);
      return !isSupportedAttachment(filename, att?.contentType);
    });
    if (total > 0 && unsupported.length > 0) {
      const unsupportedTypes = unsupported.map((att: any) => {
        const filename = normalizeAttachmentFilename(att?.filename, att?.contentType);
        const ext = filename.toLowerCase().split('.').pop() || 'unknown';
        return ext === 'doc' ? 'DOC (לא נתמך - נדרש DOCX)' : ext;
      });
      res.status(400).json({
        error: 'unsupported_attachment_type',
        message: `הקובץ המצורף לא נתמך. סוגים נתמכים: PDF, DOCX. קבצים שנמצאו: ${unsupportedTypes.join(', ')}`,
        unsupportedTypes,
      });
      return;
    }
    res.status(400).json({ error: 'attachment_required', message: 'לא נמצאו קבצים מצורפים נתמכים במייל' });
    return;
  }

  const categoryId = await resolveCategoryId({ categoryName: DEFAULT_CATEGORY_NAME });
  const createdDocs: any[] = [];

    let idx = 0;
    for (const attachment of attachments) {
      idx += 1;
      const attachmentUrl = await uploadFileToStorage(
        attachment.content,
        attachment.filename,
        attachment.contentType ?? 'application/octet-stream',
      );

      // Ensure attachmentUrl is always set if we have a valid attachment
      if (!attachmentUrl) {
        console.warn('[documents/upload-eml] failed to upload attachment to storage', {
          filename: attachment.filename,
          contentType: attachment.contentType,
          size: attachment.content?.length,
        });
        continue;
      }

      let attachmentText = '';
      try {
        attachmentText = await extractTextFromAttachment(attachment.content, attachment.filename, attachment.contentType);
      } catch (error) {
        console.warn('[documents/upload-eml] attachment text extraction failed', error);
        attachmentText = '';
      }

    const autoSummary = bodySummary.trim() ? bodySummary.trim() : summarizeFromText(attachmentText);
    const mergedContent = [bodyText?.trim(), attachmentText?.trim()].filter(Boolean).join('\n\n').slice(0, 100_000);
    const classifierInput = `${autoSummary}\n${mergedContent}`.slice(0, 20000);
    const { topics, keywords } = classifyText(classifierInput);

    const created = await prisma.document.create({
      data: {
        id: uuid(),
        title: attachment.filename || 'email-attachment',
        summary: autoSummary ?? '',
        content: mergedContent ? mergedContent : null,
        categoryId,
        keywords,
        topics,
        source: mapSource('email'),
        emailMessageId: `eml:${uuid()}:${idx}`,
        attachmentUrl,
        attachmentMime: attachment.contentType ?? null,
      },
      include: { category: true },
    });
    createdDocs.push(created);
  }

  res.status(201).json({ documents: createdDocs, attachmentsProcessed: createdDocs.length });
});

// PST file import – extract all emails and process them
documentsRouter.post('/upload-pst', upload.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'file_required' });
    return;
  }
  const name = (req.file.originalname ?? '').toLowerCase();
  const isPst = name.endsWith('.pst');
  if (!isPst) {
    res.status(400).json({ error: 'pst_required', message: 'קובץ PST נדרש' });
    return;
  }

  try {
    // Extract all emails from PST
    const extractedEmails = await extractEmailsFromPst(req.file.buffer);
    
    if (extractedEmails.length === 0) {
      res.status(400).json({ error: 'no_emails_found', message: 'לא נמצאו מיילים בקובץ PST' });
      return;
    }

    const categoryId = await resolveCategoryId({ categoryName: DEFAULT_CATEGORY_NAME });
    const createdDocs: any[] = [];
    let totalAttachments = 0;
    let processedEmails = 0;

    // Process each email
    for (const email of extractedEmails) {
      // Convert email to EML format and parse it
      const emlContent = convertEmailToEml(email);
      const emlBuffer = Buffer.from(emlContent, 'utf-8');
      
      let parsed: any;
      try {
        parsed = await simpleParser(emlBuffer);
      } catch (error) {
        console.warn('[documents/upload-pst] failed to parse converted EML', { subject: email.subject, error });
        continue;
      }

      const bodyText = getEmailBodyText(parsed);
      const bodySummary = extractSummaryFromEmailBody(bodyText) ?? '';
      const attachments = collectEmlAttachments(parsed);

      if (!attachments.length) {
        // Email without attachments - skip or create document from body only?
        continue;
      }

      totalAttachments += attachments.length;
      processedEmails += 1;

      let idx = 0;
      for (const attachment of attachments) {
        idx += 1;
        const attachmentUrl = await uploadFileToStorage(
          attachment.content,
          attachment.filename,
          attachment.contentType ?? 'application/octet-stream',
        );

        if (!attachmentUrl) {
          console.warn('[documents/upload-pst] failed to upload attachment to storage', {
            filename: attachment.filename,
            contentType: attachment.contentType,
            size: attachment.content?.length,
          });
          continue;
        }

        let attachmentText = '';
        try {
          attachmentText = await extractTextFromAttachment(attachment.content, attachment.filename, attachment.contentType);
        } catch (error) {
          console.warn('[documents/upload-pst] attachment text extraction failed', error);
          attachmentText = '';
        }

        const autoSummary = bodySummary.trim() ? bodySummary.trim() : summarizeFromText(attachmentText);
        const mergedContent = [bodyText?.trim(), attachmentText?.trim()].filter(Boolean).join('\n\n').slice(0, 100_000);
        const classifierInput = `${autoSummary}\n${mergedContent}`.slice(0, 20000);
        const { topics, keywords } = classifyText(classifierInput);

        const created = await prisma.document.create({
          data: {
            id: uuid(),
            title: attachment.filename || email.subject || 'email-attachment',
            summary: autoSummary ?? '',
            content: mergedContent ? mergedContent : null,
            categoryId,
            keywords,
            topics,
            source: mapSource('email'),
            emailMessageId: `pst:${email.messageId}:${idx}`,
            emailFrom: email.from,
            emailSubject: email.subject,
            emailDate: email.date,
            attachmentUrl,
            attachmentMime: attachment.contentType ?? null,
          },
          include: { category: true },
        });
        createdDocs.push(created);
      }
    }

    res.status(201).json({
      documents: createdDocs,
      emailsProcessed: processedEmails,
      totalEmails: extractedEmails.length,
      attachmentsProcessed: totalAttachments,
      documentsCreated: createdDocs.length,
    });
  } catch (error) {
    console.error('[documents/upload-pst] failed to process PST', error);
    res.status(500).json({
      error: 'pst_processing_failed',
      message: error instanceof Error ? error.message : 'שגיאה בעיבוד קובץ PST',
    });
  }
});

// Batch manual email import (.eml) – upload many files at once (folder import)
documentsRouter.post('/upload-eml-batch', upload.array('files', 500), async (req, res) => {
  const files = Array.isArray((req as any).files) ? ((req as any).files as Express.Multer.File[]) : [];
  if (!files.length) {
    res.status(400).json({ error: 'files_required' });
    return;
  }

  const categoryId = await resolveCategoryId({ categoryName: DEFAULT_CATEGORY_NAME });

  const results: Array<{
    fileName: string;
    status: 'ok' | 'error';
    attachmentsProcessed?: number;
    documentsCreated?: number;
    error?: string;
  }> = [];

  let totalDocs = 0;
  let totalAttachments = 0;

  for (const file of files) {
    const originalName = file?.originalname ?? 'file.eml';
    try {
      const name = originalName.toLowerCase();
      const isEml = name.endsWith('.eml') || file.mimetype === 'message/rfc822';
      if (!isEml) {
        results.push({ fileName: originalName, status: 'error', error: 'eml_required' });
        continue;
      }

      let parsed: any;
      try {
        parsed = await simpleParser(file.buffer);
      } catch (error) {
        console.warn('[documents/upload-eml-batch] failed to parse eml', { fileName: originalName, error });
        results.push({ fileName: originalName, status: 'error', error: 'eml_parse_failed' });
        continue;
      }

      const bodyText = getEmailBodyText(parsed);
      const bodySummary = extractSummaryFromEmailBody(bodyText) ?? '';
      const allAttachments = Array.isArray(parsed?.attachments) ? parsed.attachments : [];
      const attachments = collectEmlAttachments(parsed);
      if (!attachments.length) {
        const total = allAttachments.length;
        const unsupported = allAttachments.filter((att: any) => {
          const filename = normalizeAttachmentFilename(att?.filename, att?.contentType);
          return !isSupportedAttachment(filename, att?.contentType);
        });
        if (total > 0 && unsupported.length > 0) {
          const unsupportedTypes = unsupported.map((att: any) => {
            const filename = normalizeAttachmentFilename(att?.filename, att?.contentType);
            const ext = filename.toLowerCase().split('.').pop() || 'unknown';
            return ext;
          });
          results.push({
            fileName: originalName,
            status: 'error',
            error: `unsupported_attachment_type: ${unsupportedTypes.join(', ')}`,
          });
          continue;
        }
        results.push({
          fileName: originalName,
          status: 'error',
          error: 'attachment_required',
        });
        continue;
      }

      const createdDocs: any[] = [];
      let idx = 0;
      for (const attachment of attachments) {
        idx += 1;
        const attachmentUrl = await uploadFileToStorage(
          attachment.content,
          attachment.filename,
          attachment.contentType ?? 'application/octet-stream',
        );

        // Ensure attachmentUrl is always set if we have a valid attachment
        if (!attachmentUrl) {
          console.warn('[documents/upload-eml-batch] failed to upload attachment to storage', {
            fileName: originalName,
            filename: attachment.filename,
            contentType: attachment.contentType,
            size: attachment.content?.length,
          });
          continue;
        }

        let attachmentText = '';
        try {
          attachmentText = await extractTextFromAttachment(attachment.content, attachment.filename, attachment.contentType);
        } catch (error) {
          console.warn('[documents/upload-eml-batch] attachment text extraction failed', { fileName: originalName, error });
          attachmentText = '';
        }

        const autoSummary = bodySummary.trim() ? bodySummary.trim() : summarizeFromText(attachmentText);
        const mergedContent = [bodyText?.trim(), attachmentText?.trim()].filter(Boolean).join('\n\n').slice(0, 100_000);
        const classifierInput = `${autoSummary}\n${mergedContent}`.slice(0, 20000);
        const { topics, keywords } = classifyText(classifierInput);

        const created = await prisma.document.create({
          data: {
            id: uuid(),
            title: attachment.filename || 'email-attachment',
            summary: autoSummary ?? '',
            content: mergedContent ? mergedContent : null,
            categoryId,
            keywords,
            topics,
            source: mapSource('email'),
            emailMessageId: `eml:${uuid()}:${idx}`,
            attachmentUrl,
            attachmentMime: attachment.contentType ?? null,
          },
          include: { category: true },
        });
        createdDocs.push({
          ...created,
          attachmentUrl: created.attachmentUrl ? buildAttachmentDownloadUrl(req, created.id) : null,
        });
      }

      totalAttachments += attachments.length;
      totalDocs += createdDocs.length;
      results.push({
        fileName: originalName,
        status: 'ok',
        attachmentsProcessed: attachments.length,
        documentsCreated: createdDocs.length,
      });
    } catch (e: any) {
      console.warn('[documents/upload-eml-batch] failed', { fileName: originalName, error: e });
      results.push({ fileName: originalName, status: 'error', error: e?.message ?? 'server_error' });
    }
  }

  res.status(201).json({
    filesProcessed: files.length,
    attachmentsProcessed: totalAttachments,
    documentsCreated: totalDocs,
    results,
  });
});

// Free-text search + filters
documentsRouter.get('/search', async (req, res) => {
  const parsed = searchSchema.safeParse(req.query ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_query', details: parsed.error.errors });
    return;
  }

  const q = unwrapQuotedPhrase((parsed.data.q ?? '').trim());
  const matchMode = parsed.data.matchMode ?? 'any';
  const fieldScope = parsed.data.fieldScope ?? 'all';
  const phraseFromQ = extractFirstQuotedPhrase(parsed.data.q ?? '');
  const phrase = (parsed.data.phrase?.trim() || phraseFromQ || '').slice(0, 200);
  const includeTerms = (parsed.data.include ?? []).map((x) => sanitizeString(String(x))).filter(Boolean).slice(0, 20);
  const excludeTerms = (parsed.data.exclude ?? []).map((x) => sanitizeString(String(x))).filter(Boolean).slice(0, 20);
  const categories = (parsed.data.categories ?? []).map((x) => sanitizeString(String(x))).filter(Boolean).slice(0, 10);
  const tokenizedQ = removeQuotedPhrases(parsed.data.q ?? '')
    .split(/\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 2)
    .slice(0, 20);
  const categoryId = typeof parsed.data.categoryId === 'string' ? parsed.data.categoryId : undefined;
  const categoryName = typeof parsed.data.categoryName === 'string' ? parsed.data.categoryName.trim() : undefined;
  const source = parsed.data.source ? mapSource(parsed.data.source) : undefined;
  const from = parseDateOrUndefined(parsed.data.from);
  const to = parseDateOrUndefined(parsed.data.to);
  const limit = Math.min(Math.max(Number(parsed.data.limit ?? 25) || 25, 1), 50);
  const offset = Math.max(Number(parsed.data.offset ?? 0) || 0, 0);

  // Backwards-compatible q behavior: if only q exists and no advanced fields, use legacy ILIKE broad search.
  const hasAdvancedFilters =
    Boolean(phrase) ||
    includeTerms.length > 0 ||
    excludeTerms.length > 0 ||
    categories.length > 0 ||
    fieldScope !== 'all' ||
    matchMode !== 'any';
  const hasTextSearch = q && q.length > 0;
  const ilike = hasTextSearch && !hasAdvancedFilters ? `%${q}%` : null;
  const categoryIdVal = categoryId ?? null;
  const categoryNameVal = categoryName ? `%${categoryName}%` : null;
  const categoryNamesVal = categories;
  const sourceVal = source ?? null;
  const fromVal = from ?? null;
  const toVal = to ?? null;

  const scopeExprs: Prisma.Sql[] =
    fieldScope === 'title'
      ? [Prisma.sql`"d"."title"`]
      : fieldScope === 'title_summary'
        ? [Prisma.sql`"d"."title"`, Prisma.sql`"d"."summary"`]
        : [
            Prisma.sql`"d"."title"`,
            Prisma.sql`"d"."summary"`,
            Prisma.sql`COALESCE("d"."content", '')`,
            Prisma.sql`array_to_string("d"."topics", ' ')`,
            Prisma.sql`array_to_string("d"."keywords", ' ')`,
          ];

  const makeScopeLike = (term: string): Prisma.Sql => {
    const p = `%${term}%`;
    const checks = scopeExprs.map((expr) => Prisma.sql`${expr} ILIKE ${p}`);
    return checks.length === 1 ? checks[0] : Prisma.sql`(${Prisma.join(checks, ' OR ')})`;
  };

  const advancedConditions: Prisma.Sql[] = [];
  if (phrase) {
    advancedConditions.push(makeScopeLike(phrase));
  }
  includeTerms.forEach((term) => {
    advancedConditions.push(makeScopeLike(term));
  });
  excludeTerms.forEach((term) => {
    advancedConditions.push(Prisma.sql`NOT (${makeScopeLike(term)})`);
  });
  if (tokenizedQ.length > 0) {
    if (matchMode === 'all') {
      tokenizedQ.forEach((t) => advancedConditions.push(makeScopeLike(t)));
    } else {
      const ors = tokenizedQ.map((t) => makeScopeLike(t));
      advancedConditions.push(ors.length === 1 ? ors[0] : Prisma.sql`(${Prisma.join(ors, ' OR ')})`);
    }
  }

  const advancedSql =
    advancedConditions.length > 0 ? Prisma.sql`AND (${Prisma.join(advancedConditions, ' AND ')})` : Prisma.empty;
  const categoryNamesSql =
    categoryNamesVal.length > 0 ? Prisma.sql`AND "c"."name" IN (${Prisma.join(categoryNamesVal)})` : Prisma.empty;

  const whereSql = Prisma.sql`
    WHERE
      (${ilike}::text IS NULL OR (
        "d"."title" ILIKE ${ilike} OR
        "d"."summary" ILIKE ${ilike} OR
        COALESCE("d"."content", '') ILIKE ${ilike} OR
        array_to_string("d"."topics", ' ') ILIKE ${ilike} OR
        array_to_string("d"."keywords", ' ') ILIKE ${ilike} OR
        COALESCE("d"."docType", '') ILIKE ${ilike} OR
        COALESCE("d"."field", '') ILIKE ${ilike} OR
        COALESCE("d"."expertName", '') ILIKE ${ilike} OR
        COALESCE("d"."articleAuthor", '') ILIKE ${ilike} OR
        COALESCE("d"."articleTitle", '') ILIKE ${ilike} OR
        COALESCE("d"."bookAuthor", '') ILIKE ${ilike} OR
        COALESCE("d"."bookName", '') ILIKE ${ilike} OR
        COALESCE("d"."bookChapter", '') ILIKE ${ilike} OR
        COALESCE("d"."notes", '') ILIKE ${ilike}
      ))
      AND (${categoryIdVal}::text IS NULL OR "d"."categoryId" = ${categoryIdVal}::text)
      AND (${categoryNameVal}::text IS NULL OR "c"."name" ILIKE ${categoryNameVal})
      ${categoryNamesSql}
      AND (${sourceVal}::"DocumentSource" IS NULL OR "d"."source" = ${sourceVal}::"DocumentSource")
      AND (${fromVal}::timestamptz IS NULL OR "d"."createdAt" >= ${fromVal}::timestamptz)
      AND (${toVal}::timestamptz IS NULL OR "d"."createdAt" <= ${toVal}::timestamptz)
      ${advancedSql}
  `;

  const documents = await prisma.$queryRaw<any[]>(
    Prisma.sql`
      SELECT
        "d".*,
        "c"."id" AS "category_id",
        "c"."name" AS "category_name"
      FROM "Document" "d"
      JOIN "Category" "c" ON "c"."id" = "d"."categoryId"
      ${whereSql}
      ORDER BY "d"."createdAt" DESC
      LIMIT ${limit} OFFSET ${offset}
    `,
  );

  const totalRow = await prisma.$queryRaw<Array<{ count: bigint }>>(
    Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "Document" "d"
      JOIN "Category" "c" ON "c"."id" = "d"."categoryId"
      ${whereSql}
    `,
  );
  const total = Number(totalRow?.[0]?.count ?? BigInt(0));

  res.json({
    documents: documents.map((row) => ({
      ...row,
      category: { id: row.category_id, name: row.category_name },
      categoryName: row.category_name,
      snippet: ((row.summary as string) || (row.content as string) || '').slice(0, 280),
      attachmentUrl: row.attachmentUrl ? buildAttachmentDownloadUrl(req, String(row.id)) : null,
    })),
    pagination: { limit, offset, total },
    normalizedQuery: {
      q: parsed.data.q ?? '',
      phrase: phrase || null,
      include: includeTerms,
      exclude: excludeTerms,
      tokens: tokenizedQ,
      matchMode,
      fieldScope,
      categories,
    },
  });
});

// List (simple)
documentsRouter.get('/', async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const documents = await prisma.document.findMany({
    orderBy: { createdAt: 'desc' },
    skip: offset,
    take: limit,
    include: { category: true },
  });
  res.json({
    documents: documents.map((d) => ({
      ...d,
      attachmentUrl: d.attachmentUrl ? buildAttachmentDownloadUrl(req, d.id) : null,
    })),
    pagination: { limit, offset, count: documents.length },
  });
});

const tagsSchema = z.object({
  topics: z.array(z.string().min(1).max(80)).default([]),
  keywords: z.array(z.string().min(1).max(80)).default([]),
});

const normalizeList = (items: string[]): string[] => {
  const normalized = (items ?? [])
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  return Array.from(new Set(normalized));
};

// Edit tags on an existing document (topics/keywords)
documentsRouter.put('/:id/tags', requireRole('admin'), async (req, res) => {
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: 'document_id_required' });
    return;
  }

  const parsed = tagsSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', details: parsed.error.errors });
    return;
  }

  const existing = await prisma.document.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'not_found' });
    return;
  }

  const topics = normalizeList(parsed.data.topics);
  const keywords = normalizeList(parsed.data.keywords);

  const updated = await prisma.document.update({
    where: { id },
    data: { topics, keywords },
    include: { category: true },
  });

  res.json({ document: updated });
});

// Convenience endpoint to reuse summary extraction logic (email previews etc.)
documentsRouter.post('/_extract-summary', async (req, res) => {
  const body = typeof req.body?.body === 'string' ? req.body.body : '';
  const summary = extractSummaryFromEmailBody(body);
  res.json({ summary });
});


