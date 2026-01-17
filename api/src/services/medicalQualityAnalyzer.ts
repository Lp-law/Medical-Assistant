type Severity = 'info' | 'warning' | 'critical';

type AssertionType = 'FACT' | 'INTERPRETATION' | 'POSSIBILITY';

export interface QualityFinding {
  code: string;
  message: string;
  severity: Severity;
  relatedClaimIds?: string[];
  domain?: string;
  assertionType?: AssertionType;
  basis?: string[];
  missingEvidence?: string[];
  reliability?: {
    level: 'high' | 'medium' | 'low';
    rationale: string;
  };
  caution?: string;
}

interface ClaimSource {
  page?: number;
  lineRange?: [number, number];
  snippet?: string;
}

interface Claim {
  id?: string;
  type?: string;
  value?: string;
  unit?: string;
  date?: string;
  source?: ClaimSource;
  evidenceQuality?: 'high' | 'medium' | 'low';
}

interface TimelineEvent {
  id: string;
  date?: string;
  datePrecision?: 'day' | 'month' | 'year' | 'unknown';
  hidden?: boolean;
}

interface Flag {
  code?: string;
  severity?: Severity;
  message?: string;
}

interface AnalyzerInput {
  claims: Claim[];
  timeline: TimelineEvent[];
  flags: Flag[];
  reasoningFindings?: QualityFinding[];
}

interface AnalyzerResult {
  findings: QualityFinding[];
  score: number;
}

const clamp = (value: number, min = 0, max = 100): number => Math.max(min, Math.min(max, value));
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const isValidDate = (value?: string): boolean => {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const hasTraceability = (source?: ClaimSource): boolean => {
  if (!source) return false;
  if (typeof source.page === 'number') return true;
  if (source.lineRange && source.lineRange.length === 2) return true;
  if (source.snippet && source.snippet.trim().length > 10) return true;
  return false;
};

const isGenericClaim = (claim: Claim): boolean => {
  const text = `${claim.type ?? ''} ${claim.value ?? ''}`.trim().toLowerCase();
  if (!text || text.length < 5) {
    return true;
  }
  return (
    text.startsWith('אירוע') ||
    text.startsWith('note') ||
    text.includes('כללי') ||
    text.includes('תיאור') ||
    text.includes('general') ||
    text.includes('unspecified')
  );
};

const extractNumericValue = (text?: string): number | null => {
  if (!text) return null;
  const match = text.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  return Number(match[0]);
};

const computeTimelineGaps = (events: TimelineEvent[]): number => {
  const datedEvents = events
    .filter((event) => event.date && isValidDate(event.date))
    .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());

  let gaps = 0;
  for (let i = 1; i < datedEvents.length; i += 1) {
    const prev = new Date(datedEvents[i - 1].date!).getTime();
    const current = new Date(datedEvents[i].date!).getTime();
    const deltaDays = (current - prev) / (1000 * 60 * 60 * 24);
    if (deltaDays > 180) {
      gaps += 1;
    }
  }
  return gaps;
};

const LEGAL_DISCLAIMER = 'המערכת אינה מחליפה מומחה רפואי. זהו כלי תומך החלטה משפטית בלבד.';

const buildQualityFinding = ({
  code,
  message,
  severity,
  relatedClaimIds,
  domain,
  basisHint,
  missingHint,
  assertionType,
  reliabilityLevel,
}: {
  code: string;
  message: string;
  severity: Severity;
  relatedClaimIds?: string[];
  domain?: string;
  basisHint?: string;
  missingHint?: string;
  assertionType?: AssertionType;
  reliabilityLevel?: 'high' | 'medium' | 'low';
}): QualityFinding => {
  const basis: string[] = [basisHint ?? 'מדדי איכות מסמך דטרמיניסטיים'];
  if (relatedClaimIds && relatedClaimIds.length) {
    basis.push(`טענות מושפעות: ${relatedClaimIds.join(', ')}`);
  }
  return {
    code,
    message,
    severity,
    relatedClaimIds,
    domain,
    assertionType: assertionType ?? (severity === 'critical' ? 'INTERPRETATION' : 'POSSIBILITY'),
    basis,
    missingEvidence: [missingHint ?? 'נדרש תיעוד נוסף או חוות דעת מומחה אנושי'],
    reliability: {
      level: reliabilityLevel ?? (severity === 'critical' ? 'medium' : 'low'),
      rationale: 'חישוב מבוסס מדדי עקיבות/אמינות של המסמך',
    },
    caution: LEGAL_DISCLAIMER,
  };
};

