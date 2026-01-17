"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidPdfUpload = void 0;
const PDF_MAGIC_BYTES = Buffer.from('%PDF', 'utf8');
const isValidPdfUpload = (file) => {
    if (!file) {
        return false;
    }
    const mimetypeAllowed = ['application/pdf', 'application/x-pdf', 'application/octet-stream'].includes(file.mimetype);
    if (!mimetypeAllowed) {
        return false;
    }
    const prefix = file.buffer.subarray(0, PDF_MAGIC_BYTES.length);
    return prefix.equals(PDF_MAGIC_BYTES);
};
exports.isValidPdfUpload = isValidPdfUpload;
