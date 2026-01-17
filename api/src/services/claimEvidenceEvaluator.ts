type EvidenceQuality = 'high' | 'medium' | 'low';

interface ClaimSource {
  page?: number;
  lineRange?: [number, number];
  snippet?: string;
}

type AssertionType = 'FACT' | 'INTERPRETATION' | 'POSSIBILITY';

interface ReliabilityNote {
  level: EvidenceQuality;
  rationale: string;
}

interface Claim {
  id?: string;
  type?: string;
  value?: string;
  date?: string;
  confidence?: number;
  source?: ClaimSource;
  evidenceQuality?: EvidenceQuality;
  evidenceNotes?: string;
  assertionType?: AssertionType;
  basis?: string[];
  missingEvidence?: string[];
  reliability?: ReliabilityNote;
  caution?: string;
}

interface EvaluationInput {
  claims: Claim[];
  ocrScore?: number;
  lexicalText?: string;
}

interface EvaluationResult {
  claims: Claim[];
  flags: Array<{ code: string; message: string; severity: 'info' | 'warning' | 'critical' }>;
  stats: {
    lowQualityCount: number;
  };
}

const qualityOrder: EvidenceQuality[] = ['high', 'medium', 'low'];

const downgrade = (current: EvidenceQuality, steps = 1): EvidenceQuality => {
  const index = qualityOrder.indexOf(current);
  return qualityOrder[Math.min(qualityOrder.length - 1, index + steps)];
};

const isValidDate = (value?: string): boolean => {
  if (!value) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
};

const hasTraceability = (source?: ClaimSource): boolean => {
  if (!source) return false;
  if (typeof source.page === 'number') return true;
  if (source.lineRange && source.lineRange.length === 2) return true;
  if (source.snippet && source.snippet.trim().length > 8) return true;
  return false;
};

const trimSnippet = (snippet?: string): string | undefined => {
  if (!snippet) return undefined;
  return snippet.length > 240 ? `${snippet.slice(0, 237)}...` : snippet;
};

const LEGAL_DISCLAIMER = 'המערכת אינה מחליפה מומחה רפואי. זהו כלי תומך החלטה משפטית בלבד.';

const buildBasis = (source?: ClaimSource): string[] => {
  if (!source) {
    return ['מקור המסמך לא סומן בפריט זה'];
  }
  const basis: string[] = [];
  if (typeof source.page === 'number') {
    basis.push(`מסמך מקור – עמוד ${source.page}`);
  } else {
    basis.push('מסמך מקור – עמוד לא צוין');
  }
  if (source.lineRange) {
    basis.push(`שורות ${source.lineRange[0]}-${source.lineRange[1]}`);
  }
  if (source.snippet) {
    basis.push(`ציטוט: ${source.snippet.slice(0, 80)}`);
  }
  return basis;
};

const determineAssertionType = (quality: EvidenceQuality, hasFullTrace: boolean): AssertionType => {
  if (quality === 'high' && hasFullTrace) return 'FACT';
  if (quality === 'medium') return 'INTERPRETATION';
  return 'POSSIBILITY';
};

export const evaluateClaimEvidence = ({ claims, ocrScore, lexicalText }: EvaluationInput): EvaluationResult => {
  const safeClaims = Array.isArray(claims) ? claims : [];
  const updatedClaims: Claim[] = [];
  const flags: EvaluationResult['flags'] = [];

  safeClaims.forEach((claim) => {
    let quality: EvidenceQuality = 'high';
    const reasons: string[] = [];
    const missingEvidence: string[] = [];

    if (!isValidDate(claim.date)) {
      quality = downgrade(quality);
      reasons.push('אין תאריך מאומת');
      missingEvidence.push('תאריך מדויק לכל קביעה');
    }

    if (!hasTraceability(claim.source)) {
      quality = downgrade(quality);
      reasons.push('מקור חלקי');
      missingEvidence.push('ציון עמוד ושורות מהמסמך');
    }

    if ((ocrScore ?? 1) < 0.55) {
      quality = downgrade(quality);
      reasons.push('OCR בעל אמינות נמוכה');
      missingEvidence.push('סריקה משופרת או בדיקה ידנית');
    }

    if (claim.value && claim.value.split(' ').length < 3) {
      quality = downgrade(quality, 1);
      reasons.push('קביעה קצרה מדי');
      missingEvidence.push('תיאור מפורט יותר של העובדה');
    }

    const trimmedSnippet = trimSnippet(claim.source?.snippet);
    const confidencePenalty = quality === 'low' ? 0.4 : quality === 'medium' ? 0.2 : 0;
    const confidence = Math.max(0.2, (claim.confidence ?? 0.75) - confidencePenalty);

    if (!trimmedSnippet && lexicalText && claim.value) {
      const idx = lexicalText.indexOf(claim.value.slice(0, 20));
      if (idx >= 0) {
        const snippet = lexicalText.slice(idx, idx + 160);
        claim.source = { ...(claim.source ?? {}), snippet };
      }
    }

    const basis = buildBasis(claim.source);
    const assertionType = determineAssertionType(quality, hasTraceability(claim.source));
    updatedClaims.push({
      ...claim,
      confidence,
      source: { ...(claim.source ?? {}), snippet: trimSnippet(claim.source?.snippet) },
      evidenceQuality: quality,
      evidenceNotes: reasons.join(' · '),
      assertionType,
      basis,
      missingEvidence,
      reliability: {
        level: quality,
        rationale: reasons.length ? reasons.join(' · ') : 'נמצא תיעוד מספק בקובץ',
      },
      caution: LEGAL_DISCLAIMER,
    });
  });

  const lowQualityCount = updatedClaims.filter((claim) => claim.evidenceQuality === 'low').length;
  if (lowQualityCount > 0) {
    flags.push({
      code: 'CLAIM_WEAK_EVIDENCE',
      message: 'חלק מהקביעות מבוססות על מקור חלש או OCR לא יציב.',
      severity: lowQualityCount / Math.max(updatedClaims.length, 1) > 0.4 ? 'warning' : 'info',
    });
  }

  if ((ocrScore ?? 1) < 0.5) {
    flags.push({
      code: 'OCR_LOW_CONFIDENCE_SECTION',
      message: 'מערכת ה-OCR דיווחה על אמינות נמוכה בקובץ זה.',
      severity: 'warning',
    });
  }

  return {
    claims: updatedClaims,
    flags,
    stats: { lowQualityCount },
  };
};

