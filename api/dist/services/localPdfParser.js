"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTextLocally = void 0;
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const extractTextLocally = async (buffer) => {
    try {
        const data = await (0, pdf_parse_1.default)(buffer);
        if (!data.text)
            return '';
        return data.text.replace(/\s+/g, ' ').trim();
    }
    catch (error) {
        console.warn('[localPdfParser] failed to parse PDF locally:', error);
        return '';
    }
};
exports.extractTextLocally = extractTextLocally;
