"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const strategySelector_1 = require("../strategySelector");
(0, vitest_1.describe)('ocr strategy selector', () => {
    (0, vitest_1.it)('forces enhanced when requested', () => {
        const strategy = (0, strategySelector_1.selectOcrStrategy)({ textSample: 'hello', pageCount: 1, fileSize: 1024, forceEnhanced: true });
        (0, vitest_1.expect)(strategy.mode).toBe('enhanced');
        (0, vitest_1.expect)(strategy.reason).toBe('force_enhanced');
    });
    (0, vitest_1.it)('detects scan-based pdf when density is low', () => {
        const strategy = (0, strategySelector_1.selectOcrStrategy)({ textSample: '', pageCount: 5, fileSize: 5 * 1024 * 1024, forceEnhanced: false });
        (0, vitest_1.expect)(strategy.mode).toBe('enhanced');
    });
    (0, vitest_1.it)('keeps base mode for dense textual pdf', () => {
        const text = 'Lorem ipsum dolor sit amet '.repeat(200);
        const strategy = (0, strategySelector_1.selectOcrStrategy)({ textSample: text, pageCount: 2, fileSize: 200 * 1024, forceEnhanced: false });
        (0, vitest_1.expect)(strategy.mode).toBe('base');
    });
});
