import { describe, expect, it } from 'vitest';
import { buildLiteratureQueries } from '../queryBuilder';

describe('literature query builder', () => {
  it('produces sanitized queries without long numeric segments or PHI', () => {
    const queries = buildLiteratureQueries({
      claims: [
        { type: 'Orthopedic surgery', value: 'יד ימין 123456789' },
        { type: 'Neurology', value: 'בדיקת ראייה יוסי כהן' },
      ],
      timeline: [{ type: 'Hospitalization', description: 'ICU stay 2020 complications' }],
    });

    expect(queries.length).toBeGreaterThan(0);
    queries.forEach((query) => {
      expect(query).not.toMatch(/\d{4,}/);
      expect(query).toMatch(/^[a-z\s]+$/);
    });
  });

  it('limits to at most 8 focused queries', () => {
    const claims = Array.from({ length: 20 }).map((_, idx) => ({
      type: `Claim ${idx}`,
      value: `value ${idx}`,
      evidenceQuality: 'low',
    }));
    const queries = buildLiteratureQueries({ claims, timeline: [] });
    expect(queries.length).toBeLessThanOrEqual(8);
  });

  it('prioritizes high evidence clinical findings', () => {
    const queries = buildLiteratureQueries({
      claims: [
        { id: 'low', type: 'note', value: 'general comment', evidenceQuality: 'low' },
        { id: 'high', type: 'Diagnosis', value: 'septic arthritis knee', evidenceQuality: 'high' },
      ],
      timeline: [],
    });

    expect(queries.some((query) => query.includes('septic'))).toBe(true);
  });
});

