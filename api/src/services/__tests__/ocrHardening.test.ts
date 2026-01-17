import { describe, expect, it } from 'vitest';
import { applyOcrHardening, shouldTriggerOcrHardening } from '../ocrHardening';

describe('ocrHardening', () => {
  it('decides to trigger hardening for low score and flags', () => {
    const decision = shouldTriggerOcrHardening({
      ocrScore: 0.4,
      flags: [{ code: 'EVENT_WITHOUT_DATE' }, { code: 'EVENT_WITHOUT_DATE' }, { code: 'TIMELINE_TOO_GENERIC' }],
    });
    expect(decision).toBe(true);
  });

  it('cleans lexical map and prefers enhanced text', () => {
    const result = applyOcrHardening([
      { text: 'בדיקה  -  ' },
      { text: '   כללית  ' },
    ]);
    expect(result.improvedMap[0].text).toBe('בדיקה -');
    expect(result.passes.length).toBe(2);
  });
});

