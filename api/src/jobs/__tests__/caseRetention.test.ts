import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runCaseRetentionCycle } from '../caseRetention';

const caseMock = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
}));

const deleteCaseAndAssetsMock = vi.hoisted(() => vi.fn());
const createNotificationMock = vi.hoisted(() => vi.fn());

vi.mock('../../services/prisma', () => ({
  prisma: {
    case: caseMock,
  },
}));

vi.mock('../../services/caseLifecycle', async () => {
  const actual = await vi.importActual<typeof import('../../services/caseLifecycle')>('../../services/caseLifecycle');
  return {
    ...actual,
    deleteCaseAndAssets: deleteCaseAndAssetsMock,
  };
});

vi.mock('../../services/notificationService', () => ({
  createNotification: createNotificationMock,
}));

const buildCase = (overrides: Partial<any> = {}) => ({
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

describe('case retention job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteCaseAndAssetsMock.mockReset();
    createNotificationMock.mockReset();
    caseMock.findMany.mockReset();
    caseMock.updateMany.mockReset();
  });

  it('sends warnings and deletes expired cases deterministically', async () => {
    const now = new Date('2024-03-01T00:00:00.000Z');
    const warningCase = buildCase({ id: 'warn', retentionExpiresAt: new Date('2024-03-10T00:00:00.000Z') });
    const finalCase = buildCase({ id: 'final', retentionExpiresAt: new Date('2024-03-03T00:00:00.000Z') });
    const expiredCase = buildCase({ id: 'expired', retentionExpiresAt: new Date('2024-02-27T00:00:00.000Z') });

    caseMock.findMany
      .mockResolvedValueOnce([warningCase])
      .mockResolvedValueOnce([finalCase])
      .mockResolvedValueOnce([expiredCase]);

    caseMock.updateMany.mockResolvedValue({ count: 1 });

    await runCaseRetentionCycle(now);

    expect(createNotificationMock).toHaveBeenCalledTimes(3);
    expect(deleteCaseAndAssetsMock).toHaveBeenCalledTimes(1);
    expect(deleteCaseAndAssetsMock).toHaveBeenCalledWith(expiredCase, { logRetention: true });
  });
});

