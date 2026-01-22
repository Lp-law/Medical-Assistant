"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentsRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const zod_1 = require("zod");
const uuid_1 = require("uuid");
const prisma_1 = require("../services/prisma");
const auth_1 = require("../middleware/auth");
const storageClient_1 = require("../services/storageClient");
const documentClassifier_1 = require("../services/documentClassifier");
const textExtraction_1 = require("../services/textExtraction");
const summaryUtils_1 = require("../services/summaryUtils");
const client_1 = require("@prisma/client");
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const manualUploadSchema = zod_1.z.object({
    title: zod_1.z.string().min(2).max(240),
    categoryId: zod_1.z.string().min(1).optional(),
    categoryName: zod_1.z.string().min(1).optional(),
    summary: zod_1.z.string().max(4000).optional().default(''),
});
const searchSchema = zod_1.z.object({
    q: zod_1.z.string().optional(),
    categoryId: zod_1.z.string().optional(),
    categoryName: zod_1.z.string().optional(),
    source: zod_1.z.enum(['email', 'manual']).optional(),
    from: zod_1.z.string().optional(),
    to: zod_1.z.string().optional(),
    limit: zod_1.z.string().optional(),
    offset: zod_1.z.string().optional(),
});
const mapSource = (value) => (value === 'email' ? 'EMAIL' : 'MANUAL');
const parseDateOrUndefined = (value) => {
    if (!value)
        return undefined;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};
exports.documentsRouter = (0, express_1.Router)();
exports.documentsRouter.use(auth_1.requireAuth);
const DEFAULT_CATEGORY_NAME = 'פסקי דין';
const resolveCategoryId = async (input) => {
    if (input.categoryId) {
        const existing = await prisma_1.prisma.category.findUnique({ where: { id: input.categoryId } });
        if (existing)
            return existing.id;
    }
    const name = (input.categoryName ?? DEFAULT_CATEGORY_NAME).trim();
    const existingByName = await prisma_1.prisma.category.findUnique({ where: { name } });
    if (existingByName)
        return existingByName.id;
    const created = await prisma_1.prisma.category.create({ data: { name } });
    return created.id;
};
// Manual upload (PDF/DOCX)
exports.documentsRouter.post('/upload', upload.single('file'), async (req, res) => {
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
    const attachmentUrl = await (0, storageClient_1.uploadFileToStorage)(req.file.buffer, req.file.originalname, req.file.mimetype);
    let content = '';
    try {
        content = await (0, textExtraction_1.extractTextFromAttachment)(req.file.buffer, req.file.originalname, req.file.mimetype);
    }
    catch (error) {
        console.warn('[documents/upload] text extraction failed', error);
    }
    const autoSummary = summary?.trim() ? summary.trim() : (0, summaryUtils_1.summarizeFromText)(content);
    const classifierInput = `${title}\n${autoSummary}\n${content ?? ''}`.slice(0, 20000);
    const { topics, keywords } = (0, documentClassifier_1.classifyText)(classifierInput);
    const categoryId = await resolveCategoryId({
        categoryId: parsed.data.categoryId,
        categoryName: parsed.data.categoryName,
    });
    const created = await prisma_1.prisma.document.create({
        data: {
            id: (0, uuid_1.v4)(),
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
// Free-text search + filters
exports.documentsRouter.get('/search', async (req, res) => {
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
    const whereSql = client_1.Prisma.sql `
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
    const documents = await prisma_1.prisma.$queryRaw(client_1.Prisma.sql `
      SELECT
        "d".*,
        "c"."id" AS "category_id",
        "c"."name" AS "category_name"
      FROM "Document" "d"
      JOIN "Category" "c" ON "c"."id" = "d"."categoryId"
      ${whereSql}
      ORDER BY "d"."createdAt" DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
    const totalRow = await prisma_1.prisma.$queryRaw(client_1.Prisma.sql `
      SELECT COUNT(*)::bigint AS count
      FROM "Document" "d"
      JOIN "Category" "c" ON "c"."id" = "d"."categoryId"
      ${whereSql}
    `);
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
exports.documentsRouter.get('/', async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const documents = await prisma_1.prisma.document.findMany({
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: { category: true },
    });
    res.json({ documents, pagination: { limit, offset, count: documents.length } });
});
const tagsSchema = zod_1.z.object({
    topics: zod_1.z.array(zod_1.z.string().min(1).max(80)).default([]),
    keywords: zod_1.z.array(zod_1.z.string().min(1).max(80)).default([]),
});
const normalizeList = (items) => {
    const normalized = (items ?? [])
        .map((v) => (typeof v === 'string' ? v.trim() : ''))
        .filter(Boolean);
    return Array.from(new Set(normalized));
};
// Edit tags on an existing document (topics/keywords)
exports.documentsRouter.put('/:id/tags', (0, auth_1.requireRole)('admin'), async (req, res) => {
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
    const existing = await prisma_1.prisma.document.findUnique({ where: { id } });
    if (!existing) {
        res.status(404).json({ error: 'not_found' });
        return;
    }
    const topics = normalizeList(parsed.data.topics);
    const keywords = normalizeList(parsed.data.keywords);
    const updated = await prisma_1.prisma.document.update({
        where: { id },
        data: { topics, keywords },
        include: { category: true },
    });
    res.json({ document: updated });
});
// Convenience endpoint to reuse summary extraction logic (email previews etc.)
exports.documentsRouter.post('/_extract-summary', async (req, res) => {
    const body = typeof req.body?.body === 'string' ? req.body.body : '';
    const summary = (0, summaryUtils_1.extractSummaryFromEmailBody)(body);
    res.json({ summary });
});
