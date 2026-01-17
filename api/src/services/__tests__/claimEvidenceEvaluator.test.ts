import { describe, expect, it } from 'vitest';
import { evaluateClaimEvidence } from '../claimEvidenceEvaluator';

describe('claimEvidenceEvaluator', () => {
  it('downgrades claim due to missing date and traceability', () => {
    const result = evaluateClaimEvidence({
      claims: [{ id: 'c1', type: 'Exam', value: 'בדיקה כללית' }],
      ocrScore: 0.45,
    });
    expect(result.claims[0].evidenceQuality).toBe('low');
    expect(result.flags.some((flag) => flag.code === 'CLAIM_WEAK_EVIDENCE')).toBe(true);
  });

  it('annotates claims with assertion type and cautious language', () => {
    const result = evaluateClaimEvidence({
      claims: [
        {
          id: 'c2',
          type: 'MRI',
          value: 'MRI lumbar spine showed disc protrusion',
          date: '2024-03-01',
          source: { page: 3, lineRange: [12, 15], snippet: 'MRI lumbar spine...' },
        },
      ],
      ocrScore: 0.9,
    });

    const claim = result.claims[0];
    expect(claim.assertionType).toBe('FACT');
    expect(claim.basis?.length).toBeGreaterThan(0);
    expect(claim.reliability?.level).toBe('high');
    expect(claim.caution).toMatch(/המערכת אינה מחליפה/);

    const banned = [/ברור/, /חד[-\s]?משמעי/, /אין ספק/];
    banned.forEach((pattern) => {
      expect(pattern.test(JSON.stringify(claim))).toBe(false);
    });
  });
});

