export interface HardeningMetrics {
  ocrScore?: number;
  flags: Array<{ code?: string }>;
}

export interface LexicalLine {
  page?: number;
  lineNumber?: number;
  text: string;
}

export interface HardeningResult {
  improvedMap: LexicalLine[];
  chosenPass: 'base' | 'enhanced';
  passes: Array<{ mode: 'base' | 'enhanced'; textLength: number }>;
}

const CLEANUP_REGEX = /[\u200B-\u200D]/g;

export const shouldTriggerOcrHardening = ({ ocrScore, flags }: HardeningMetrics): boolean => {
  const eventWithoutDate = flags.filter((flag) => flag.code === 'EVENT_WITHOUT_DATE').length;
  const timelineGeneric = flags.filter((flag) => flag.code === 'TIMELINE_TOO_GENERIC').length;

  if (typeof ocrScore === 'number' && ocrScore < 0.55) return true;
  if (eventWithoutDate >= 3) return true;
  if (timelineGeneric >= 1 && eventWithoutDate >= 1) return true;
  return false;
};

const sanitizeLine = (text: string): string => {
  return text
    .replace(CLEANUP_REGEX, '')
    .replace(/-\s*\n\s*/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\t\r]+/g, ' ')
    .trim();
};

const buildTextFromMap = (map: LexicalLine[]): string => map.map((line) => line.text).join('\n');

export const applyOcrHardening = (map: LexicalLine[] = []): HardeningResult => {
  const baseMap = map.map((line) => ({ ...line, text: line.text ?? '' }));
  const enhancedMap = baseMap.map((line) => ({
    ...line,
    text: sanitizeLine(line.text ?? ''),
  }));

  const baseText = buildTextFromMap(baseMap);
  const enhancedText = buildTextFromMap(enhancedMap);
  const baseComparable = baseText.replace(/\s+/g, '');
  const enhancedComparable = enhancedText.replace(/\s+/g, '');

  const chosenPass = enhancedComparable.length >= baseComparable.length ? 'enhanced' : 'base';
  return {
    improvedMap: chosenPass === 'enhanced' ? enhancedMap : baseMap,
    chosenPass,
    passes: [
      { mode: 'base', textLength: baseText.length },
      { mode: 'enhanced', textLength: enhancedText.length },
    ],
  };
};

