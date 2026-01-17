import { Router } from 'express';
import { prisma } from '../services/prisma';
import { requireAuth } from '../middleware/auth';
import { buildTimelineFromClaims } from '../services/timelineBuilder';
import { analyzeMedicalQuality } from '../services/medicalQualityAnalyzer';
import { evaluateClaimEvidence } from '../services/claimEvidenceEvaluator';
import { applyOcrHardening, shouldTriggerOcrHardening } from '../services/ocrHardening';
import { analyzeMedicalReasoning } from '../services/medicalReasoningAnalyzer';

const router = Router();

type JsonArray = Array<Record<string, unknown>>;

const normalizeArray = (value: unknown): JsonArray => {
  if (Array.isArray(value)) {
    return value as JsonArray;
  }
  return [];
};

const extractOcrScore = (score: unknown): number | undefined => {
  if (!score || typeof score !== 'object') return undefined;
  const breakdown = (score as { breakdown?: unknown }).breakdown;
  if (!breakdown || typeof breakdown !== 'object') return undefined;
  const ocr = (breakdown as Record<string, unknown>).ocr;
  if (typeof ocr === 'number') return ocr;
  if (ocr && typeof ocr === 'object' && typeof (ocr as { value?: unknown }).value === 'number') {
    return (ocr as { value?: number }).value;
  }
  return undefined;
};

const extractOcrReasons = (score: unknown): string[] => {
  if (!score || typeof score !== 'object') return [];
  const breakdown = (score as { breakdown?: unknown }).breakdown;
  if (!breakdown || typeof breakdown !== 'object') return [];
  const ocr = (breakdown as Record<string, unknown>).ocr;
  if (ocr && typeof ocr === 'object' && Array.isArray((ocr as { reasons?: unknown }).reasons)) {
    return (ocr as { reasons: string[] }).reasons;
  }
  return [];
};

const mergeFlags = (existing: JsonArray, additions: JsonArray): JsonArray => {
  const seen = new Set<string>();
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

router.use(requireAuth);

router.get('/:id', async (req, res) => {
  const document = await prisma.knowledgeDocument.findUnique({
    where: { id: req.params.id },
  });

  if (!document) {
    res.status(404).json({ error: 'not_found' });
    return;
  }

  const claims = normalizeArray(document.claims);
  const currentFlags = normalizeArray(document.flags);
  const storedTimeline = Array.isArray(document.timeline) ? (document.timeline as JsonArray) : [];
  const storedQualityFindings = Array.isArray(document.qualityFindings)
    ? (document.qualityFindings as JsonArray)
    : [];
  const storedQualityScore =
    typeof document.medicalQualityScore === 'number' ? document.medicalQualityScore : 0;
  const storedReasoningFindings = Array.isArray(document.reasoningFindings)
    ? (document.reasoningFindings as JsonArray)
    : [];
  const lexicalMap = Array.isArray(document.ocrLexicalMap) ? (document.ocrLexicalMap as JsonArray) : [];
  const currentOcrMode = (document as { ocrMode?: string }).ocrMode ?? 'base';

  const hardeningApplied = applyOcrHardening(lexicalMap as any[]);
  const ocrScoreValue = extractOcrScore(document.score);
  const claimEvaluation = evaluateClaimEvidence({
    claims: claims as any[],
    ocrScore: ocrScoreValue,
    lexicalText: hardeningApplied.improvedMap.map((line) => line.text).join(' '),
  });
  const claimsWithEvidence = claimEvaluation.claims;

  const timelineResult = buildTimelineFromClaims(claimsWithEvidence as any[]);
  let mergedFlags = mergeFlags(currentFlags, timelineResult.flags as any[]);
  mergedFlags = mergeFlags(mergedFlags, claimEvaluation.flags as any[]);

  if (
    shouldTriggerOcrHardening({
      ocrScore: ocrScoreValue,
      flags: mergedFlags as any[],
    })
  ) {
    const ocrReasons = extractOcrReasons(document.score);
    mergedFlags = mergeFlags(mergedFlags, [
      {
        code: 'OCR_LOW_CONFIDENCE_SECTION',
        message:
          ocrReasons.length > 0
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

  const reasoningFindings = analyzeMedicalReasoning(claimsWithEvidence as any[], nextTimeline as any[]);

  const qualityResult = analyzeMedicalQuality({
    claims: claimsWithEvidence as any[],
    timeline: nextTimeline as any[],
    flags: nextFlags as any[],
    reasoningFindings,
  });

  const qualityFindingsChanged =
    JSON.stringify(storedQualityFindings) !== JSON.stringify(qualityResult.findings);
  const qualityScoreChanged = storedQualityScore !== qualityResult.score;

  const reasoningChanged =
    JSON.stringify(storedReasoningFindings) !== JSON.stringify(reasoningFindings);

  const updateData: Record<string, unknown> = {};
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
    await prisma.knowledgeDocument.update({
      where: { id: document.id },
      data: updateData,
    });
  }

  const literatureResources = await prisma.literatureResource.findMany({
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

  const documents = await prisma.knowledgeDocument.findMany({
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

export const knowledgeRouter = router;

