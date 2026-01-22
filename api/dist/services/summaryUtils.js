"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizeFromText = exports.extractSummaryFromEmailBody = void 0;
const stripQuotedReplies = (text) => {
    const lines = (text ?? '').split(/\r?\n/);
    const cleaned = [];
    for (const line of lines) {
        // stop at common reply separators
        if (/^From:\s/i.test(line) || /^On .* wrote:/i.test(line) || /^-{2,}\s*Original Message\s*-{2,}/i.test(line)) {
            break;
        }
        cleaned.push(line);
    }
    return cleaned.join('\n');
};
const normalizeWhitespace = (text) => text.replace(/\s+/g, ' ').trim();
const extractSummaryFromEmailBody = (bodyText) => {
    const base = stripQuotedReplies(bodyText ?? '');
    const normalized = base.replace(/\r/g, '').trim();
    if (!normalized)
        return '';
    // Prefer explicit markers if present
    const markerMatch = normalized.match(/(?:תמצית|סיכום)\s*:\s*([\s\S]{20,800})/);
    if (markerMatch?.[1]) {
        const candidate = markerMatch[1].split(/\n{2,}/)[0] ?? markerMatch[1];
        return normalizeWhitespace(candidate).slice(0, 1200);
    }
    // Otherwise take first paragraph-ish chunk
    const firstBlock = normalized.split(/\n{2,}/)[0] ?? normalized;
    return normalizeWhitespace(firstBlock).slice(0, 1200);
};
exports.extractSummaryFromEmailBody = extractSummaryFromEmailBody;
const splitSentences = (text) => {
    const normalized = normalizeWhitespace(text);
    if (!normalized)
        return [];
    // Simple heuristic: split on sentence punctuation (Hebrew/English)
    return normalized.split(/(?<=[\.\!\?]|[״”])\s+/).map((s) => s.trim()).filter(Boolean);
};
const summarizeFromText = (text, sentenceCount = 4) => {
    const sentences = splitSentences(text);
    if (!sentences.length)
        return '';
    return sentences.slice(0, Math.min(Math.max(sentenceCount, 3), 5)).join(' ').slice(0, 1600);
};
exports.summarizeFromText = summarizeFromText;
