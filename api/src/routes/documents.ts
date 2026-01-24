import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { simpleParser } from 'mailparser';
import { prisma } from '../services/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { uploadFileToStorage } from '../services/storageClient';
import { classifyText } from '../services/documentClassifier';
import { extractTextFromAttachment } from '../services/textExtraction';
import { extractSummaryFromEmailBody, summarizeFromText } from '../services/summaryUtils';
import { Prisma } from '@prisma/client';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const manualUploadSchema = z.object({
  title: z.string().min(2).max(240),
  categoryId: z.string().min(1).optional(),
  categoryName: z.string().min(1).optional(),
  summary: z.string().max(4000).optional().default(''),
});

const searchSchema = z.object({
  q: z.string().optional(),
  categoryId: z.string().optional(),
  categoryName: z.string().optional(),
  source: z.enum(['email', 'manual']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

const mapSource = (value: 'email' | 'manual') => (value === 'email' ? ('EMAIL' as const) : ('MANUAL' as const));

const parseDateOrUndefined = (value?: string): Date | undefined => {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

const DEFAULT_CATEGORY_NAME = 'פסקי דין';

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

const isSupportedAttachment = (filename: string, contentType?: string): boolean => {
  const lower = (filename ?? '').toLowerCase();
  if (lower.endsWith('.pdf') || lower.endsWith('.docx') || lower.endsWith('.doc')) return true;
  if (!contentType) return false;
  return (
    contentType === 'application/pdf' ||
    contentType === 'application/msword' ||
    contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
};

const collectEmlAttachments = (parsed: any): EmlAttachmentCandidate[] => {
  const attachments = Array.isArray(parsed?.attachments) ? parsed.attachments : [];
  return attachments
    .map((att: any) => ({
      filename: att?.filename || 'attachment',
      contentType: att?.contentType,
      content: Buffer.isBuffer(att?.content) ? att.content : Buffer.from(att?.content ?? ''),
    }))
    .filter((att: EmlAttachmentCandidate) => Boolean(att.filename && att.content?.length))
    .filter((att: EmlAttachmentCandidate) => isSupportedAttachment(att.filename, att.contentType));
};

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

  const { title, summary } = parsed.data;
  const attachmentUrl = await uploadFileToStorage(req.file.buffer, req.file.originalname, req.file.mimetype);

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
    categoryName: parsed.data.categoryName,
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
      attachmentUrl,
      attachmentMime: req.file.mimetype,
    },
    include: { category: true },
  });

  res.status(201).json({ document: created });
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

  const bodyText = (parsed?.text ?? '').toString();
  const bodySummary = extractSummaryFromEmailBody(bodyText) ?? '';
  const attachments = collectEmlAttachments(parsed);
  if (!attachments.length) {
    res.status(400).json({ error: 'attachment_required' });
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

// Free-text search + filters
documentsRouter.get('/search', async (req, res) => {
  const parsed = searchSchema.safeParse(req.query ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_query', details: parsed.error.errors });
    return;
  }

  const q = (parsed.data.q ?? '').trim();
  const categoryId = typeof parsed.data.categoryId === 'string' ? parsed.data.categoryId : undefined;
  const categoryName = typeof parsed.data.categoryName === 'string' ? parsed.data.categoryName.trim() : undefined;
  const source = parsed.data.source ? mapSource(parsed.data.source) : undefined;
  const from = parseDateOrUndefined(parsed.data.from);
  const to = parseDateOrUndefined(parsed.data.to);
  const limit = Math.min(Math.max(Number(parsed.data.limit ?? 25) || 25, 1), 50);
  const offset = Math.max(Number(parsed.data.offset ?? 0) || 0, 0);

  // Use Postgres ILIKE across title/summary/content + TEXT[] (topics/keywords) via array_to_string
  const ilike = q ? `%${q}%` : null;
  const categoryIdVal = categoryId ?? null;
  const categoryNameVal = categoryName ? `%${categoryName}%` : null;
  const sourceVal = source ?? null;
  const fromVal = from ?? null;
  const toVal = to ?? null;

  const whereSql = Prisma.sql`
    WHERE
      (${ilike}::text IS NULL OR (
        "d"."title" ILIKE ${ilike} OR
        "d"."summary" ILIKE ${ilike} OR
        COALESCE("d"."content", '') ILIKE ${ilike} OR
        array_to_string("d"."topics", ' ') ILIKE ${ilike} OR
        array_to_string("d"."keywords", ' ') ILIKE ${ilike}
      ))
      AND (${categoryIdVal}::text IS NULL OR "d"."categoryId" = ${categoryIdVal}::text)
      AND (${categoryNameVal}::text IS NULL OR "c"."name" ILIKE ${categoryNameVal})
      AND (${sourceVal}::"DocumentSource" IS NULL OR "d"."source" = ${sourceVal}::"DocumentSource")
      AND (${fromVal}::timestamptz IS NULL OR "d"."createdAt" >= ${fromVal}::timestamptz)
      AND (${toVal}::timestamptz IS NULL OR "d"."createdAt" <= ${toVal}::timestamptz)
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
    })),
    pagination: { limit, offset, total },
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
  res.json({ documents, pagination: { limit, offset, count: documents.length } });
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


