import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { knowledgeRouter } from '../knowledge';

const knowledgeDocumentMock = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
}));

const literatureResourceMock = vi.hoisted(() => ({
  findMany: vi.fn(),
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

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/knowledge', knowledgeRouter);
  return app;
};

describe('knowledge router timeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    knowledgeDocumentMock.findUnique.mockReset();
    knowledgeDocumentMock.findMany.mockReset();
    knowledgeDocumentMock.update.mockReset();
    literatureResourceMock.findMany.mockReset();
    literatureResourceMock.findMany.mockResolvedValue([]);
  });

  it('returns timeline events and persists them', async () => {
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

    const response = await request(buildApp())
      .get('/api/knowledge/doc-1')
      .set('Authorization', 'Bearer token');

    expect(response.status).toBe(200);
    expect(response.body.document.ocrModeUsed).toBe('base');
    expect(response.body.document.timeline).toHaveLength(2);
    expect(response.body.document).toHaveProperty('qualityFindings');
    expect(typeof response.body.document.medicalQualityScore).toBe('number');
    expect(knowledgeDocumentMock.update).toHaveBeenCalledTimes(1);
  });

  it('handles hidden events and flags when claims are mixed', async () => {
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

    const response = await request(buildApp())
      .get('/api/knowledge/doc-2')
      .set('Authorization', 'Bearer token');

    expect(response.status).toBe(200);
    expect(response.body.document.ocrModeUsed).toBe('base');
    expect(response.body.document.timeline.some((event: any) => event.hidden)).toBe(true);
    expect(response.body.document.flags.some((flag: any) => flag.code === 'EVENT_WITHOUT_DATE')).toBe(true);
    expect(response.body.document.flags.some((flag: any) => flag.code === 'TIMELINE_TOO_GENERIC')).toBe(true);
    expect(response.body.document.qualityFindings.length).toBeGreaterThan(0);
    expect(knowledgeDocumentMock.update).toHaveBeenCalledTimes(1);
  });

  it('applies OCR hardening and weak evidence flags when score is low', async () => {
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

    const response = await request(buildApp())
      .get('/api/knowledge/doc-ocr')
      .set('Authorization', 'Bearer token');

    expect(response.status).toBe(200);
    expect(response.body.document.ocrModeUsed).toBe('base');
    expect(response.body.document.claims[0].evidenceQuality).toBe('low');
    expect(response.body.document.flags.some((flag: any) => flag.code === 'OCR_LOW_CONFIDENCE_SECTION')).toBe(true);
    expect(response.body.document.flags.some((flag: any) => flag.code === 'CLAIM_WEAK_EVIDENCE')).toBe(true);
    expect(knowledgeDocumentMock.update).toHaveBeenCalled();
  });

  it('returns specialty reasoning findings', async () => {
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

    const response = await request(buildApp())
      .get('/api/knowledge/doc-cardio')
      .set('Authorization', 'Bearer token');

    expect(response.status).toBe(200);
    expect(
      response.body.document.reasoningFindings.some((finding: any) => finding.code === 'MISSING_KEY_TEST_CARDIO'),
    ).toBe(true);
    expect(response.body.document.ocrModeUsed).toBe('base');
  });

  it('returns new obgyn specialty findings when relevant', async () => {
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

    const response = await request(buildApp())
      .get('/api/knowledge/doc-obgyn')
      .set('Authorization', 'Bearer token');

    expect(response.status).toBe(200);
    expect(
      response.body.document.reasoningFindings.some(
        (finding: any) => finding.code === 'OBGYN_PREG_BLEED_NO_US' && finding.domain === 'OBGYN',
      ),
    ).toBe(true);
  });

  it('returns empty timeline without updating when no claims exist', async () => {
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

    const response = await request(buildApp())
      .get('/api/knowledge/doc-empty')
      .set('Authorization', 'Bearer token');

    expect(response.status).toBe(200);
    expect(response.body.document.timeline).toEqual([]);
    expect(response.body.document.qualityFindings.some((finding: any) => finding.code === 'OPINION_NO_CLAIMS')).toBe(true);
    expect(response.body.document.medicalQualityScore).toBeGreaterThanOrEqual(0);
    expect(knowledgeDocumentMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          qualityFindings: expect.any(Array),
          medicalQualityScore: expect.any(Number),
        }),
      }),
    );
    expect(response.body.document.ocrModeUsed).toBe('base');
  });
});

