"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const ocrHardening_1 = require("../ocrHardening");
(0, vitest_1.describe)('ocrHardening', () => {
    (0, vitest_1.it)('decides to trigger hardening for low score and flags', () => {
        const decision = (0, ocrHardening_1.shouldTriggerOcrHardening)({
            ocrScore: 0.4,
            flags: [{ code: 'EVENT_WITHOUT_DATE' }, { code: 'EVENT_WITHOUT_DATE' }, { code: 'TIMELINE_TOO_GENERIC' }],
        });
        (0, vitest_1.expect)(decision).toBe(true);
    });
    (0, vitest_1.it)('cleans lexical map and prefers enhanced text', () => {
        const result = (0, ocrHardening_1.applyOcrHardening)([
            { text: 'בדיקה  -  ' },
            { text: '   כללית  ' },
        ]);
        (0, vitest_1.expect)(result.improvedMap[0].text).toBe('בדיקה -');
        (0, vitest_1.expect)(result.passes.length).toBe(2);
    });
});
