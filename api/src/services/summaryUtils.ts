const stripQuotedReplies = (text: string): string => {
  const lines = (text ?? '').split(/\r?\n/);
  const cleaned: string[] = [];
  for (const line of lines) {
    // stop at common reply separators
    if (/^From:\s/i.test(line) || /^On .* wrote:/i.test(line) || /^-{2,}\s*Original Message\s*-{2,}/i.test(line)) {
      break;
    }
    cleaned.push(line);
  }
  return cleaned.join('\n');
};

const normalizeWhitespace = (text: string): string => text.replace(/\s+/g, ' ').trim();

const normalizeMultiline = (text: string): string => {
  const raw = (text ?? '').toString().replace(/\r/g, '');
  // Trim each line but keep line breaks; collapse excessive blank lines.
  const lines = raw.split('\n').map((l) => l.replace(/[ \t]{2,}/g, ' ').trimEnd());
  return lines.join('\n').replace(/\n{4,}/g, '\n\n\n').trim();
};

export const extractSummaryFromEmailBody = (bodyText: string): string => {
  const base = stripQuotedReplies(bodyText ?? '');
  const normalized = normalizeMultiline(base);
  if (!normalized) return '';

  // Prefer explicit markers if present
  const markerMatch = normalized.match(/(?:תמצית|סיכום)\s*:\s*([\s\S]{20,800})/);
  if (markerMatch?.[1]) {
    const candidate = markerMatch[1].split(/\n{2,}/)[0] ?? markerMatch[1];
    // Keep it readable but don't overly truncate; the UI can show it in a modal.
    return normalizeWhitespace(candidate).slice(0, 8000);
  }

  // Otherwise return the full (de-quoted) email body, capped for safety.
  return normalized.slice(0, 20000);
};

const splitSentences = (text: string): string[] => {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return [];
  // Simple heuristic: split on sentence punctuation (Hebrew/English)
  return normalized.split(/(?<=[\.\!\?]|[״”])\s+/).map((s) => s.trim()).filter(Boolean);
};

export const summarizeFromText = (text: string, sentenceCount = 4): string => {
  const sentences = splitSentences(text);
  if (!sentences.length) return '';
  return sentences.slice(0, Math.min(Math.max(sentenceCount, 3), 5)).join(' ').slice(0, 1600);
};


