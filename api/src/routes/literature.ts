import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../services/prisma';
import { buildLiteratureQueries } from '../services/literature/queryBuilder';
import { searchLiteratureSources } from '../services/literature/searchService';
import { checkOpenAccess } from '../services/literature/oaService';
import { downloadPdf } from '../services/literature/downloader';
import { summarizePdf } from '../services/literature/summarizer';
import { linkClaimsToText } from '../services/literature/linker';

const router = Router();
router.use(requireAuth);

const toAuthorsJson = (authors: string[]) => authors.map((name) => ({ name }));

router.post('/search', async (req, res) => {
  const knowledgeId = req.body?.knowledgeId;
  if (!knowledgeId) {
    res.status(400).json({ error: 'knowledge_id_required' });
    return;
  }
  const document = await prisma.knowledgeDocument.findUnique({ where: { id: knowledgeId } });
  if (!document) {
    res.status(404).json({ error: 'knowledge_not_found' });
    return;
  }

  const claims = Array.isArray(document.claims) ? (document.claims as Array<{ id?: string; type?: string; value?: string }>) : [];
  const queries = buildLiteratureQueries({
    claims: document.claims as any[],
    timeline: document.timeline as any[],
  });

  const candidates = await searchLiteratureSources(queries);
  const existing = await prisma.literatureResource.findMany({ where: { knowledgeId } });

  const upsertedResources = [];
  for (const candidate of candidates) {
    const linkedClaimIds = linkClaimsToText(claims, candidate.title);
    const match =
      existing.find((item) => (candidate.doi && item.doi === candidate.doi) || (candidate.pmid && item.pmid === candidate.pmid)) ??
      null;

    const oaInfo = await checkOpenAccess(candidate.doi);
    if (match) {
      const updated = await prisma.literatureResource.update({
        where: { id: match.id },
        data: {
          title: candidate.title,
          authors: toAuthorsJson(candidate.authors),
          journal: candidate.journal,
          year: candidate.year,
          source: candidate.source,
          doi: candidate.doi ?? match.doi,
          pmid: candidate.pmid ?? match.pmid,
          url: candidate.url ?? match.url,
          oaStatus: oaInfo?.oaStatus ?? match.oaStatus,
          oaUrl: oaInfo?.oaUrl ?? match.oaUrl,
          oaPdfUrl: oaInfo?.oaPdfUrl ?? match.oaPdfUrl,
          pmcId: oaInfo?.pmcId ?? match.pmcId,
          pmcUrl: oaInfo?.pmcUrl ?? match.pmcUrl,
          license: oaInfo?.license ?? match.license,
          oaCheckedAt: new Date(),
          linkedClaimIds,
        },
      });
      upsertedResources.push(updated);
    } else {
      const created = await prisma.literatureResource.create({
        data: {
          knowledgeId,
          title: candidate.title,
          authors: toAuthorsJson(candidate.authors),
          journal: candidate.journal,
          year: candidate.year,
          source: candidate.source,
          doi: candidate.doi,
          pmid: candidate.pmid,
          url: candidate.url,
          oaStatus: oaInfo?.oaStatus ?? 'unknown',
          oaUrl: oaInfo?.oaUrl,
          oaPdfUrl: oaInfo?.oaPdfUrl,
          pmcId: oaInfo?.pmcId,
          pmcUrl: oaInfo?.pmcUrl,
          license: oaInfo?.license,
          oaCheckedAt: oaInfo ? new Date() : null,
          linkedClaimIds,
        },
      });
      upsertedResources.push(created);
    }
  }

  await prisma.knowledgeDocument.update({
    where: { id: knowledgeId },
    data: { literatureQueries: queries },
  });

  res.json({ resources: upsertedResources });
});

router.post('/download', async (req, res) => {
  const { knowledgeId, ids } = req.body ?? {};
  if (!knowledgeId) {
    res.status(400).json({ error: 'knowledge_id_required' });
    return;
  }
  const resources = await prisma.literatureResource.findMany({
    where: {
      knowledgeId,
      ...(Array.isArray(ids) && ids.length ? { id: { in: ids } } : {}),
    },
  });
  const results = [];
  for (const resource of resources) {
    if (!resource.oaPdfUrl && !resource.oaUrl) {
      await prisma.literatureResource.update({
        where: { id: resource.id },
        data: { downloadStatus: 'no_oa' },
      });
      results.push({ id: resource.id, status: 'no_oa' });
      continue;
    }
    const url = resource.oaPdfUrl ?? resource.oaUrl!;
    try {
      const filePath = await downloadPdf(knowledgeId, resource.id, url);
      const updated = await prisma.literatureResource.update({
        where: { id: resource.id },
        data: {
          localPath: filePath,
          downloadedAt: new Date(),
          downloadStatus: 'downloaded',
        },
      });
      results.push({ id: resource.id, status: 'downloaded', localPath: updated.localPath });
    } catch (error) {
      console.error('[literature] download failed', resource.id, error);
      await prisma.literatureResource.update({
        where: { id: resource.id },
        data: { downloadStatus: 'error' },
      });
      results.push({ id: resource.id, status: 'error' });
    }
  }

  res.json({ downloads: results });
});

router.post('/summarize', async (req, res) => {
  const { knowledgeId, ids } = req.body ?? {};
  if (!knowledgeId) {
    res.status(400).json({ error: 'knowledge_id_required' });
    return;
  }

  const resources = await prisma.literatureResource.findMany({
    where: {
      knowledgeId,
      downloadStatus: 'downloaded',
      localPath: { not: null },
      ...(Array.isArray(ids) && ids.length ? { id: { in: ids } } : {}),
    },
  });

  const summaries = [];
  for (const resource of resources) {
    if (!resource.localPath) continue;
    try {
      const { content, quality, note } = await summarizePdf(resource.localPath);
      const updated = await prisma.literatureResource.update({
        where: { id: resource.id },
        data: {
          summaryJson: content as unknown as Prisma.InputJsonValue,
          summaryQuality: quality,
          summaryQualityNote: note,
        },
      });
      summaries.push({ id: resource.id, summary: updated.summaryJson, quality: quality, note });
    } catch (error) {
      console.error('[literature] summarize failed', resource.id, error);
    }
  }
  res.json({ summaries });
});

router.get('/list', async (req, res) => {
  const knowledgeId = req.query.knowledgeId;
  if (typeof knowledgeId !== 'string') {
    res.status(400).json({ error: 'knowledge_id_required' });
    return;
  }
  const resources = await prisma.literatureResource.findMany({
    where: { knowledgeId },
    orderBy: { fetchedAt: 'desc' },
  });
  res.json({ resources });
});

export const literatureRouter = router;

