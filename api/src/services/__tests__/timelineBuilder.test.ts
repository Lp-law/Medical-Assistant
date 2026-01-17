import { describe, expect, it } from 'vitest';
import { buildTimelineFromClaims } from '../timelineBuilder';

describe('timelineBuilder', () => {
  it('groups close events and emits gap/dense flags', () => {
    const result = buildTimelineFromClaims([
      { id: '1', type: 'Exam', value: 'בדיקה 2020-01-01', date: '2020-01-01' },
      { id: '2', type: 'Exam', value: 'בדיקה 2020-01-05', date: '2020-01-05' },
      { id: '3', type: 'Exam', value: 'בדיקה 2020-01-10', date: '2020-01-10' },
      { id: '4', type: 'Exam', value: 'בדיקה 2020-01-15', date: '2020-01-15' },
      { id: '5', type: 'Surgery', value: 'ניתוח 2021-08-01', date: '2021-08-01' },
      { id: '6', type: 'Unknown', value: 'ללא תאריך' },
    ]);

    expect(result.events[0].aggregatedCount).toBeGreaterThan(1);
    expect(result.events[0].datePrecision).toBe('day');
    expect(result.flags.some((flag) => flag.code === 'TIMELINE_GAP')).toBe(true);
    expect(result.flags.some((flag) => flag.code === 'DENSE_PERIOD')).toBe(true);
  });

  it('parses partial dates with precision', () => {
    const result = buildTimelineFromClaims([
      { id: 'a', type: 'Exam', value: 'בדיקה ב-2020-05' },
      { id: 'b', type: 'Exam', value: 'בדיקה בשנת 2019' },
    ]);

    expect(result.events.some((event) => event.datePrecision === 'month')).toBe(true);
    expect(result.events.some((event) => event.datePrecision === 'year')).toBe(true);
  });

  it('hides generic events and links them as references', () => {
    const result = buildTimelineFromClaims([
      { id: 'g1', type: 'Note', value: 'אירוע', date: '2020-02-01' },
      { id: 'p1', type: 'Surgery', value: 'ניתוח ברך', date: '2020-02-03' },
    ]);

    const hiddenEvent = result.events.find((event) => event.hidden);
    const visibleEvent = result.events.find((event) => !event.hidden);
    expect(hiddenEvent).toBeDefined();
    expect(visibleEvent?.references?.length).toBeGreaterThan(1);
  });

  it('detects medication and imaging event types', () => {
    const result = buildTimelineFromClaims([
      { id: 'm1', type: 'Note', value: 'טיפול תרופתי אנטיביוטיקה פומית', date: '2020-03-01' },
      { id: 'i1', type: 'Note', value: 'MRI עמוד שדרה צווארי', date: '2020-03-02' },
    ]);

    expect(result.events.some((event) => event.type === 'MEDICATION')).toBe(true);
    expect(result.events.some((event) => event.type === 'IMAGING')).toBe(true);
  });
});