export const analyzeMedicalQuality = ({ claims, timeline, flags, reasoningFindings = [] }: AnalyzerInput): AnalyzerResult => {
  const safeClaims = Array.isArray(claims) ? claims : [];
  const safeTimeline = Array.isArray(timeline) ? timeline : [];
  const safeFlags = Array.isArray(flags) ? flags : [];

  const findings: QualityFinding[] = [];

  if (!safeClaims.length) {
    findings.push(
      buildQualityFinding({
        code: 'OPINION_NO_CLAIMS',
        message: 'לא נמצאו קביעות רפואיות במסמך זה.',
        severity: 'warning',
        basisHint: 'מדד: מספר קביעות מאופס',
        missingHint: 'נדרש לספק קביעות רפואיות מבוססות מקור',
      }),
    );
    return { findings, score: 40 };
  }

  const datedClaims = safeClaims.filter((claim) => isValidDate(claim.date));
  const traceableClaims = safeClaims.filter((claim) => hasTraceability(claim.source));
  const genericClaims = safeClaims.filter((claim) => isGenericClaim(claim));

  const percentWithDates = datedClaims.length / safeClaims.length;
  const percentTraceable = traceableClaims.length / safeClaims.length;
  const percentGeneric = genericClaims.length / safeClaims.length;
  const lowEvidenceClaims = safeClaims.filter((claim) => claim.evidenceQuality === 'low');
  const percentLowEvidence = lowEvidenceClaims.length / safeClaims.length;

  if (percentWithDates < 0.6) {
    findings.push(
      buildQualityFinding({
        code: 'OPINION_LACKS_DATES',
        message: 'חלק גדול מהקביעות אינן צמודות לתאריך מאומת.',
        severity: percentWithDates < 0.4 ? 'critical' : 'warning',
        relatedClaimIds: safeClaims.filter((claim) => !isValidDate(claim.date)).map((claim) => claim.id).filter(Boolean) as string[],
        basisHint: 'מדד: אחוז קביעות עם תאריך',
        missingHint: 'יש לציין תאריכים מדויקים לכל קביעה רפואית',
      }),
    );
  }

  if (percentTraceable < 0.6) {
    findings.push(
      buildQualityFinding({
        code: 'OPINION_WEAK_TRACEABILITY',
        message: 'חלק מהקביעות חסרות ציון עמוד או ציטוט מפורט מהמסמך.',
        severity: percentTraceable < 0.4 ? 'critical' : 'warning',
        relatedClaimIds: safeClaims
          .filter((claim) => !hasTraceability(claim.source))
          .map((claim) => claim.id)
          .filter(Boolean) as string[],
        basisHint: 'מדד: אחוז קביעות עם מקור צמוד',
        missingHint: 'יש להוסיף ציון עמוד ושורות לכל קביעה',
      }),
    );
  }

  if (percentGeneric > 0.4) {
    findings.push(
      buildQualityFinding({
        code: 'OPINION_TOO_GENERAL',
        message: 'ריבוי קביעות כלליות ולא מדידות מקשה על שימוש משפטי.',
        severity: percentGeneric > 0.6 ? 'warning' : 'info',
        basisHint: 'מדד: שיעור טענות כלליות שאינן מדידות',
        missingHint: 'נדרש ניסוח מדיד וקשור לעמוד/בדיקה',
      }),
    );
  }

  if (percentLowEvidence > 0.3) {
    findings.push(
      buildQualityFinding({
        code: 'OPINION_WEAK_EVIDENCE',
        message: 'חלק משמעותי מהקביעות מבוסס על מקור חלש או OCR בעייתי.',
        severity: percentLowEvidence > 0.5 ? 'warning' : 'info',
        relatedClaimIds: lowEvidenceClaims.map((claim) => claim.id).filter(Boolean) as string[],
        basisHint: 'מדד: שיעור קביעות עם איכות ראיה נמוכה',
        missingHint: 'יש לצרף מקורות סרוקים איכותיים או אישור ידני',
      }),
    );
  }

  const disabilityClaims = safeClaims.filter((claim) =>
    /(disability|נכות|%)/i.test(`${claim.type ?? ''} ${claim.value ?? ''}`),
  );
  const disabilityValues = disabilityClaims
    .map((claim) => ({ id: claim.id, value: extractNumericValue(claim.value ?? claim.type) }))
    .filter((entry) => entry.value !== null) as Array<{ id?: string; value: number }>;

  const distinctValues = Array.from(new Set(disabilityValues.map((entry) => entry.value)));
  if (distinctValues.length > 1) {
    findings.push(
      buildQualityFinding({
        code: 'OPINION_INTERNAL_CONTRADICTIONS',
        message: 'רמות נכות שונות מופיעות במסמך ללא הסבר.',
        severity: 'warning',
        relatedClaimIds: disabilityValues.map((entry) => entry.id).filter(Boolean) as string[],
        basisHint: 'השוואת טענות נכות עם ערכים מספריים שונים',
        missingHint: 'נדרש הסבר רפואי או תיעוד המאחד בין האחוזים',
      }),
    );
  }

  const timelineGaps = computeTimelineGaps(safeTimeline);
  if (timelineGaps > 0) {
    findings.push(
      buildQualityFinding({
        code: 'OPINION_FRAGMENTED_TIMELINE',
        message: 'קיימים פערים משמעותיים בציר הזמן של הטיפול.',
        severity: timelineGaps > 1 ? 'warning' : 'info',
        basisHint: 'מדד: מרווחים של מעל 180 ימים בין אירועים מתועדים',
        missingHint: 'נדרש להשלים תיעוד תקופתי או ביקורות הביניים',
      }),
    );
  }

  const criticalFlags = safeFlags.filter((flag) => flag.severity === 'critical').length;
  const flagOverload = safeFlags.length > 0 ? criticalFlags / safeFlags.length : 0;
  if (flagOverload > 0.25 || criticalFlags >= 3) {
    findings.push(
      buildQualityFinding({
        code: 'OPINION_FLAG_OVERLOAD',
        message: 'המסמך כולל עומס דגלים חריג בממצאים קריטיים.',
        severity: 'warning',
        basisHint: 'ניתוח יחס דגלים קריטיים לעומת כלל הדגלים',
        missingHint: 'יש לספק בירור או חוות דעת אנושית לגבי הדגלים הקריטיים',
      }),
    );
  }

  const dateScore = percentWithDates || 0;
  const traceScore = percentTraceable || 0;
  const genericPenalty = Math.min(0.6, percentGeneric);
  const contradictionPenalty = distinctValues.length > 1 ? Math.min(1, (distinctValues.length - 1) * 0.3) : 0;
  const flagPenalty = Math.min(1, criticalFlags * 0.2);
  const timelineCoverage = safeTimeline.length
    ? safeTimeline.filter((event) => event.date && isValidDate(event.date)).length / safeTimeline.length
    : 0.5;
  const timelinePenalty = Math.min(1, timelineGaps * 0.2);
  const timelineHealth = clamp01(timelineCoverage - timelinePenalty);

  const criticalReasoning = reasoningFindings.filter((finding) => finding.severity === 'critical').length;
  const reasoningPenalty = Math.min(0.25, criticalReasoning * 0.1 + reasoningFindings.length * 0.05);
  const highEvidenceRatio = safeClaims.length
    ? safeClaims.filter((claim) => claim.evidenceQuality === 'high').length / safeClaims.length
    : 0;
  const evidenceFactor = 1 - percentLowEvidence + highEvidenceRatio * 0.2;

  const score =
    dateScore * 20 +
    traceScore * 20 +
    (1 - genericPenalty) * 15 +
    (1 - contradictionPenalty) * 15 +
    (1 - flagPenalty) * 15 +
    timelineHealth * 10 +
    evidenceFactor * 5 -
    reasoningPenalty * 10;

  const hasCriticalReasoning = reasoningFindings.some((finding) => finding.severity === 'critical');
  const hasCriticalFlags = safeFlags.some((flag) => flag.code === 'OCR_LOW_CONFIDENCE_SECTION' || flag.severity === 'critical');
  if (hasCriticalReasoning || hasCriticalFlags || findings.some((finding) => finding.severity === 'critical')) {
    findings.push(
      buildQualityFinding({
        code: 'HUMAN_EXPERT_REQUIRED',
        message: 'בהתבסס על החומר הקיים יש לערב מומחה רפואי בלתי תלוי.',
        severity: 'critical',
        basisHint: 'נרשמו ממצאים קריטיים/אמינות OCR נמוכה',
        missingHint: 'נדרשת חוות דעת מומחה אנושי או בדיקות משלימות',
        assertionType: 'POSSIBILITY',
        reliabilityLevel: 'medium',
      }),
    );
  }

  return {
    findings,
    score: clamp(Math.round(score)),
  };
};

