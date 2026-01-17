"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const supertest_1 = __importDefault(require("supertest"));
const vitest_1 = require("vitest");
const literature_1 = require("../literature");
const knowledgeDocumentMock = vitest_1.vi.hoisted(() => ({
    findUnique: vitest_1.vi.fn(),
    update: vitest_1.vi.fn(),
}));
const literatureResourceMock = vitest_1.vi.hoisted(() => ({
    findMany: vitest_1.vi.fn(),
    create: vitest_1.vi.fn(),
    update: vitest_1.vi.fn(),
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
const buildQueriesMock = vitest_1.vi.hoisted(() => vitest_1.vi.fn().mockReturnValue(['medical negligence']));
vitest_1.vi.mock('../../services/literature/queryBuilder', () => ({
    buildLiteratureQueries: buildQueriesMock,
}));
const searchSourcesMock = vitest_1.vi.hoisted(() => vitest_1.vi.fn().mockResolvedValue([
    {
        doi: '10.1000/test',
        title: 'Test Article',
        authors: ['Alice Smith'],
        journal: 'Journal',
        year: 2024,
        source: 'crossref',
        url: 'https://example.com/article',
    },
]));
vitest_1.vi.mock('../../services/literature/searchService', () => ({
    searchLiteratureSources: searchSourcesMock,
}));
const linkClaimsMock = vitest_1.vi.hoisted(() => vitest_1.vi.fn().mockReturnValue(['c-1']));
vitest_1.vi.mock('../../services/literature/linker', () => ({
    linkClaimsToText: linkClaimsMock,
}));
const oaMock = vitest_1.vi.hoisted(() => vitest_1.vi.fn().mockResolvedValue({ oaStatus: 'open', oaPdfUrl: 'https://example.com/test.pdf', license: 'cc-by' }));
vitest_1.vi.mock('../../services/literature/oaService', () => ({
    checkOpenAccess: oaMock,
}));
const downloadPdfMock = vitest_1.vi.hoisted(() => vitest_1.vi.fn().mockResolvedValue('C:/downloads/test.pdf'));
vitest_1.vi.mock('../../services/literature/downloader', () => ({
    downloadPdf: downloadPdfMock,
}));
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use('/api/literature', literature_1.literatureRouter);
(0, vitest_1.describe)('literature routes', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        knowledgeDocumentMock.findUnique.mockReset();
        knowledgeDocumentMock.update.mockReset();
        literatureResourceMock.findMany.mockReset();
        literatureResourceMock.create.mockReset();
        literatureResourceMock.update.mockReset();
        downloadPdfMock.mockReset();
        linkClaimsMock.mockReturnValue(['c-1']);
    });
    (0, vitest_1.it)('returns linkedClaimIds in search response', async () => {
        knowledgeDocumentMock.findUnique.mockResolvedValue({
            id: 'k2',
            claims: [{ id: 'c-1', type: 'Diagnosis', value: 'septic arthritis' }],
            timeline: [],
        });
        literatureResourceMock.findMany.mockResolvedValue([]);
        literatureResourceMock.create.mockResolvedValue({
            id: 'lr2',
            linkedClaimIds: ['c-1'],
            knowledgeId: 'k2',
        });
        const response = await (0, supertest_1.default)(app)
            .post('/api/literature/search')
            .send({ knowledgeId: 'k2' });
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body.resources[0].linkedClaimIds).toEqual(['c-1']);
    });
    (0, vitest_1.it)('stores search results with OA info', async () => {
        knowledgeDocumentMock.findUnique.mockResolvedValue({
            id: 'k1',
            claims: [{ id: 'c-1', type: 'Surgery', value: 'knee replacement' }],
            timeline: [],
        });
        literatureResourceMock.findMany.mockResolvedValue([]);
        literatureResourceMock.create.mockResolvedValue({
            id: 'lr1',
            knowledgeId: 'k1',
            title: 'Test Article',
            authors: [{ name: 'Alice Smith' }],
            oaStatus: 'open',
        });
        const response = await (0, supertest_1.default)(app)
            .post('/api/literature/search')
            .send({ knowledgeId: 'k1' });
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(literatureResourceMock.create).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
            data: vitest_1.expect.objectContaining({ linkedClaimIds: ['c-1'] }),
        }));
        (0, vitest_1.expect)(knowledgeDocumentMock.update).toHaveBeenCalledTimes(1);
    });
    (0, vitest_1.it)('downloads only OA resources', async () => {
        literatureResourceMock.findMany.mockResolvedValue([
            {
                id: 'open',
                knowledgeId: 'k1',
                oaPdfUrl: 'https://example.com/test.pdf',
                oaUrl: null,
                downloadStatus: 'pending',
            },
            {
                id: 'closed',
                knowledgeId: 'k1',
                oaPdfUrl: null,
                oaUrl: null,
                downloadStatus: 'pending',
            },
        ]);
        literatureResourceMock.update.mockResolvedValue({ id: 'open', localPath: 'C:/downloads/test.pdf' });
        const response = await (0, supertest_1.default)(app)
            .post('/api/literature/download')
            .send({ knowledgeId: 'k1' });
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(downloadPdfMock).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(literatureResourceMock.update).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ where: { id: 'closed' }, data: vitest_1.expect.objectContaining({ downloadStatus: 'no_oa' }) }));
    });
});
