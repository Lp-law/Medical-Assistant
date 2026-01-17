"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const timelineBuilder_1 = require("../timelineBuilder");
(0, vitest_1.describe)('timelineBuilder', () => {
    (0, vitest_1.it)('groups close events and emits gap/dense flags', () => {
        const result = (0, timelineBuilder_1.buildTimelineFromClaims)([
            { id: '1', type: 'Exam', value: 'בדיקה 2020-01-01', date: '2020-01-01' },
            { id: '2', type: 'Exam', value: 'בדיקה 2020-01-05', date: '2020-01-05' },
            { id: '3', type: 'Exam', value: 'בדיקה 2020-01-10', date: '2020-01-10' },
            { id: '4', type: 'Exam', value: 'בדיקה 2020-01-15', date: '2020-01-15' },
            { id: '5', type: 'Surgery', value: 'ניתוח 2021-08-01', date: '2021-08-01' },
            { id: '6', type: 'Unknown', value: 'ללא תאריך' },
        ]);
        (0, vitest_1.expect)(result.events[0].aggregatedCount).toBeGreaterThan(1);
        (0, vitest_1.expect)(result.events[0].datePrecision).toBe('day');
        (0, vitest_1.expect)(result.flags.some((flag) => flag.code === 'TIMELINE_GAP')).toBe(true);
        (0, vitest_1.expect)(result.flags.some((flag) => flag.code === 'DENSE_PERIOD')).toBe(true);
    });
    (0, vitest_1.it)('parses partial dates with precision', () => {
        const result = (0, timelineBuilder_1.buildTimelineFromClaims)([
            { id: 'a', type: 'Exam', value: 'בדיקה ב-2020-05' },
            { id: 'b', type: 'Exam', value: 'בדיקה בשנת 2019' },
        ]);
        (0, vitest_1.expect)(result.events.some((event) => event.datePrecision === 'month')).toBe(true);
        (0, vitest_1.expect)(result.events.some((event) => event.datePrecision === 'year')).toBe(true);
    });
    (0, vitest_1.it)('hides generic events and links them as references', () => {
        const result = (0, timelineBuilder_1.buildTimelineFromClaims)([
            { id: 'g1', type: 'Note', value: 'אירוע', date: '2020-02-01' },
            { id: 'p1', type: 'Surgery', value: 'ניתוח ברך', date: '2020-02-03' },
        ]);
        const hiddenEvent = result.events.find((event) => event.hidden);
        const visibleEvent = result.events.find((event) => !event.hidden);
        (0, vitest_1.expect)(hiddenEvent).toBeDefined();
        (0, vitest_1.expect)(visibleEvent?.references?.length).toBeGreaterThan(1);
    });
    (0, vitest_1.it)('detects medication and imaging event types', () => {
        const result = (0, timelineBuilder_1.buildTimelineFromClaims)([
            { id: 'm1', type: 'Note', value: 'טיפול תרופתי אנטיביוטיקה פומית', date: '2020-03-01' },
            { id: 'i1', type: 'Note', value: 'MRI עמוד שדרה צווארי', date: '2020-03-02' },
        ]);
        (0, vitest_1.expect)(result.events.some((event) => event.type === 'MEDICATION')).toBe(true);
        (0, vitest_1.expect)(result.events.some((event) => event.type === 'IMAGING')).toBe(true);
    });
});
