export interface OcrMetrics {
  score: number;
  reasons: string[];
}

export const computeOcrMetrics = (text: string): OcrMetrics => {
  const clean = text?.replace(/\r/g, '') ?? '';
  const charCount = clean.length || 1;
  const lines = clean.split('\n').map((line) => line.trim());

  const asciiChars = clean.replace(/[^\x20-\x7E]/g, '').length;
  const weirdRatio = 1 - asciiChars / charCount;

  const shortLines = lines.filter((line) => line.length > 0 && line.length < 10).length;
  const shortLineRatio = lines.length ? shortLines / lines.length : 0;

  const digitCount = clean.replace(/[^0-9]/g, '').length;
  const digitRatio = digitCount / charCount;

  let score = 1;
  const reasons: string[] = [];

  if (weirdRatio > 0.2) {
    score -= 0.3;
    reasons.push('מכיל כמות גבוהה של תווים חריגים');
  }
  if (shortLineRatio > 0.4) {
    score -= 0.2;
    reasons.push('שורות רבות קצרות ולא קריאות');
  }
  if (digitRatio > 0.4) {
    score -= 0.1;
    reasons.push('יחס ספרות/אותיות גבוה');
  }
  if (clean.length < 200) {
    score -= 0.2;
    reasons.push('טקסט קצר במיוחד');
  }

  score = Math.max(0, Math.min(1, score));
  return { score, reasons };
};

