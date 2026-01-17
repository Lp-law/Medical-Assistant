import { AIInsight, AIReasoningResponse, BookChapter, CaseData, UncertaintyLevel } from '../types';

const buildPrompt = (caseData: CaseData, query: string): string => {
  return [
    `Case: ${caseData.name}`,
    `Summary: ${caseData.summary.slice(0, 400)}`,
    `Liability Probability: ${caseData.liability.probability}%`,
    `Damages Heads: ${caseData.damages.heads.length}`,
    `Question: ${query}`,
  ].join('\n');
};

const mockLocalInsights = (caseData: CaseData, query: string): AIInsight[] => {
  const baseConfidence: AIInsight['confidence'] =
    caseData.liability.probability > 60 ? 'High' : caseData.liability.probability > 40 ? 'Medium' : 'Low';

  return [
    {
      title: 'Key Liability Factor',
      content: `התיק מושפע בעיקר מ-${caseData.liability.issues[0]?.title || 'הטענה המרכזית'} בהקשר לשאלה: ${query}`,
      confidence: baseConfidence,
    },
    {
      title: 'Damages Consideration',
      content: `פער השכר הנוכחי הוא ${caseData.damages.wagePreInjury - caseData.damages.wagePostInjury} ₪ לחודש.`,
      confidence: 'Medium',
    },
  ];
};

const CHAPTER_TAG_PATTERNS: { label: string; regex: RegExp }[] = [
  { label: 'כאב וסבל', regex: /כאב|סבל|סבל/i },
  { label: 'הפסד שכר', regex: /הפסד\s+שכר|אובדן\s+הכנסה|שכר/i },
  { label: 'אשפוז', regex: /אשפוז|בית\s+חולים|אשפוזים/i },
  { label: 'עזרת צד ג׳', regex: /עזרת\s+צד\s+ג/i },
  { label: 'הוצאות רפואיות', regex: /הוצאות\s+רפוא/i },
  { label: 'תוחלת חיים', regex: /תוחלת\s+חיים|אורך\s+חיים/i },
  { label: 'פנסיה', regex: /פנסיה|קצבה/i },
];

const deriveTagsFromText = (text: string): string[] => {
  const detected = CHAPTER_TAG_PATTERNS.filter(({ regex }) => regex.test(text)).map((pattern) => pattern.label);
  return Array.from(new Set(detected));
};

const deriveRulesFromText = (text: string): string[] => {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const bulletRules = lines.filter((line) => /^(\d+\.|-|\*)\s+/.test(line));
  if (bulletRules.length >= 3) return bulletRules.slice(0, 6);

  const keywordRules = lines.filter(
    (line) => /(יש\s+ל|חייב|חובה|מומלץ|נדרש)/.test(line) && line.length > 20 && line.length < 240
  );
  const combined = [...bulletRules, ...keywordRules];
  if (combined.length > 0) return combined.slice(0, 6);

  const sentences = text.split(/(?<=[.!?])\s+/).filter((sentence) => sentence.length > 30);
  return sentences.slice(0, 4);
};

const summarizeText = (text: string, maxChars = 3200): string => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars)}...`;
};

const buildChapterDraft = (text: string): Omit<BookChapter, 'id'> => {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const title = lines.find((line) => line.length > 6) ?? 'פרק חדש';
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim());
  const content = summarizeText(paragraphs.slice(0, 6).join('\n\n'));
  const tags = deriveTagsFromText(text);
  const rules = deriveRulesFromText(text);

  return {
    title,
    content,
    tags,
    rules,
  };
};

const insightFromChapter = (chapter: BookChapter): AIInsight[] => {
  const confidence: UncertaintyLevel = chapter.tags.length > 3 ? 'High' : chapter.tags.length > 1 ? 'Medium' : 'Low';
  return [
    {
      title: 'נושאים עיקריים',
      content: chapter.tags.length ? chapter.tags.join(', ') : 'לא זוהו תגיות ייחודיות מהטקסט.',
      confidence,
    },
    {
      title: 'כללים שנמצאו',
      content:
        chapter.rules.length > 0
          ? chapter.rules.slice(0, 3).join(' | ')
          : 'אין סעיפים מפורשים – מומלץ להשלים ידנית לאחר בדיקה.',
      confidence: 'Medium',
    },
  ];
};

export const generateHybridReasoning = async (caseData: CaseData, query: string): Promise<AIReasoningResponse> => {
  const prompt = buildPrompt(caseData, query);
  const insights = mockLocalInsights(caseData, query);
  return {
    summary: `${prompt}\n\n(סיכום אוטומטי טרם הועבר לשרת)`,
    insights,
    usedAzure: false,
    timestamp: new Date().toISOString(),
  };
};

export interface ChapterSynthesisResult {
  chapter: BookChapter;
  insights: AIInsight[];
  usedAzure: boolean;
}

export const synthesizeLegalChapter = async (text: string): Promise<ChapterSynthesisResult> => {
  const draft = buildChapterDraft(text);
  const chapter: BookChapter = {
    id: Date.now().toString(),
    ...draft,
  };

  const baseInsights = insightFromChapter(chapter);
  return { chapter, insights: baseInsights, usedAzure: false };
};

