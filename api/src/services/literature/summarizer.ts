import pdf from 'pdf-parse';
import { readFile } from 'fs/promises';

export interface LiteratureSummary {
  summary: string;
  keyFindings: string[];
  limitations: string[];
  bottomLine: string;
}

export interface SummaryResult {
  content: LiteratureSummary;
  quality: 'good' | 'partial' | 'failed';
  note: string;
}

const sentenceSplit = (text: string): string[] =>
  text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 20);

export const summarizePdf = async (filePath: string): Promise<SummaryResult> => {
  const buffer = await readFile(filePath);
  const parsed = await pdf(buffer);
  const sentences = sentenceSplit(parsed.text || '');
  const textLength = (parsed.text ?? '').trim().length;

  const summary = sentences.slice(0, 3).join(' ');
  const keyFindings = sentences.slice(3, 6);
  const limitations = sentences.slice(-3);
  const bottomLine = sentences[sentences.length - 1] ?? summary;

  let quality: SummaryResult['quality'] = 'good';
  let note = '';
  if (!textLength) {
    quality = 'failed';
    note = 'לא זוהה טקסט במסמך.';
  } else if (sentences.length < 5) {
    quality = 'partial';
    note = 'נמצאו פחות מחמש משפטים שימושיים.';
  }

  return {
    content: {
      summary: summary || 'לא נמצא תוכן רלוונטי במסמך.',
      keyFindings: keyFindings.length ? keyFindings : [bottomLine],
      limitations: limitations.length ? limitations : [],
      bottomLine,
    },
    quality,
    note,
  };
};

