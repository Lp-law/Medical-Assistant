"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.casesRouter = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const prisma_1 = require("../services/prisma");
const auditLogger_1 = require("../services/auditLogger");
const caseLifecycle_1 = require("../services/caseLifecycle");
const caseExporter_1 = require("../services/caseExporter");
const router = (0, express_1.Router)();
const createCaseSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200).optional(),
    data: zod_1.z.record(zod_1.z.any()).optional(),
});
const updateCaseSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200).optional(),
    data: zod_1.z.record(zod_1.z.any()).optional(),
});
const metadataSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200).optional(),
    topicSummary: zod_1.z.string().max(160).optional(),
});
const exportSchema = zod_1.z.object({
    format: zod_1.z.enum(['pdf', 'json']).default('pdf'),
});
router.use(auth_1.requireAuth);
const ensureOwner = async (caseId, userId) => {
    const record = await prisma_1.prisma.case.findFirst({ where: { id: caseId, ownerId: userId } });
    if (!record) {
        const error = new Error('case_not_found');
        error.status = 404;
        throw error;
    }
    return record;
};
router.get('/', async (req, res) => {
    const allCases = await prisma_1.prisma.case.findMany({
        orderBy: { updatedAt: 'desc' },
    });
    const ownCases = allCases.filter((record) => record.ownerId === req.user.id).map((record) => (0, caseLifecycle_1.buildOwnerCaseResponse)(record, req.user.id));
    const otherCases = allCases
        .filter((record) => record.ownerId !== req.user.id)
        .map((record) => (0, caseLifecycle_1.buildPublicCaseResponse)(record, req.user.id));
    res.json({ ownCases, otherCases });
});
router.post('/', async (req, res) => {
    const parseResult = createCaseSchema.safeParse(req.body);
    if (!parseResult.success) {
        res.status(400).json({ error: 'invalid_body' });
        return;
    }
    const payload = parseResult.data;
    const now = new Date();
    const created = await prisma_1.prisma.case.create({
        data: {
            ownerId: req.user.id,
            title: payload.title ?? 'תיק חדש',
            topicSummary: (0, caseLifecycle_1.generateCaseTopicSummary)(payload.title ?? '', payload.data),
            data: payload.data ?? {},
            lastAccessedAt: now,
            retentionExpiresAt: (0, caseLifecycle_1.addDays)(now, caseLifecycle_1.RETENTION_DAYS),
            status: client_1.CaseStatus.ACTIVE,
        },
    });
    await (0, auditLogger_1.logAuditEvent)({
        action: 'CASE_CREATED',
        userId: req.user.id,
        entityType: 'case',
        entityId: created.id,
        metadata: { title: created.title },
    });
    res.status(201).json({ case: (0, caseLifecycle_1.buildOwnerCaseResponse)(created, req.user.id) });
});
router.get('/:id', async (req, res) => {
    try {
        const record = await ensureOwner(req.params.id, req.user.id);
        const updated = await prisma_1.prisma.case.update({
            where: { id: record.id },
            data: { lastAccessedAt: new Date() },
        });
        res.json({ case: (0, caseLifecycle_1.buildOwnerCaseResponse)(updated, req.user.id) });
    }
    catch (error) {
        res.status(error.status ?? 500).json({ error: error.message });
    }
});
router.patch('/:id', async (req, res) => {
    const parseResult = updateCaseSchema.safeParse(req.body);
    if (!parseResult.success) {
        res.status(400).json({ error: 'invalid_body' });
        return;
    }
    try {
        const existing = await ensureOwner(req.params.id, req.user.id);
        const nextTitle = parseResult.data.title ?? existing.title;
        const updated = await prisma_1.prisma.case.update({
            where: { id: existing.id },
            data: {
                title: nextTitle,
                topicSummary: existing.topicSummary || (0, caseLifecycle_1.generateCaseTopicSummary)(nextTitle, parseResult.data.data ?? existing.data),
                data: parseResult.data.data ?? existing.data,
            },
        });
        res.json({ case: (0, caseLifecycle_1.buildOwnerCaseResponse)(updated, req.user.id) });
    }
    catch (error) {
        res.status(error.status ?? 500).json({ error: error.message });
    }
});
router.patch('/:id/metadata', async (req, res) => {
    const parsed = metadataSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'invalid_body' });
        return;
    }
    try {
        const existing = await ensureOwner(req.params.id, req.user.id);
        const nextTitle = parsed.data.title ?? existing.title;
        const updated = await prisma_1.prisma.case.update({
            where: { id: existing.id },
            data: {
                title: nextTitle,
                topicSummary: parsed.data.topicSummary
                    ? parsed.data.topicSummary.trim()
                    : (0, caseLifecycle_1.generateCaseTopicSummary)(nextTitle, existing.data),
            },
        });
        res.json({ case: (0, caseLifecycle_1.buildOwnerCaseResponse)(updated, req.user.id) });
    }
    catch (error) {
        res.status(error.status ?? 500).json({ error: error.message });
    }
});
router.post('/:id/archive', async (req, res) => {
    try {
        const existing = await ensureOwner(req.params.id, req.user.id);
        const updated = await prisma_1.prisma.case.update({
            where: { id: existing.id },
            data: {
                status: client_1.CaseStatus.ARCHIVED,
                archivedAt: new Date(),
            },
        });
        res.json({ case: (0, caseLifecycle_1.buildOwnerCaseResponse)(updated, req.user.id) });
    }
    catch (error) {
        res.status(error.status ?? 500).json({ error: error.message });
    }
});
router.post('/:id/renew', async (req, res) => {
    try {
        const existing = await ensureOwner(req.params.id, req.user.id);
        const updated = await prisma_1.prisma.case.update({
            where: { id: existing.id },
            data: {
                status: client_1.CaseStatus.ACTIVE,
                archivedAt: null,
                retentionExpiresAt: (0, caseLifecycle_1.addDays)(new Date(), caseLifecycle_1.RETENTION_DAYS),
                retentionWarningSent: false,
                retentionFinalWarningSent: false,
            },
        });
        await (0, auditLogger_1.logAuditEvent)({
            action: 'CASE_RENEWED',
            userId: req.user.id,
            entityType: 'case',
            entityId: updated.id,
        });
        res.json({ case: (0, caseLifecycle_1.buildOwnerCaseResponse)(updated, req.user.id) });
    }
    catch (error) {
        res.status(error.status ?? 500).json({ error: error.message });
    }
});
router.post('/:id/export', async (req, res) => {
    const parsed = exportSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
        res.status(400).json({ error: 'invalid_body' });
        return;
    }
    try {
        const record = await ensureOwner(req.params.id, req.user.id);
        const result = await (0, caseExporter_1.exportCase)(record, parsed.data.format);
        await prisma_1.prisma.case.update({
            where: { id: record.id },
            data: { lastAccessedAt: new Date() },
        });
        res.setHeader('Content-Type', result.mime);
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.send(result.buffer);
    }
    catch (error) {
        res.status(error.status ?? 500).json({ error: error.message });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const existing = await ensureOwner(req.params.id, req.user.id);
        await (0, caseLifecycle_1.deleteCaseAndAssets)(existing);
        await (0, auditLogger_1.logAuditEvent)({
            action: 'CASE_DELETED',
            userId: req.user.id,
            entityType: 'case',
            entityId: existing.id,
        });
        res.status(204).end();
    }
    catch (error) {
        res.status(error.status ?? 500).json({ error: error.message });
    }
});
exports.casesRouter = router;
