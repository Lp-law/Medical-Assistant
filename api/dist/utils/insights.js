"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildInsights = exports.deriveRules = exports.deriveTags = void 0;
const TAG_PATTERNS = [
    { label: 'כאב וסבל', regex: /כאב|סבל/i },
    { label: 'הפסד שכר', regex: /הפסד\s+שכר|אובדן\s+הכנסה/i },
    { label: 'אשפוז', regex: /אשפוז|אשפוזים|בית\s+חולים/i },
    { label: 'עזרת צד ג׳', regex: /עזרת\s+צד\s+ג/i },
    { label: 'הוצאות רפואיות', regex: /הוצאות\s+רפוא/i },
    { label: 'תוחלת חיים', regex: /תוחלת\s+חיים/i },
    { label: 'פנסיה', regex: /פנסיה|קצבה/i },
];
const deriveTags = (text) => {
    const tags = TAG_PATTERNS.filter(({ regex }) => regex.test(text)).map((pattern) => pattern.label);
    return Array.from(new Set(tags));
};
exports.deriveTags = deriveTags;
const deriveRules = (text) => {
    const lines = text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    const bulletRules = lines.filter((line) => /^(\d+\.|-|\*)\s+/.test(line));
    if (bulletRules.length >= 3)
        return bulletRules.slice(0, 6);
    const keywordRules = lines.filter((line) => /(יש\s+ל|חובה|נדרש|מומלץ|אסור)/.test(line) && line.length > 20 && line.length < 240);
    const combined = [...bulletRules, ...keywordRules];
    if (combined.length > 0)
        return combined.slice(0, 6);
    return lines.slice(0, 4);
};
exports.deriveRules = deriveRules;
const buildInsights = (text, tags) => {
    const confidence = tags.length > 3 ? 'High' : tags.length > 1 ? 'Medium' : 'Low';
    return [
        {
            title: 'תגיות עיקריות',
            content: tags.length ? tags.join(', ') : 'לא זוהו תגיות מפורשות',
            confidence,
        },
        {
            title: 'סיכום ראשוני',
            content: text.slice(0, 200),
            confidence: 'Medium',
        },
    ];
};
exports.buildInsights = buildInsights;
