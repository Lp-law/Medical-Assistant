import { OpenAIClient, AzureKeyCredential } from '@azure/openai';
import { config } from './env';

const { endpoint, apiKey, deployment } = config.openai;

let openAIClient: OpenAIClient | null = null;
if (endpoint && apiKey) {
  openAIClient = new OpenAIClient(endpoint, new AzureKeyCredential(apiKey));
}

interface ChapterMetadata {
  summary: string;
  title: string;
  tags: string[];
  rules: string[];
}

type SearchQueryPlan = {
  queries: string[];
};

const fallbackMetadata = (text: string): ChapterMetadata => {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const title = lines[0]?.slice(0, 120) ?? 'פרק חדש';
  const summary = text.slice(0, 1200);
  return {
    summary,
    title,
    tags: [],
    rules: [],
  };
};

export const generateChapterMetadata = async (text: string): Promise<ChapterMetadata> => {
  if (!openAIClient || !deployment) {
    return fallbackMetadata(text);
  }

  const prompt = [
    'נתון טקסט של פרק מספר תחשיבי נזק.',
    'אנא החזר JSON במבנה הבא:',
    '{ "title": "...", "summary": "...", "tags": ["..."], "rules": ["..."] }',
    'כל התשובות בעברית.',
    'טקסט:',
    text.slice(0, 8000),
  ].join('\n');

  const response = await openAIClient.getChatCompletions(deployment, [
    { role: 'system', content: 'אתה עוזר משפטי מומחה ברשלנות רפואית.' },
    { role: 'user', content: prompt },
  ]);

  const message = response.choices?.[0]?.message?.content ?? '';
  try {
    const parsed = JSON.parse(message) as ChapterMetadata;
    return {
      title: parsed.title || 'פרק חדש',
      summary: parsed.summary || text.slice(0, 1200),
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      rules: Array.isArray(parsed.rules) ? parsed.rules : [],
    };
  } catch (error) {
    console.warn('[openai] failed to parse response, falling back', error);
    return fallbackMetadata(text);
  }
};

const fallbackSearchQueries = (question: string): string[] => {
  // Very small heuristic fallback: split by common separators, keep meaningful tokens.
  const cleaned = question.replace(/[\"'”“]/g, '').trim();
  const parts = cleaned
    .split(/[\n,;\/|]+/g)
    .map((p) => p.trim())
    .filter(Boolean);

  const stop = new Set(['האם', 'מה', 'מי', 'מתי', 'איך', 'למה', 'אפשר', 'צריך', 'רלוונטי', 'של', 'על', 'עם', 'בלי']);
  const tokens = cleaned
    .split(/\s+/g)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !stop.has(t));

  const queries = Array.from(new Set([...parts, tokens.slice(0, 6).join(' ')].filter(Boolean)));
  return queries.slice(0, 5);
};

export const generateSearchQueries = async (question: string): Promise<string[]> => {
  const q = question.trim();
  if (!q) return [];

  if (!openAIClient || !deployment) {
    return fallbackSearchQueries(q);
  }

  const prompt = [
    'המטרה: להפוך שאלה של עורך דין לשאילתות חיפוש קצרות כדי למצוא מסמכים רלוונטיים במאגר ידע משרדי.',
    'החזר JSON בלבד במבנה:',
    '{ "queries": ["...","..."] }',
    'כל שאילתה קצרה (2–6 מילים), בעברית, ללא סימני ציטוט מיותרים.',
    'שאלה:',
    q.slice(0, 2000),
  ].join('\n');

  const response = await openAIClient.getChatCompletions(deployment, [
    { role: 'system', content: 'אתה עוזר חיפוש משפטי שממיר שאלות לשאילתות חיפוש למסמכים.' },
    { role: 'user', content: prompt },
  ]);

  const message = response.choices?.[0]?.message?.content ?? '';
  try {
    const parsed = JSON.parse(message) as SearchQueryPlan;
    const queries = Array.isArray(parsed.queries) ? parsed.queries.map((x) => String(x).trim()).filter(Boolean) : [];
    return queries.length ? Array.from(new Set(queries)).slice(0, 5) : fallbackSearchQueries(q);
  } catch (error) {
    console.warn('[openai] failed to parse search queries response, falling back', error);
    return fallbackSearchQueries(q);
  }
};

