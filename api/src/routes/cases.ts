import { Router } from 'express';
import { CaseStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../services/prisma';
import { logAuditEvent } from '../services/auditLogger';
import {
  RETENTION_DAYS,
  addDays,
  buildOwnerCaseResponse,
  buildPublicCaseResponse,
  deleteCaseAndAssets,
  generateCaseTopicSummary,
} from '../services/caseLifecycle';
import { exportCase } from '../services/caseExporter';

const router = Router();

const createCaseSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  data: z.record(z.any()).optional(),
});

const updateCaseSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  data: z.record(z.any()).optional(),
});

const metadataSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  topicSummary: z.string().max(160).optional(),
});

const exportSchema = z.object({
  format: z.enum(['pdf', 'json']).default('pdf'),
});

router.use(requireAuth);

const ensureOwner = async (caseId: string, userId: string) => {
  const record = await prisma.case.findFirst({ where: { id: caseId, ownerId: userId } });
  if (!record) {
    const error = new Error('case_not_found');
    (error as any).status = 404;
    throw error;
  }
  return record;
};

router.get('/', async (req, res) => {
  const allCases = await prisma.case.findMany({
    orderBy: { updatedAt: 'desc' },
  });
  const ownCases = allCases.filter((record) => record.ownerId === req.user!.id).map((record) => buildOwnerCaseResponse(record, req.user!.id));
  const otherCases = allCases
    .filter((record) => record.ownerId !== req.user!.id)
    .map((record) => buildPublicCaseResponse(record, req.user!.id));
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
  const created = await prisma.case.create({
    data: {
      ownerId: req.user!.id,
      title: payload.title ?? 'תיק חדש',
      topicSummary: generateCaseTopicSummary(payload.title ?? '', payload.data),
      data: (payload.data as Prisma.InputJsonValue | undefined) ?? {},
      lastAccessedAt: now,
      retentionExpiresAt: addDays(now, RETENTION_DAYS),
      status: CaseStatus.ACTIVE,
    },
  });
  await logAuditEvent({
    action: 'CASE_CREATED',
    userId: req.user!.id,
    entityType: 'case',
    entityId: created.id,
    metadata: { title: created.title },
  });
  res.status(201).json({ case: buildOwnerCaseResponse(created, req.user!.id) });
});

router.get('/:id', async (req, res) => {
  try {
    const record = await ensureOwner(req.params.id, req.user!.id);
    const updated = await prisma.case.update({
      where: { id: record.id },
      data: { lastAccessedAt: new Date() },
    });
    res.json({ case: buildOwnerCaseResponse(updated, req.user!.id) });
  } catch (error) {
    res.status((error as any).status ?? 500).json({ error: (error as Error).message });
  }
});

router.patch('/:id', async (req, res) => {
  const parseResult = updateCaseSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'invalid_body' });
    return;
  }
  try {
    const existing = await ensureOwner(req.params.id, req.user!.id);
    const nextTitle = parseResult.data.title ?? existing.title;
    const updated = await prisma.case.update({
      where: { id: existing.id },
      data: {
        title: nextTitle,
        topicSummary: existing.topicSummary || generateCaseTopicSummary(nextTitle, parseResult.data.data ?? existing.data),
        data: (parseResult.data.data as Prisma.InputJsonValue | undefined) ?? (existing.data as Prisma.InputJsonValue),
      },
    });
    res.json({ case: buildOwnerCaseResponse(updated, req.user!.id) });
  } catch (error) {
    res.status((error as any).status ?? 500).json({ error: (error as Error).message });
  }
});

router.patch('/:id/metadata', async (req, res) => {
  const parsed = metadataSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body' });
    return;
  }
  try {
    const existing = await ensureOwner(req.params.id, req.user!.id);
    const nextTitle = parsed.data.title ?? existing.title;
    const updated = await prisma.case.update({
      where: { id: existing.id },
      data: {
        title: nextTitle,
        topicSummary: parsed.data.topicSummary
          ? parsed.data.topicSummary.trim()
          : generateCaseTopicSummary(nextTitle, existing.data),
      },
    });
    res.json({ case: buildOwnerCaseResponse(updated, req.user!.id) });
  } catch (error) {
    res.status((error as any).status ?? 500).json({ error: (error as Error).message });
  }
});

router.post('/:id/archive', async (req, res) => {
  try {
    const existing = await ensureOwner(req.params.id, req.user!.id);
    const updated = await prisma.case.update({
      where: { id: existing.id },
      data: {
        status: CaseStatus.ARCHIVED,
        archivedAt: new Date(),
      },
    });
    res.json({ case: buildOwnerCaseResponse(updated, req.user!.id) });
  } catch (error) {
    res.status((error as any).status ?? 500).json({ error: (error as Error).message });
  }
});

router.post('/:id/renew', async (req, res) => {
  try {
    const existing = await ensureOwner(req.params.id, req.user!.id);
    const updated = await prisma.case.update({
      where: { id: existing.id },
      data: {
        status: CaseStatus.ACTIVE,
        archivedAt: null,
        retentionExpiresAt: addDays(new Date(), RETENTION_DAYS),
        retentionWarningSent: false,
        retentionFinalWarningSent: false,
      },
    });
    await logAuditEvent({
      action: 'CASE_RENEWED',
      userId: req.user!.id,
      entityType: 'case',
      entityId: updated.id,
    });
    res.json({ case: buildOwnerCaseResponse(updated, req.user!.id) });
  } catch (error) {
    res.status((error as any).status ?? 500).json({ error: (error as Error).message });
  }
});

router.post('/:id/export', async (req, res) => {
  const parsed = exportSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body' });
    return;
  }
  try {
    const record = await ensureOwner(req.params.id, req.user!.id);
    const result = await exportCase(record, parsed.data.format);
    await prisma.case.update({
      where: { id: record.id },
      data: { lastAccessedAt: new Date() },
    });
    res.setHeader('Content-Type', result.mime);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.buffer);
  } catch (error) {
    res.status((error as any).status ?? 500).json({ error: (error as Error).message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await ensureOwner(req.params.id, req.user!.id);
    await deleteCaseAndAssets(existing);
    await logAuditEvent({
      action: 'CASE_DELETED',
      userId: req.user!.id,
      entityType: 'case',
      entityId: existing.id,
    });
    res.status(204).end();
  } catch (error) {
    res.status((error as any).status ?? 500).json({ error: (error as Error).message });
  }
});

export const casesRouter = router;

