import { runSpecialtyRules, SpecialtyFinding } from './medicalSpecialtyRules';

interface Claim {
  id?: string;
  type?: string;
  value?: string;
  date?: string;
  evidenceQuality?: 'high' | 'medium' | 'low';
}

interface TimelineEvent {
  id: string;
  type: string;
  description: string;
  date?: string;
}

type AssertionType = 'FACT' | 'INTERPRETATION' | 'POSSIBILITY';

interface ReasoningFinding {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
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

const isSamePeriod = (dateA?: string, dateB?: string): boolean => {
  if (!dateA || !dateB) return false;
  return dateA.slice(0, 7) === dateB.slice(0, 7);
};

const hasKeyword = (text: string, keywords: string[]): boolean =>
  keywords.some((keyword) => text.toLowerCase().includes(keyword));

const LEGAL_DISCLAIMER = 'המערכת אינה מחליפה מומחה רפואי. זהו כלי תומך החלטה משפטית בלבד.';

const createReasoningFinding = ({
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
  severity: 'info' | 'warning' | 'critical';
  relatedClaimIds?: string[];
  domain?: string;
  basisHint?: string;
  missingHint?: string;
  assertionType?: AssertionType;
  reliabilityLevel?: 'high' | 'medium' | 'low';
}): ReasoningFinding => {
  const defaultBasis =
    relatedClaimIds && relatedClaimIds.length
      ? [`טענות קשורות: ${relatedClaimIds.join(', ')}`]
      : ['בדיקה מבוססת ציר זמן / כללי מומחה'];
  return {
    code,
    message,
    severity,
    relatedClaimIds,
    domain,
    assertionType: assertionType ?? (severity === 'critical' ? 'INTERPRETATION' : 'POSSIBILITY'),
    basis: basisHint ? [...defaultBasis, basisHint] : defaultBasis,
    missingEvidence: [missingHint ?? 'דרוש הסבר קליני או חוות דעת מומחה נוספת'],
    reliability: {
      level: reliabilityLevel ?? (severity === 'critical' ? 'medium' : 'low'),
      rationale: 'הסקה לוגית מתוך טענות קיימות וכללי מומחה דטרמיניסטיים',
    },
    caution: LEGAL_DISCLAIMER,
  };
};

export const analyzeMedicalReasoning = (claims: Claim[], timeline: TimelineEvent[]): ReasoningFinding[] => {
  const findings: ReasoningFinding[] = [];
  const normalize = (value?: string) => (value ?? '').toLowerCase();

  // CONTRADICTION_DIAGNOSIS
  const diagnosisClaims = claims.filter((claim) => hasKeyword(normalize(claim.type), ['diagnos', 'אבחנה']));
  for (let i = 0; i < diagnosisClaims.length; i += 1) {
    for (let j = i + 1; j < diagnosisClaims.length; j += 1) {
      const a = diagnosisClaims[i];
      const b = diagnosisClaims[j];
      if (a.value && b.value && a.value !== b.value && isSamePeriod(a.date, b.date)) {
        findings.push(
          createReasoningFinding({
            code: 'CONTRADICTION_DIAGNOSIS',
            message: 'נמצאו אבחנות שונות באותו פרק זמן ללא הסבר.',
            severity: 'warning',
            relatedClaimIds: [a.id, b.id].filter(Boolean) as string[],
            domain: 'GENERAL',
            basisHint: 'זיהוי שתי אבחנות סמוכות בזמן',
            missingHint: 'יש להציג פירוט או חוות דעת המסבירה את ההבדלים',
          }),
        );
      }
    }
  }

  // CONTRADICTION_WORK_CAPACITY
  const workClaims = claims.filter((claim) => hasKeyword(normalize(claim.type), ['work', 'capacity', 'עבודה', 'כושר']));
  const disabilityClaims = claims.filter((claim) => hasKeyword(normalize(claim.type), ['נכות', 'disability']));
  workClaims.forEach((workClaim) => {
    disabilityClaims.forEach((disabilityClaim) => {
      if (isSamePeriod(workClaim.date, disabilityClaim.date)) {
        findings.push(
          createReasoningFinding({
            code: 'CONTRADICTION_WORK_CAPACITY',
            message: 'כושר העבודה המדווח אינו תואם את רמות הנכות באותו פרק זמן.',
            severity: 'warning',
            relatedClaimIds: [workClaim.id, disabilityClaim.id].filter(Boolean) as string[],
            domain: 'GENERAL',
            basisHint: 'השוואת טענות כושר עבודה מול נכות',
            missingHint: 'נדרש הסבר קליני או עדות מבקשת המאחדת בין האבחנות',
          }),
        );
      }
    });
  });

  // TREATMENT_GAP
  const treatmentEvents = timeline.filter((event) => hasKeyword(event.type, ['treatment', 'therapy', 'physio']));
  const followupEvents = timeline.filter((event) => hasKeyword(event.type, ['follow', 'review', 'מעקב']));
  treatmentEvents.forEach((event) => {
    const hasFollowUp = followupEvents.some(
      (follow) => follow.date && event.date && new Date(follow.date).getTime() > new Date(event.date).getTime(),
    );
    if (!hasFollowUp) {
      findings.push(
        createReasoningFinding({
          code: 'TREATMENT_GAP',
          message: `טיפול (${event.description}) ללא מעקב מתועד.`,
          severity: 'info',
          domain: 'GENERAL',
          basisHint: 'חישוב מתוך אירועי הציר',
          missingHint: 'נדרש תיעוד ביקורת או תכנית המשך',
          assertionType: 'POSSIBILITY',
          reliabilityLevel: 'low',
        }),
      );
    }
  });

  const specialtyFindings: SpecialtyFinding[] = runSpecialtyRules(claims, timeline);
  return [...findings, ...specialtyFindings];
};

