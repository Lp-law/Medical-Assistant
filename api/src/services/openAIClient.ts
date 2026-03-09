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

  let response;
  try {
    response = await openAIClient.getChatCompletions(deployment, [
      { role: 'system', content: 'אתה עוזר משפטי מומחה ברשלנות רפואית.' },
      { role: 'user', content: prompt },
    ]);
  } catch (error) {
    console.warn('[openai] chapter metadata request failed, falling back', error);
    return fallbackMetadata(text);
  }

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

  let response;
  try {
    response = await openAIClient.getChatCompletions(deployment, [
      { role: 'system', content: 'אתה עוזר חיפוש משפטי שממיר שאלות לשאילתות חיפוש למסמכים.' },
      { role: 'user', content: prompt },
    ]);
  } catch (error) {
    console.warn('[openai] search queries request failed, falling back', error);
    return fallbackSearchQueries(q);
  }

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

// --- עוזר ספר "תחשיבי נזק": תשובות רק מתוך הספר + ציטוט פרק ---

const detectLanguage = (text: string): 'he' | 'en-GB' => {
  const hasHebrew = /[\u0590-\u05FF]/.test(text);
  const hasLatin = /[A-Za-z]/.test(text);
  if (hasLatin && !hasHebrew) return 'en-GB';
  return 'he';
};

const buildAssistantSystemPrompt = (lang: 'he' | 'en-GB'): string => {
  if (lang === 'en-GB') {
    return `You are a legal assistant specialised in the book "Damages Calculations". Answer ONLY from the provided context blocks.

Mandatory output format:
1) "Answer:" with 1–4 sentences.
2) "Sources:" with 1–5 bullet points.

Rules:
- Cite ONLY sources provided in the context blocks; do NOT invent sources.
- If there is not enough evidence in context, state that briefly in Answer and still include Sources from available context.
- Keep it concise and factual.`;
  }

  return `אתה עוזר מומחה לספר "תחשיבי נזק". תפקידך היחיד: לענות על שאלות המשתמש על בסיס הקטעים שסופקו.

פורמט פלט מחייב:
1) "תשובה:" עם 1–4 משפטים.
2) "מקורות:" עם 1–5 נקודות bullet.

כללים:
- צטט אך ורק מקורות שמופיעים ב-context blocks; אל תמציא מקורות.
- אם אין מספיק מידע, כתוב זאת בקצרה תחת "תשובה:" ועדיין הוסף "מקורות:" מתוך ההקשר הקיים.
- כתוב בקצרה, בצורה ברורה ועובדתית.`;
};

export interface AssistantContextBlock {
  title: string;
  bookName?: string | null;
  bookChapter?: string | null;
  contentSnippet: string;
}

export const generateAssistantAnswer = async (
  question: string,
  contextBlocks: AssistantContextBlock[],
): Promise<string> => {
  const language = detectLanguage(question);
  const headingAnswer = language === 'en-GB' ? 'Answer:' : 'תשובה:';
  const headingSources = language === 'en-GB' ? 'Sources:' : 'מקורות:';

  if (!openAIClient || !deployment) {
    if (contextBlocks.length === 0) {
      return language === 'en-GB'
        ? 'Answer: The requested information does not appear in the provided book excerpts.\n\nSources:\n- No matching source was found.'
        : 'תשובה: המידע המבוקש לא מופיע בקטעים מהספר שסופקו.\n\nמקורות:\n- לא נמצא מקור תואם.';
    }
    const fallbackSource = [contextBlocks[0].bookName, contextBlocks[0].bookChapter, contextBlocks[0].title]
      .filter(Boolean)
      .join(' — ');
    return `${headingAnswer} ${contextBlocks[0].contentSnippet.slice(0, 600)}\n\n${headingSources}\n- ${
      fallbackSource || contextBlocks[0].title
    }`;
  }

  const contextText = contextBlocks
    .map((b) => {
      const header = [b.bookName, b.bookChapter, b.title].filter(Boolean).join(' — ');
      return header ? `[${header}]\n${b.contentSnippet}` : b.contentSnippet;
    })
    .join('\n\n---\n\n');

  const userMessage =
    `קטעים רלוונטיים מהספר:\n\n${contextText.slice(0, 28000)}\n\n---\n\nשאלת המשתמש: ${question.trim().slice(0, 2000)}\n\nענה אך ורק על סמך הקטעים למעלה, ציין פרק (ועמוד אם רלוונטי).`.trim();

  let response;
  try {
    response = await openAIClient.getChatCompletions(deployment, [
      { role: 'system', content: buildAssistantSystemPrompt(language) },
      { role: 'user', content: userMessage },
    ]);
  } catch (error) {
    console.warn('[openai] assistant answer request failed, using fallback', error);
    if (contextBlocks.length === 0) {
      return language === 'en-GB'
        ? 'Answer: Not enough information was found in the provided excerpts.\n\nSources:\n- No matching source was found.'
        : 'תשובה: לא נמצא מספיק מידע בקטעים שסופקו.\n\nמקורות:\n- לא נמצא מקור תואם.';
    }
    const fallbackSources = contextBlocks.slice(0, 5).map((b) => [b.bookName, b.bookChapter, b.title].filter(Boolean).join(' — '));
    return `${headingAnswer} ${contextBlocks[0].contentSnippet.slice(0, 600)}\n\n${headingSources}\n${fallbackSources
      .map((s) => `- ${s}`)
      .join('\n')}`;
  }

  const answer = response.choices?.[0]?.message?.content?.trim() ?? '';
  const hasSourcesHeading = language === 'en-GB' ? /(?:^|\n)Sources:/i.test(answer) : /(?:^|\n)מקורות:/.test(answer);
  if (!answer) {
    return language === 'en-GB'
      ? 'Answer: No answer was generated.\n\nSources:\n- No matching source was found.'
      : 'תשובה: לא התקבלה תשובה מהמערכת.\n\nמקורות:\n- לא נמצא מקור תואם.';
  }
  if (hasSourcesHeading) {
    return answer;
  }
  const fallbackSources = contextBlocks
    .slice(0, 5)
    .map((b) => [b.bookName, b.bookChapter, b.title].filter(Boolean).join(' — '))
    .filter(Boolean);
  const sourcesBlock = fallbackSources.length
    ? fallbackSources.map((s) => `- ${s}`).join('\n')
    : language === 'en-GB'
      ? '- No matching source was found.'
      : '- לא נמצא מקור תואם.';
  return `${answer}\n\n${headingSources}\n${sourcesBlock}`;
};

