import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { literatureRouter } from '../literature';

const knowledgeDocumentMock = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
}));

const literatureResourceMock = vi.hoisted(() => ({
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../../services/prisma', () => ({
  prisma: {
    knowledgeDocument: knowledgeDocumentMock,
    literatureResource: literatureResourceMock,
  },
}));

vi.mock('../../middleware/auth', () => ({
  requireAuth: (_req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (_req as express.Request).user = { id: 'user', username: 'tester', role: 'attorney' } as any;
    next();
  },
}));

const buildQueriesMock = vi.hoisted(() => vi.fn().mockReturnValue(['medical negligence']));
vi.mock('../../services/literature/queryBuilder', () => ({
  buildLiteratureQueries: buildQueriesMock,
}));

const searchSourcesMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue([
  {
    doi: '10.1000/test',
    title: 'Test Article',
    authors: ['Alice Smith'],
    journal: 'Journal',
    year: 2024,
    source: 'crossref' as const,
    url: 'https://example.com/article',
  },
  ]),
);

vi.mock('../../services/literature/searchService', () => ({
  searchLiteratureSources: searchSourcesMock,
}));

const linkClaimsMock = vi.hoisted(() => vi.fn().mockReturnValue(['c-1']));
vi.mock('../../services/literature/linker', () => ({
  linkClaimsToText: linkClaimsMock,
}));

const oaMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ oaStatus: 'open', oaPdfUrl: 'https://example.com/test.pdf', license: 'cc-by' }),
);
vi.mock('../../services/literature/oaService', () => ({
  checkOpenAccess: oaMock,
}));

const downloadPdfMock = vi.hoisted(() => vi.fn().mockResolvedValue('C:/downloads/test.pdf'));
vi.mock('../../services/literature/downloader', () => ({
  downloadPdf: downloadPdfMock,
}));

const app = express();
app.use(express.json());
app.use('/api/literature', literatureRouter);

describe('literature routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    knowledgeDocumentMock.findUnique.mockReset();
    knowledgeDocumentMock.update.mockReset();
    literatureResourceMock.findMany.mockReset();
    literatureResourceMock.create.mockReset();
    literatureResourceMock.update.mockReset();
    downloadPdfMock.mockReset();
    linkClaimsMock.mockReturnValue(['c-1']);
  });

  it('returns linkedClaimIds in search response', async () => {
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

    const response = await request(app)
      .post('/api/literature/search')
      .send({ knowledgeId: 'k2' });

    expect(response.status).toBe(200);
    expect(response.body.resources[0].linkedClaimIds).toEqual(['c-1']);
  });

  it('stores search results with OA info', async () => {
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

    const response = await request(app)
      .post('/api/literature/search')
      .send({ knowledgeId: 'k1' });

    expect(response.status).toBe(200);
    expect(literatureResourceMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ linkedClaimIds: ['c-1'] }),
      }),
    );
    expect(knowledgeDocumentMock.update).toHaveBeenCalledTimes(1);
  });

  it('downloads only OA resources', async () => {
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

    const response = await request(app)
      .post('/api/literature/download')
      .send({ knowledgeId: 'k1' });

    expect(response.status).toBe(200);
    expect(downloadPdfMock).toHaveBeenCalledTimes(1);
    expect(literatureResourceMock.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'closed' }, data: expect.objectContaining({ downloadStatus: 'no_oa' }) }),
    );
  });
});

