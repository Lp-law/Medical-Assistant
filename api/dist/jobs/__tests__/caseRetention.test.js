"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const caseRetention_1 = require("../caseRetention");
const caseMock = vitest_1.vi.hoisted(() => ({
    findMany: vitest_1.vi.fn(),
    updateMany: vitest_1.vi.fn(),
}));
const deleteCaseAndAssetsMock = vitest_1.vi.hoisted(() => vitest_1.vi.fn());
const createNotificationMock = vitest_1.vi.hoisted(() => vitest_1.vi.fn());
vitest_1.vi.mock('../../services/prisma', () => ({
    prisma: {
        case: caseMock,
    },
}));
vitest_1.vi.mock('../../services/caseLifecycle', async () => {
    const actual = await vitest_1.vi.importActual('../../services/caseLifecycle');
    return {
        ...actual,
        deleteCaseAndAssets: deleteCaseAndAssetsMock,
    };
});
vitest_1.vi.mock('../../services/notificationService', () => ({
    createNotification: createNotificationMock,
}));
const buildCase = (overrides = {}) => ({
    id: overrides.id ?? `case-${Math.random()}`,
    ownerId: overrides.ownerId ?? 'owner',
    title: overrides.title ?? 'תיק בדיקה',
    topicSummary: overrides.topicSummary ?? 'תיק כללי',
    data: {},
    status: overrides.status ?? 'ACTIVE',
    createdAt: overrides.createdAt ?? new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: overrides.updatedAt ?? new Date('2024-01-01T00:00:00.000Z'),
    lastAccessedAt: null,
    retentionExpiresAt: overrides.retentionExpiresAt ?? new Date('2024-04-01T00:00:00.000Z'),
    archivedAt: null,
    retentionWarningSent: false,
    retentionFinalWarningSent: false,
});
(0, vitest_1.describe)('case retention job', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        deleteCaseAndAssetsMock.mockReset();
        createNotificationMock.mockReset();
        caseMock.findMany.mockReset();
        caseMock.updateMany.mockReset();
    });
    (0, vitest_1.it)('sends warnings and deletes expired cases deterministically', async () => {
        const now = new Date('2024-03-01T00:00:00.000Z');
        const warningCase = buildCase({ id: 'warn', retentionExpiresAt: new Date('2024-03-10T00:00:00.000Z') });
        const finalCase = buildCase({ id: 'final', retentionExpiresAt: new Date('2024-03-03T00:00:00.000Z') });
        const expiredCase = buildCase({ id: 'expired', retentionExpiresAt: new Date('2024-02-27T00:00:00.000Z') });
        caseMock.findMany
            .mockResolvedValueOnce([warningCase])
            .mockResolvedValueOnce([finalCase])
            .mockResolvedValueOnce([expiredCase]);
        caseMock.updateMany.mockResolvedValue({ count: 1 });
        await (0, caseRetention_1.runCaseRetentionCycle)(now);
        (0, vitest_1.expect)(createNotificationMock).toHaveBeenCalledTimes(3);
        (0, vitest_1.expect)(deleteCaseAndAssetsMock).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(deleteCaseAndAssetsMock).toHaveBeenCalledWith(expiredCase, { logRetention: true });
    });
});
