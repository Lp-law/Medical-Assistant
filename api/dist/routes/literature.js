"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.literatureRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const prisma_1 = require("../services/prisma");
const queryBuilder_1 = require("../services/literature/queryBuilder");
const searchService_1 = require("../services/literature/searchService");
const oaService_1 = require("../services/literature/oaService");
const downloader_1 = require("../services/literature/downloader");
const summarizer_1 = require("../services/literature/summarizer");
const linker_1 = require("../services/literature/linker");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
const toAuthorsJson = (authors) => authors.map((name) => ({ name }));
router.post('/search', async (req, res) => {
    const knowledgeId = req.body?.knowledgeId;
    if (!knowledgeId) {
        res.status(400).json({ error: 'knowledge_id_required' });
        return;
    }
    const document = await prisma_1.prisma.knowledgeDocument.findUnique({ where: { id: knowledgeId } });
    if (!document) {
        res.status(404).json({ error: 'knowledge_not_found' });
        return;
    }
    const claims = Array.isArray(document.claims) ? document.claims : [];
    const queries = (0, queryBuilder_1.buildLiteratureQueries)({
        claims: document.claims,
        timeline: document.timeline,
    });
    const candidates = await (0, searchService_1.searchLiteratureSources)(queries);
    const existing = await prisma_1.prisma.literatureResource.findMany({ where: { knowledgeId } });
    const upsertedResources = [];
    for (const candidate of candidates) {
        const linkedClaimIds = (0, linker_1.linkClaimsToText)(claims, candidate.title);
        const match = existing.find((item) => (candidate.doi && item.doi === candidate.doi) || (candidate.pmid && item.pmid === candidate.pmid)) ??
            null;
        const oaInfo = await (0, oaService_1.checkOpenAccess)(candidate.doi);
        if (match) {
            const updated = await prisma_1.prisma.literatureResource.update({
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
        }
        else {
            const created = await prisma_1.prisma.literatureResource.create({
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
    await prisma_1.prisma.knowledgeDocument.update({
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
    const resources = await prisma_1.prisma.literatureResource.findMany({
        where: {
            knowledgeId,
            ...(Array.isArray(ids) && ids.length ? { id: { in: ids } } : {}),
        },
    });
    const results = [];
    for (const resource of resources) {
        if (!resource.oaPdfUrl && !resource.oaUrl) {
            await prisma_1.prisma.literatureResource.update({
                where: { id: resource.id },
                data: { downloadStatus: 'no_oa' },
            });
            results.push({ id: resource.id, status: 'no_oa' });
            continue;
        }
        const url = resource.oaPdfUrl ?? resource.oaUrl;
        try {
            const filePath = await (0, downloader_1.downloadPdf)(knowledgeId, resource.id, url);
            const updated = await prisma_1.prisma.literatureResource.update({
                where: { id: resource.id },
                data: {
                    localPath: filePath,
                    downloadedAt: new Date(),
                    downloadStatus: 'downloaded',
                },
            });
            results.push({ id: resource.id, status: 'downloaded', localPath: updated.localPath });
        }
        catch (error) {
            console.error('[literature] download failed', resource.id, error);
            await prisma_1.prisma.literatureResource.update({
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
    const resources = await prisma_1.prisma.literatureResource.findMany({
        where: {
            knowledgeId,
            downloadStatus: 'downloaded',
            localPath: { not: null },
            ...(Array.isArray(ids) && ids.length ? { id: { in: ids } } : {}),
        },
    });
    const summaries = [];
    for (const resource of resources) {
        if (!resource.localPath)
            continue;
        try {
            const { content, quality, note } = await (0, summarizer_1.summarizePdf)(resource.localPath);
            const updated = await prisma_1.prisma.literatureResource.update({
                where: { id: resource.id },
                data: {
                    summaryJson: content,
                    summaryQuality: quality,
                    summaryQualityNote: note,
                },
            });
            summaries.push({ id: resource.id, summary: updated.summaryJson, quality: quality, note });
        }
        catch (error) {
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
    const resources = await prisma_1.prisma.literatureResource.findMany({
        where: { knowledgeId },
        orderBy: { fetchedAt: 'desc' },
    });
    res.json({ resources });
});
exports.literatureRouter = router;
