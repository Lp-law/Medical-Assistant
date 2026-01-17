"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestRouter = void 0;
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const multer_1 = __importDefault(require("multer"));
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const auditLogger_1 = require("../services/auditLogger");
const knowledgeIngest_1 = require("../services/knowledgeIngest");
const pdfValidation_1 = require("../utils/pdfValidation");
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const ingestLimiter = (0, express_rate_limit_1.default)({
    windowMs: 10 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'rate_limited' },
});
const bodySchema = zod_1.z.object({
    docType: zod_1.z.enum(['chapter', 'precedent']).default('chapter'),
    tags: zod_1.z
        .preprocess((val) => {
        if (Array.isArray(val))
            return val;
        if (typeof val === 'string') {
            return val
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean);
        }
        return [];
    }, zod_1.z.array(zod_1.z.string()).optional())
        .optional(),
    metadata: zod_1.z
        .preprocess((val) => {
        if (typeof val === 'string') {
            try {
                return JSON.parse(val);
            }
            catch {
                return {};
            }
        }
        return val ?? {};
    }, zod_1.z.record(zod_1.z.any()).optional())
        .optional(),
    forceEnhancedOcr: zod_1.z
        .preprocess((val) => {
        if (val === '' || val === undefined || val === null)
            return undefined;
        if (typeof val === 'string') {
            if (val.toLowerCase() === 'true')
                return true;
            if (val.toLowerCase() === 'false')
                return false;
        }
        return val;
    }, zod_1.z.boolean().optional())
        .optional(),
});
exports.ingestRouter = (0, express_1.Router)();
exports.ingestRouter.post('/pdf', auth_1.requireAuth, (0, auth_1.requireRole)('admin'), ingestLimiter, upload.single('file'), async (req, res) => {
    if (!req.file) {
        res.status(400).json({ error: 'file_required' });
        return;
    }
    if (!(0, pdfValidation_1.isValidPdfUpload)(req.file)) {
        res.status(400).json({ error: 'invalid_pdf' });
        return;
    }
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'invalid_body', details: parsed.error.errors });
        return;
    }
    try {
        const result = await (0, knowledgeIngest_1.orchestrateIngestion)({
            buffer: req.file.buffer,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
            docType: parsed.data.docType,
            tags: parsed.data.tags ?? [],
            metadata: parsed.data.metadata ?? {},
            forceEnhancedOcr: parsed.data.forceEnhancedOcr ?? false,
        });
        await (0, auditLogger_1.logAuditEvent)({
            action: 'INGEST_PDF',
            userId: req.user?.id,
            entityId: result.id,
            entityType: 'document',
            metadata: { filename: req.file.originalname, size: req.file.size, docType: parsed.data.docType },
        });
        res.json(result);
    }
    catch (error) {
        console.error('[ingest/pdf] error:', error);
        res.status(500).json({ error: 'ingestion_failed' });
    }
});
