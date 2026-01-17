import { describe, expect, it } from 'vitest';
import { analyzeMedicalQuality } from '../medicalQualityAnalyzer';

describe('medicalQualityAnalyzer', () => {
  it('flags opinions lacking dates and sources', () => {
    const result = analyzeMedicalQuality({
      claims: [
        { id: 'c1', type: 'Exam', value: 'בדיקה כללית ללא תאריך' },
        { id: 'c2', type: 'Disability', value: 'נכות 40% ללא עוגן' },
      ],
      timeline: [],
      flags: [],
    });

    expect(result.findings.some((finding) => finding.code === 'OPINION_LACKS_DATES')).toBe(true);
    expect(result.findings.some((finding) => finding.code === 'OPINION_WEAK_TRACEABILITY')).toBe(true);
    expect(result.score).toBeLessThan(70);
  });

  it('adds human expert requirement when critical conditions appear', () => {
    const result = analyzeMedicalQuality({
      claims: [{ id: 'c3', type: 'Diagnosis', value: 'Condition', date: '2024-01-01' }],
      timeline: [],
      flags: [{ code: 'OCR_LOW_CONFIDENCE_SECTION', severity: 'critical', message: 'low ocr' }],
      reasoningFindings: [{ code: 'RISK', message: 'risk', severity: 'critical', basis: ['test'], missingEvidence: ['doc'], caution: 'המערכת אינה מחליפה מומחה', reliability: { level: 'medium', rationale: 'rule' } }],
    });

    const humanExpert = result.findings.find((finding) => finding.code === 'HUMAN_EXPERT_REQUIRED');
    expect(humanExpert).toBeDefined();
    expect(humanExpert?.assertionType).toBeDefined();
    expect(humanExpert?.caution).toMatch(/המערכת אינה מחליפה/);
  });
});

