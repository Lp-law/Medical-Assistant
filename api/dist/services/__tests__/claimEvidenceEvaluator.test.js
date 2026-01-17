"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const claimEvidenceEvaluator_1 = require("../claimEvidenceEvaluator");
(0, vitest_1.describe)('claimEvidenceEvaluator', () => {
    (0, vitest_1.it)('downgrades claim due to missing date and traceability', () => {
        const result = (0, claimEvidenceEvaluator_1.evaluateClaimEvidence)({
            claims: [{ id: 'c1', type: 'Exam', value: 'בדיקה כללית' }],
            ocrScore: 0.45,
        });
        (0, vitest_1.expect)(result.claims[0].evidenceQuality).toBe('low');
        (0, vitest_1.expect)(result.flags.some((flag) => flag.code === 'CLAIM_WEAK_EVIDENCE')).toBe(true);
    });
    (0, vitest_1.it)('annotates claims with assertion type and cautious language', () => {
        const result = (0, claimEvidenceEvaluator_1.evaluateClaimEvidence)({
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
        (0, vitest_1.expect)(claim.assertionType).toBe('FACT');
        (0, vitest_1.expect)(claim.basis?.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(claim.reliability?.level).toBe('high');
        (0, vitest_1.expect)(claim.caution).toMatch(/המערכת אינה מחליפה/);
        const banned = [/ברור/, /חד[-\s]?משמעי/, /אין ספק/];
        banned.forEach((pattern) => {
            (0, vitest_1.expect)(pattern.test(JSON.stringify(claim))).toBe(false);
        });
    });
});
