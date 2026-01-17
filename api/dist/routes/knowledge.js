"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.knowledgeRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../services/prisma");
const auth_1 = require("../middleware/auth");
const timelineBuilder_1 = require("../services/timelineBuilder");
const medicalQualityAnalyzer_1 = require("../services/medicalQualityAnalyzer");
const claimEvidenceEvaluator_1 = require("../services/claimEvidenceEvaluator");
const ocrHardening_1 = require("../services/ocrHardening");
const medicalReasoningAnalyzer_1 = require("../services/medicalReasoningAnalyzer");
const router = (0, express_1.Router)();
const normalizeArray = (value) => {
    if (Array.isArray(value)) {
        return value;
    }
    return [];
};
const extractOcrScore = (score) => {
    if (!score || typeof score !== 'object')
        return undefined;
    const breakdown = score.breakdown;
    if (!breakdown || typeof breakdown !== 'object')
        return undefined;
    const ocr = breakdown.ocr;
    if (typeof ocr === 'number')
        return ocr;
    if (ocr && typeof ocr === 'object' && typeof ocr.value === 'number') {
        return ocr.value;
    }
    return undefined;
};
const extractOcrReasons = (score) => {
    if (!score || typeof score !== 'object')
        return [];
    const breakdown = score.breakdown;
    if (!breakdown || typeof breakdown !== 'object')
        return [];
    const ocr = breakdown.ocr;
    if (ocr && typeof ocr === 'object' && Array.isArray(ocr.reasons)) {
        return ocr.reasons;
    }
    return [];
};
const mergeFlags = (existing, additions) => {
    const seen = new Set();
    const combined = [...existing, ...additions];
    return combined.filter((flag) => {
        const code = typeof flag.code === 'string' ? flag.code : 'UNKNOWN';
        const message = typeof flag.message === 'string' ? flag.message : JSON.stringify(flag);
        const key = `${code}-${message}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
};
router.use(auth_1.requireAuth);
router.get('/:id', async (req, res) => {
    const document = await prisma_1.prisma.knowledgeDocument.findUnique({
        where: { id: req.params.id },
    });
    if (!document) {
        res.status(404).json({ error: 'not_found' });
        return;
    }
    const claims = normalizeArray(document.claims);
    const currentFlags = normalizeArray(document.flags);
    const storedTimeline = Array.isArray(document.timeline) ? document.timeline : [];
    const storedQualityFindings = Array.isArray(document.qualityFindings)
        ? document.qualityFindings
        : [];
    const storedQualityScore = typeof document.medicalQualityScore === 'number' ? document.medicalQualityScore : 0;
    const storedReasoningFindings = Array.isArray(document.reasoningFindings)
        ? document.reasoningFindings
        : [];
    const lexicalMap = Array.isArray(document.ocrLexicalMap) ? document.ocrLexicalMap : [];
    const currentOcrMode = document.ocrMode ?? 'base';
    const hardeningApplied = (0, ocrHardening_1.applyOcrHardening)(lexicalMap);
    const ocrScoreValue = extractOcrScore(document.score);
    const claimEvaluation = (0, claimEvidenceEvaluator_1.evaluateClaimEvidence)({
        claims: claims,
        ocrScore: ocrScoreValue,
        lexicalText: hardeningApplied.improvedMap.map((line) => line.text).join(' '),
    });
    const claimsWithEvidence = claimEvaluation.claims;
    const timelineResult = (0, timelineBuilder_1.buildTimelineFromClaims)(claimsWithEvidence);
    let mergedFlags = mergeFlags(currentFlags, timelineResult.flags);
    mergedFlags = mergeFlags(mergedFlags, claimEvaluation.flags);
    if ((0, ocrHardening_1.shouldTriggerOcrHardening)({
        ocrScore: ocrScoreValue,
        flags: mergedFlags,
    })) {
        const ocrReasons = extractOcrReasons(document.score);
        mergedFlags = mergeFlags(mergedFlags, [
            {
                code: 'OCR_LOW_CONFIDENCE_SECTION',
                message: ocrReasons.length > 0
                    ? `אותרה איכות OCR נמוכה (${ocrReasons.join(' | ')}). מומלץ להצליב מול הסריקה המקורית.`
                    : 'אותרה איכות OCR נמוכה, מומלץ להצליב מול הסריקה המקורית.',
                severity: 'warning',
            },
        ]);
    }
    const timelineChanged = JSON.stringify(storedTimeline) !== JSON.stringify(timelineResult.events);
    const flagsChanged = JSON.stringify(currentFlags) !== JSON.stringify(mergedFlags);
    const nextTimeline = timelineChanged ? timelineResult.events : storedTimeline;
    const nextFlags = flagsChanged ? mergedFlags : currentFlags;
    const reasoningFindings = (0, medicalReasoningAnalyzer_1.analyzeMedicalReasoning)(claimsWithEvidence, nextTimeline);
    const qualityResult = (0, medicalQualityAnalyzer_1.analyzeMedicalQuality)({
        claims: claimsWithEvidence,
        timeline: nextTimeline,
        flags: nextFlags,
        reasoningFindings,
    });
    const qualityFindingsChanged = JSON.stringify(storedQualityFindings) !== JSON.stringify(qualityResult.findings);
    const qualityScoreChanged = storedQualityScore !== qualityResult.score;
    const reasoningChanged = JSON.stringify(storedReasoningFindings) !== JSON.stringify(reasoningFindings);
    const updateData = {};
    if (timelineChanged) {
        updateData.timeline = nextTimeline;
    }
    if (flagsChanged) {
        updateData.flags = nextFlags;
    }
    if (claimEvaluation.flags.length > 0 || claimEvaluation.claims !== claims) {
        updateData.claims = claimsWithEvidence;
    }
    if (qualityFindingsChanged || qualityScoreChanged) {
        updateData.qualityFindings = qualityResult.findings;
        updateData.medicalQualityScore = qualityResult.score;
    }
    if (reasoningChanged) {
        updateData.reasoningFindings = reasoningFindings;
    }
    if (Object.keys(updateData).length > 0) {
        await prisma_1.prisma.knowledgeDocument.update({
            where: { id: document.id },
            data: updateData,
        });
    }
    const literatureResources = await prisma_1.prisma.literatureResource.findMany({
        where: { knowledgeId: document.id },
        orderBy: { fetchedAt: 'desc' },
    });
    res.json({
        document: {
            ...document,
            claims: claimsWithEvidence,
            timeline: nextTimeline,
            flags: nextFlags,
            qualityFindings: qualityResult.findings,
            medicalQualityScore: qualityResult.score,
            reasoningFindings,
            literatureResources,
            ocrModeUsed: currentOcrMode,
        },
    });
});
router.get('/', async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const docType = typeof req.query.docType === 'string' ? req.query.docType : undefined;
    const documents = await prisma_1.prisma.knowledgeDocument.findMany({
        where: docType ? { docType } : undefined,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
            id: true,
            title: true,
            docType: true,
            score: true,
            flags: true,
        },
    });
    res.json({
        documents,
        pagination: {
            limit,
            offset,
            count: documents.length,
        },
    });
});
exports.knowledgeRouter = router;
