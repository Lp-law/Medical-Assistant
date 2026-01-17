"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectOcrStrategy = void 0;
const selectOcrStrategy = ({ textSample, pageCount, fileSize, forceEnhanced }) => {
    if (forceEnhanced) {
        return {
            mode: 'enhanced',
            reason: 'force_enhanced',
            metrics: { density: 0, weirdRatio: 0 },
        };
    }
    const normalizedText = textSample?.trim() ?? '';
    const pages = Math.max(1, pageCount);
    const density = normalizedText.length / pages;
    const weirdChars = normalizedText.match(/[^\x20-\x7E]/g)?.length ?? 0;
    const weirdRatio = normalizedText.length ? weirdChars / normalizedText.length : 1;
    const sizeMB = fileSize / (1024 * 1024);
    if (density < 350 || weirdRatio > 0.25 || sizeMB > 8) {
        return {
            mode: 'enhanced',
            reason: 'low_density_or_noisy',
            metrics: { density, weirdRatio },
        };
    }
    return {
        mode: 'base',
        reason: 'textual_pdf',
        metrics: { density, weirdRatio },
    };
};
exports.selectOcrStrategy = selectOcrStrategy;
