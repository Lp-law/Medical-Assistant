"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadPdf = exports.ensureDownloadDir = void 0;
const promises_1 = require("fs/promises");
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
const promises_2 = require("stream/promises");
const downloadsRoot = path_1.default.resolve(process.cwd(), '..', 'downloads', 'literature');
const ensureDownloadDir = async (knowledgeId) => {
    const target = path_1.default.join(downloadsRoot, knowledgeId);
    await (0, promises_1.mkdir)(target, { recursive: true });
    return target;
};
exports.ensureDownloadDir = ensureDownloadDir;
const downloadPdf = async (knowledgeId, resourceId, url) => {
    const dir = await (0, exports.ensureDownloadDir)(knowledgeId);
    const filePath = path_1.default.join(dir, `${resourceId}.pdf`);
    const response = await fetch(url);
    if (!response.ok || !response.body) {
        throw new Error(`download_failed:${response.status}`);
    }
    await (0, promises_2.pipeline)(response.body, (0, fs_1.createWriteStream)(filePath));
    return filePath;
};
exports.downloadPdf = downloadPdf;
