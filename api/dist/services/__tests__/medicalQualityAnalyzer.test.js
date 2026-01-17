"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const medicalQualityAnalyzer_1 = require("../medicalQualityAnalyzer");
(0, vitest_1.describe)('medicalQualityAnalyzer', () => {
    (0, vitest_1.it)('flags opinions lacking dates and sources', () => {
        const result = (0, medicalQualityAnalyzer_1.analyzeMedicalQuality)({
            claims: [
                { id: 'c1', type: 'Exam', value: 'בדיקה כללית ללא תאריך' },
                { id: 'c2', type: 'Disability', value: 'נכות 40% ללא עוגן' },
            ],
            timeline: [],
            flags: [],
        });
        (0, vitest_1.expect)(result.findings.some((finding) => finding.code === 'OPINION_LACKS_DATES')).toBe(true);
        (0, vitest_1.expect)(result.findings.some((finding) => finding.code === 'OPINION_WEAK_TRACEABILITY')).toBe(true);
        (0, vitest_1.expect)(result.score).toBeLessThan(70);
    });
    (0, vitest_1.it)('adds human expert requirement when critical conditions appear', () => {
        const result = (0, medicalQualityAnalyzer_1.analyzeMedicalQuality)({
            claims: [{ id: 'c3', type: 'Diagnosis', value: 'Condition', date: '2024-01-01' }],
            timeline: [],
            flags: [{ code: 'OCR_LOW_CONFIDENCE_SECTION', severity: 'critical', message: 'low ocr' }],
            reasoningFindings: [{ code: 'RISK', message: 'risk', severity: 'critical', basis: ['test'], missingEvidence: ['doc'], caution: 'המערכת אינה מחליפה מומחה', reliability: { level: 'medium', rationale: 'rule' } }],
        });
        const humanExpert = result.findings.find((finding) => finding.code === 'HUMAN_EXPERT_REQUIRED');
        (0, vitest_1.expect)(humanExpert).toBeDefined();
        (0, vitest_1.expect)(humanExpert?.assertionType).toBeDefined();
        (0, vitest_1.expect)(humanExpert?.caution).toMatch(/המערכת אינה מחליפה/);
    });
});
