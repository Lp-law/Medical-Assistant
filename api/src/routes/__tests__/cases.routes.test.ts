import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { casesRouter } from '../cases';

const caseMock = vi.hoisted(() => ({
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  findFirst: vi.fn(),
}));

const knowledgeDocumentMock = vi.hoisted(() => ({
  findMany: vi.fn(),
  deleteMany: vi.fn(),
}));

const literatureMock = vi.hoisted(() => ({
  deleteMany: vi.fn(),
}));

const notificationMock = vi.hoisted(() => ({
  deleteMany: vi.fn(),
}));

const deleteCaseAndAssetsMock = vi.hoisted(() => vi.fn());

vi.mock('../../services/prisma', () => ({
  prisma: {
    case: caseMock,
    knowledgeDocument: knowledgeDocumentMock,
    literatureResource: literatureMock,
    notification: notificationMock,
  },
}));

vi.mock('../../services/auditLogger', () => ({
  logAuditEvent: vi.fn(),
}));

vi.mock('../../services/caseLifecycle', async () => {
  const actual = await vi.importActual<typeof import('../../services/caseLifecycle')>('../../services/caseLifecycle');
  return {
    ...actual,
    deleteCaseAndAssets: deleteCaseAndAssetsMock,
  };
});

vi.mock('../../middleware/auth', () => ({
  requireAuth: (_req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (_req as express.Request).user = { id: 'owner', username: 'owner', role: 'attorney' } as any;
    next();
  },
}));

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/cases', casesRouter);
  return app;
};

const buildCase = (overrides: Partial<any> = {}, ownerId = 'owner') => ({
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

describe('cases router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteCaseAndAssetsMock.mockReset();
  });

  it('returns own and public cases with safe payloads', async () => {
    caseMock.findMany.mockResolvedValue([
      buildCase({ id: 'mine' }, 'owner'),
      buildCase({ id: 'other', title: 'Case Other' }, 'other-user'),
    ]);

    const response = await request(buildApp()).get('/api/cases').set('Authorization', 'Bearer token');

    expect(response.status).toBe(200);
    expect(response.body.ownCases).toHaveLength(1);
    expect(response.body.ownCases[0].id).toBe('mine');
    expect(response.body.ownCases[0]).toHaveProperty('data');
    expect(response.body.otherCases).toHaveLength(1);
    expect(response.body.otherCases[0].id).toBe('other');
    expect(response.body.otherCases[0].data).toBeUndefined();
  });

  it('prevents deleting a case that is not owned by the requester', async () => {
    caseMock.findFirst.mockResolvedValue(null);

    const response = await request(buildApp()).delete('/api/cases/not-mine').set('Authorization', 'Bearer token');

    expect(response.status).toBe(404);
    expect(deleteCaseAndAssetsMock).not.toHaveBeenCalled();
  });
});

