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

