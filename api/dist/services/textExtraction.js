"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTextFromAttachment = void 0;
const path_1 = __importDefault(require("path"));
const mammoth_1 = __importDefault(require("mammoth"));
const localPdfParser_1 = require("./localPdfParser");
const isPdf = (filename, mimeType) => {
    const ext = path_1.default.extname(filename).toLowerCase();
    return mimeType === 'application/pdf' || ext === '.pdf';
};
const isDocx = (filename, mimeType) => {
    const ext = path_1.default.extname(filename).toLowerCase();
    return (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        ext === '.docx');
};
const extractTextFromAttachment = async (buffer, filename, mimeType) => {
    if (isPdf(filename, mimeType)) {
        return await (0, localPdfParser_1.extractTextLocally)(buffer);
    }
    if (isDocx(filename, mimeType)) {
        try {
            const result = await mammoth_1.default.extractRawText({ buffer });
            return (result.value ?? '').replace(/\s+/g, ' ').trim();
        }
        catch (error) {
            console.warn('[textExtraction] failed to parse docx:', error);
            return '';
        }
    }
    // Legacy .doc is not supported without external converters.
    return '';
};
exports.extractTextFromAttachment = extractTextFromAttachment;
