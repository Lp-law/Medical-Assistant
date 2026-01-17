"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const supertest_1 = __importDefault(require("supertest"));
const vitest_1 = require("vitest");
const knowledge_1 = require("../knowledge");
const knowledgeDocumentMock = vitest_1.vi.hoisted(() => ({
    findUnique: vitest_1.vi.fn(),
    findMany: vitest_1.vi.fn(),
    update: vitest_1.vi.fn(),
}));
const literatureResourceMock = vitest_1.vi.hoisted(() => ({
    findMany: vitest_1.vi.fn(),
}));
vitest_1.vi.mock('../../services/prisma', () => ({
    prisma: {
        knowledgeDocument: knowledgeDocumentMock,
        literatureResource: literatureResourceMock,
    },
}));
vitest_1.vi.mock('../../middleware/auth', () => ({
    requireAuth: (_req, _res, next) => {
        _req.user = { id: 'user', username: 'tester', role: 'attorney' };
        next();
    },
}));
const buildApp = () => {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.use('/api/knowledge', knowledge_1.knowledgeRouter);
    return app;
};
(0, vitest_1.describe)('knowledge router timeline', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        knowledgeDocumentMock.findUnique.mockReset();
        knowledgeDocumentMock.findMany.mockReset();
        knowledgeDocumentMock.update.mockReset();
        literatureResourceMock.findMany.mockReset();
        literatureResourceMock.findMany.mockResolvedValue([]);
    });
    (0, vitest_1.it)('returns timeline events and persists them', async () => {
        knowledgeDocumentMock.findUnique.mockResolvedValue({
            id: 'doc-1',
            sourceFile: 'file.pdf',
            docType: 'opinion',
            title: 'Doc',
            summary: 'Summary',
            sections: [],
            claims: [
                { id: 'a', type: 'Surgery', value: 'ניתוח', date: '2020-01-01' },
                { id: 'b', type: 'בדיקה', value: 'בדיקה', date: '2020-07-10' },
            ],
            flags: [],
            score: { value: 0.9, breakdown: {} },
            timeline: [],
            qualityFindings: [],
            medicalQualityScore: 0,
            ocrLexicalMap: [],
            insights: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        const response = await (0, supertest_1.default)(buildApp())
            .get('/api/knowledge/doc-1')
            .set('Authorization', 'Bearer token');
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body.document.ocrModeUsed).toBe('base');
        (0, vitest_1.expect)(response.body.document.timeline).toHaveLength(2);
        (0, vitest_1.expect)(response.body.document).toHaveProperty('qualityFindings');
        (0, vitest_1.expect)(typeof response.body.document.medicalQualityScore).toBe('number');
        (0, vitest_1.expect)(knowledgeDocumentMock.update).toHaveBeenCalledTimes(1);
    });
    (0, vitest_1.it)('handles hidden events and flags when claims are mixed', async () => {
        knowledgeDocumentMock.findUnique.mockResolvedValue({
            id: 'doc-2',
            sourceFile: 'file.pdf',
            docType: 'opinion',
            title: 'Doc 2',
            summary: 'Summary',
            sections: [],
            claims: [
                { id: 'generic', type: 'Note', value: 'אירוע', source: { snippet: 'אירוע כללי' } },
                { id: 'dated', type: 'Exam', value: 'בדיקה 2024-01-10', date: '2024-01-10' },
            ],
            flags: [],
            score: { value: 0.9, breakdown: {} },
            timeline: [],
            qualityFindings: [],
            medicalQualityScore: 0,
            ocrLexicalMap: [],
            insights: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        const response = await (0, supertest_1.default)(buildApp())
            .get('/api/knowledge/doc-2')
            .set('Authorization', 'Bearer token');
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body.document.ocrModeUsed).toBe('base');
        (0, vitest_1.expect)(response.body.document.timeline.some((event) => event.hidden)).toBe(true);
        (0, vitest_1.expect)(response.body.document.flags.some((flag) => flag.code === 'EVENT_WITHOUT_DATE')).toBe(true);
        (0, vitest_1.expect)(response.body.document.flags.some((flag) => flag.code === 'TIMELINE_TOO_GENERIC')).toBe(true);
        (0, vitest_1.expect)(response.body.document.qualityFindings.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(knowledgeDocumentMock.update).toHaveBeenCalledTimes(1);
    });
    (0, vitest_1.it)('applies OCR hardening and weak evidence flags when score is low', async () => {
        knowledgeDocumentMock.findUnique.mockResolvedValue({
            id: 'doc-ocr',
            sourceFile: 'file.pdf',
            docType: 'opinion',
            title: 'Doc OCR',
            summary: 'Summary',
            sections: [],
            claims: [{ id: 'weak', type: 'Opinion', value: 'קביעה ללא נתון' }],
            flags: [],
            score: { value: 0.6, breakdown: { ocr: { value: 0.4, reasons: ['noise'] } } },
            timeline: [],
            qualityFindings: [],
            medicalQualityScore: 0,
            ocrLexicalMap: [{ text: 'טקסט קטוע' }],
            insights: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        const response = await (0, supertest_1.default)(buildApp())
            .get('/api/knowledge/doc-ocr')
            .set('Authorization', 'Bearer token');
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body.document.ocrModeUsed).toBe('base');
        (0, vitest_1.expect)(response.body.document.claims[0].evidenceQuality).toBe('low');
        (0, vitest_1.expect)(response.body.document.flags.some((flag) => flag.code === 'OCR_LOW_CONFIDENCE_SECTION')).toBe(true);
        (0, vitest_1.expect)(response.body.document.flags.some((flag) => flag.code === 'CLAIM_WEAK_EVIDENCE')).toBe(true);
        (0, vitest_1.expect)(knowledgeDocumentMock.update).toHaveBeenCalled();
    });
    (0, vitest_1.it)('returns specialty reasoning findings', async () => {
        knowledgeDocumentMock.findUnique.mockResolvedValue({
            id: 'doc-cardio',
            sourceFile: 'file.pdf',
            docType: 'opinion',
            title: 'Doc Cardio',
            summary: 'Summary',
            sections: [],
            claims: [{ id: 'cardio-1', type: 'Complaint', value: 'Chest pain persistent', date: '2024-03-01' }],
            flags: [],
            score: { value: 0.8, breakdown: {} },
            timeline: [],
            qualityFindings: [],
            medicalQualityScore: 0,
            reasoningFindings: [],
            ocrLexicalMap: [],
            insights: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        const response = await (0, supertest_1.default)(buildApp())
            .get('/api/knowledge/doc-cardio')
            .set('Authorization', 'Bearer token');
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body.document.reasoningFindings.some((finding) => finding.code === 'MISSING_KEY_TEST_CARDIO')).toBe(true);
        (0, vitest_1.expect)(response.body.document.ocrModeUsed).toBe('base');
    });
    (0, vitest_1.it)('returns new obgyn specialty findings when relevant', async () => {
        knowledgeDocumentMock.findUnique.mockResolvedValue({
            id: 'doc-obgyn',
            sourceFile: 'file.pdf',
            docType: 'opinion',
            title: 'OB doc',
            summary: 'Summary',
            sections: [],
            claims: [{ id: 'ob1', type: 'Complaint', value: 'pregnancy bleeding third trimester' }],
            flags: [],
            score: { value: 0.8, breakdown: {} },
            timeline: [],
            qualityFindings: [],
            medicalQualityScore: 0,
            reasoningFindings: [],
            ocrLexicalMap: [],
            insights: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        const response = await (0, supertest_1.default)(buildApp())
            .get('/api/knowledge/doc-obgyn')
            .set('Authorization', 'Bearer token');
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body.document.reasoningFindings.some((finding) => finding.code === 'OBGYN_PREG_BLEED_NO_US' && finding.domain === 'OBGYN')).toBe(true);
    });
    (0, vitest_1.it)('returns empty timeline without updating when no claims exist', async () => {
        knowledgeDocumentMock.findUnique.mockResolvedValue({
            id: 'doc-empty',
            sourceFile: 'file.pdf',
            docType: 'opinion',
            title: 'Doc Empty',
            summary: 'Summary',
            sections: [],
            claims: [],
            flags: [],
            score: { value: 0.9, breakdown: {} },
            timeline: [],
            qualityFindings: [],
            medicalQualityScore: 0,
            ocrLexicalMap: [],
            insights: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        const response = await (0, supertest_1.default)(buildApp())
            .get('/api/knowledge/doc-empty')
            .set('Authorization', 'Bearer token');
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body.document.timeline).toEqual([]);
        (0, vitest_1.expect)(response.body.document.qualityFindings.some((finding) => finding.code === 'OPINION_NO_CLAIMS')).toBe(true);
        (0, vitest_1.expect)(response.body.document.medicalQualityScore).toBeGreaterThanOrEqual(0);
        (0, vitest_1.expect)(knowledgeDocumentMock.update).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
            data: vitest_1.expect.objectContaining({
                qualityFindings: vitest_1.expect.any(Array),
                medicalQualityScore: vitest_1.expect.any(Number),
            }),
        }));
        (0, vitest_1.expect)(response.body.document.ocrModeUsed).toBe('base');
    });
});
