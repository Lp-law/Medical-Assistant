"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizePdf = void 0;
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const promises_1 = require("fs/promises");
const sentenceSplit = (text) => text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 20);
const summarizePdf = async (filePath) => {
    const buffer = await (0, promises_1.readFile)(filePath);
    const parsed = await (0, pdf_parse_1.default)(buffer);
    const sentences = sentenceSplit(parsed.text || '');
    const textLength = (parsed.text ?? '').trim().length;
    const summary = sentences.slice(0, 3).join(' ');
    const keyFindings = sentences.slice(3, 6);
    const limitations = sentences.slice(-3);
    const bottomLine = sentences[sentences.length - 1] ?? summary;
    let quality = 'good';
    let note = '';
    if (!textLength) {
        quality = 'failed';
        note = 'לא זוהה טקסט במסמך.';
    }
    else if (sentences.length < 5) {
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
exports.summarizePdf = summarizePdf;
