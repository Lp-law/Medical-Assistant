"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const medicalReasoningAnalyzer_1 = require("../medicalReasoningAnalyzer");
(0, vitest_1.describe)('medical reasoning analyzer', () => {
    (0, vitest_1.it)('detects diagnosis contradiction', () => {
        const findings = (0, medicalReasoningAnalyzer_1.analyzeMedicalReasoning)([
            { id: 'a', type: 'Diagnosis', value: 'Stroke', date: '2024-01-15' },
            { id: 'b', type: 'Diagnosis', value: 'Migraine', date: '2024-01-16' },
        ], []);
        (0, vitest_1.expect)(findings.some((f) => f.code === 'CONTRADICTION_DIAGNOSIS')).toBe(true);
    });
    (0, vitest_1.it)('detects missing key tests', () => {
        const findings = (0, medicalReasoningAnalyzer_1.analyzeMedicalReasoning)([{ id: 'c', type: 'Complaint', value: 'back pain', date: '2024-02-01' }], []);
        (0, vitest_1.expect)(findings.some((f) => f.code === 'MISSING_KEY_TEST_ORTHO')).toBe(true);
    });
    (0, vitest_1.it)('enriches findings with assertion metadata and disclaimer', () => {
        const findings = (0, medicalReasoningAnalyzer_1.analyzeMedicalReasoning)([
            { id: 'a1', type: 'Diagnosis', value: 'Stroke', date: '2024-05-01' },
            { id: 'a2', type: 'Diagnosis', value: 'Migraine', date: '2024-05-02' },
        ], []);
        const contradiction = findings.find((f) => f.code === 'CONTRADICTION_DIAGNOSIS');
        (0, vitest_1.expect)(contradiction?.assertionType).toBeDefined();
        (0, vitest_1.expect)(contradiction?.basis && contradiction.basis.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(contradiction?.caution).toMatch(/המערכת אינה מחליפה/);
        (0, vitest_1.expect)(contradiction?.missingEvidence?.length).toBeGreaterThan(0);
    });
});
