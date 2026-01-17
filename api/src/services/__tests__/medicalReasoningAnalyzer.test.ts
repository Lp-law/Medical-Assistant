import { describe, expect, it } from 'vitest';
import { analyzeMedicalReasoning } from '../medicalReasoningAnalyzer';

describe('medical reasoning analyzer', () => {
  it('detects diagnosis contradiction', () => {
    const findings = analyzeMedicalReasoning(
      [
        { id: 'a', type: 'Diagnosis', value: 'Stroke', date: '2024-01-15' },
        { id: 'b', type: 'Diagnosis', value: 'Migraine', date: '2024-01-16' },
      ],
      [],
    );
    expect(findings.some((f) => f.code === 'CONTRADICTION_DIAGNOSIS')).toBe(true);
  });

  it('detects missing key tests', () => {
    const findings = analyzeMedicalReasoning(
      [{ id: 'c', type: 'Complaint', value: 'back pain', date: '2024-02-01' }],
      [],
    );
    expect(findings.some((f) => f.code === 'MISSING_KEY_TEST_ORTHO')).toBe(true);
  });

  it('enriches findings with assertion metadata and disclaimer', () => {
    const findings = analyzeMedicalReasoning(
      [
        { id: 'a1', type: 'Diagnosis', value: 'Stroke', date: '2024-05-01' },
        { id: 'a2', type: 'Diagnosis', value: 'Migraine', date: '2024-05-02' },
      ],
      [],
    );

    const contradiction = findings.find((f) => f.code === 'CONTRADICTION_DIAGNOSIS');
    expect(contradiction?.assertionType).toBeDefined();
    expect(contradiction?.basis && contradiction.basis.length).toBeGreaterThan(0);
    expect(contradiction?.caution).toMatch(/המערכת אינה מחליפה/);
    expect(contradiction?.missingEvidence?.length).toBeGreaterThan(0);
  });
});

