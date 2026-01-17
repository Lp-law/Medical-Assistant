import { describe, expect, it } from 'vitest';
import { selectOcrStrategy } from '../strategySelector';

describe('ocr strategy selector', () => {
  it('forces enhanced when requested', () => {
    const strategy = selectOcrStrategy({ textSample: 'hello', pageCount: 1, fileSize: 1024, forceEnhanced: true });
    expect(strategy.mode).toBe('enhanced');
    expect(strategy.reason).toBe('force_enhanced');
  });

  it('detects scan-based pdf when density is low', () => {
    const strategy = selectOcrStrategy({ textSample: '', pageCount: 5, fileSize: 5 * 1024 * 1024, forceEnhanced: false });
    expect(strategy.mode).toBe('enhanced');
  });

  it('keeps base mode for dense textual pdf', () => {
    const text = 'Lorem ipsum dolor sit amet '.repeat(200);
    const strategy = selectOcrStrategy({ textSample: text, pageCount: 2, fileSize: 200 * 1024, forceEnhanced: false });
    expect(strategy.mode).toBe('base');
  });
});

