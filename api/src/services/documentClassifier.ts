import topicsData from '../topics.json';

type TopicConfig = { topic: string; phrases: string[] };

const normalize = (value: string): string => value.toLowerCase();

const uniqueStrings = (items: string[]): string[] => Array.from(new Set(items.filter(Boolean)));

const DEFAULT_KEYWORDS: string[] = [
  'הולדה בעוולה',
  'רשלנות בלידה',
  'נזק מוחי',
  'לחץ דם גבוה',
  'אבחון שגוי',
  'תיקון כתב תביעה',
  'כתב תביעה',
  'חוות דעת',
  'תחשיב נזק',
  'סיכום',
];

export interface ClassificationResult {
  topics: string[];
  keywords: string[];
}

export const classifyText = (text: string): ClassificationResult => {
  const normalized = normalize(text ?? '');
  const configs = (topicsData as TopicConfig[]) ?? [];

  const topics: string[] = [];
  const keywords: string[] = [];

  for (const cfg of configs) {
    const phrases = Array.isArray(cfg.phrases) ? cfg.phrases : [];
    const matchedPhrase = phrases.find((phrase) => phrase && normalized.includes(normalize(phrase)));
    if (matchedPhrase) {
      topics.push(cfg.topic);
      keywords.push(matchedPhrase);
    }
  }

  for (const kw of DEFAULT_KEYWORDS) {
    if (kw && normalized.includes(normalize(kw))) {
      keywords.push(kw);
    }
  }

  return {
    topics: uniqueStrings(topics),
    keywords: uniqueStrings(keywords),
  };
};


