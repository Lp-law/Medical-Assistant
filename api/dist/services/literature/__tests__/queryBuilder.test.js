"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const queryBuilder_1 = require("../queryBuilder");
(0, vitest_1.describe)('literature query builder', () => {
    (0, vitest_1.it)('produces sanitized queries without long numeric segments or PHI', () => {
        const queries = (0, queryBuilder_1.buildLiteratureQueries)({
            claims: [
                { type: 'Orthopedic surgery', value: 'יד ימין 123456789' },
                { type: 'Neurology', value: 'בדיקת ראייה יוסי כהן' },
            ],
            timeline: [{ type: 'Hospitalization', description: 'ICU stay 2020 complications' }],
        });
        (0, vitest_1.expect)(queries.length).toBeGreaterThan(0);
        queries.forEach((query) => {
            (0, vitest_1.expect)(query).not.toMatch(/\d{4,}/);
            (0, vitest_1.expect)(query).toMatch(/^[a-z\s]+$/);
        });
    });
    (0, vitest_1.it)('limits to at most 8 focused queries', () => {
        const claims = Array.from({ length: 20 }).map((_, idx) => ({
            type: `Claim ${idx}`,
            value: `value ${idx}`,
            evidenceQuality: 'low',
        }));
        const queries = (0, queryBuilder_1.buildLiteratureQueries)({ claims, timeline: [] });
        (0, vitest_1.expect)(queries.length).toBeLessThanOrEqual(8);
    });
    (0, vitest_1.it)('prioritizes high evidence clinical findings', () => {
        const queries = (0, queryBuilder_1.buildLiteratureQueries)({
            claims: [
                { id: 'low', type: 'note', value: 'general comment', evidenceQuality: 'low' },
                { id: 'high', type: 'Diagnosis', value: 'septic arthritis knee', evidenceQuality: 'high' },
            ],
            timeline: [],
        });
        (0, vitest_1.expect)(queries.some((query) => query.includes('septic'))).toBe(true);
    });
});
