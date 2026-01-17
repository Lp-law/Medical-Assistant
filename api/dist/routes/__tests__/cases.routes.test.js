"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const supertest_1 = __importDefault(require("supertest"));
const vitest_1 = require("vitest");
const cases_1 = require("../cases");
const caseMock = vitest_1.vi.hoisted(() => ({
    findMany: vitest_1.vi.fn(),
    create: vitest_1.vi.fn(),
    update: vitest_1.vi.fn(),
    findFirst: vitest_1.vi.fn(),
}));
const knowledgeDocumentMock = vitest_1.vi.hoisted(() => ({
    findMany: vitest_1.vi.fn(),
    deleteMany: vitest_1.vi.fn(),
}));
const literatureMock = vitest_1.vi.hoisted(() => ({
    deleteMany: vitest_1.vi.fn(),
}));
const notificationMock = vitest_1.vi.hoisted(() => ({
    deleteMany: vitest_1.vi.fn(),
}));
const deleteCaseAndAssetsMock = vitest_1.vi.hoisted(() => vitest_1.vi.fn());
vitest_1.vi.mock('../../services/prisma', () => ({
    prisma: {
        case: caseMock,
        knowledgeDocument: knowledgeDocumentMock,
        literatureResource: literatureMock,
        notification: notificationMock,
    },
}));
vitest_1.vi.mock('../../services/auditLogger', () => ({
    logAuditEvent: vitest_1.vi.fn(),
}));
vitest_1.vi.mock('../../services/caseLifecycle', async () => {
    const actual = await vitest_1.vi.importActual('../../services/caseLifecycle');
    return {
        ...actual,
        deleteCaseAndAssets: deleteCaseAndAssetsMock,
    };
});
vitest_1.vi.mock('../../middleware/auth', () => ({
    requireAuth: (_req, _res, next) => {
        _req.user = { id: 'owner', username: 'owner', role: 'attorney' };
        next();
    },
}));
const buildApp = () => {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.use('/api/cases', cases_1.casesRouter);
    return app;
};
const buildCase = (overrides = {}, ownerId = 'owner') => ({
    id: overrides.id ?? 'case-1',
    ownerId,
    title: overrides.title ?? 'תיק בדיקה',
    topicSummary: overrides.topicSummary ?? 'תיק רפואי משפטי',
    data: overrides.data ?? {},
    status: overrides.status ?? 'ACTIVE',
    createdAt: overrides.createdAt ?? new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: overrides.updatedAt ?? new Date('2024-01-02T00:00:00.000Z'),
    lastAccessedAt: overrides.lastAccessedAt ?? null,
    retentionExpiresAt: overrides.retentionExpiresAt ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    archivedAt: overrides.archivedAt ?? null,
    retentionWarningSent: false,
    retentionFinalWarningSent: false,
});
(0, vitest_1.describe)('cases router', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        deleteCaseAndAssetsMock.mockReset();
    });
    (0, vitest_1.it)('returns own and public cases with safe payloads', async () => {
        caseMock.findMany.mockResolvedValue([
            buildCase({ id: 'mine' }, 'owner'),
            buildCase({ id: 'other', title: 'Case Other' }, 'other-user'),
        ]);
        const response = await (0, supertest_1.default)(buildApp()).get('/api/cases').set('Authorization', 'Bearer token');
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body.ownCases).toHaveLength(1);
        (0, vitest_1.expect)(response.body.ownCases[0].id).toBe('mine');
        (0, vitest_1.expect)(response.body.ownCases[0]).toHaveProperty('data');
        (0, vitest_1.expect)(response.body.otherCases).toHaveLength(1);
        (0, vitest_1.expect)(response.body.otherCases[0].id).toBe('other');
        (0, vitest_1.expect)(response.body.otherCases[0].data).toBeUndefined();
    });
    (0, vitest_1.it)('prevents deleting a case that is not owned by the requester', async () => {
        caseMock.findFirst.mockResolvedValue(null);
        const response = await (0, supertest_1.default)(buildApp()).delete('/api/cases/not-mine').set('Authorization', 'Bearer token');
        (0, vitest_1.expect)(response.status).toBe(404);
        (0, vitest_1.expect)(deleteCaseAndAssetsMock).not.toHaveBeenCalled();
    });
});
