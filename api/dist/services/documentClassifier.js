"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyText = void 0;
const topics_json_1 = __importDefault(require("../topics.json"));
const normalize = (value) => value.toLowerCase();
const uniqueStrings = (items) => Array.from(new Set(items.filter(Boolean)));
const DEFAULT_KEYWORDS = [
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
const classifyText = (text) => {
    const normalized = normalize(text ?? '');
    const configs = topics_json_1.default ?? [];
    const topics = [];
    const keywords = [];
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
exports.classifyText = classifyText;
