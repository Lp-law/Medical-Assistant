"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orchestrateIngestion = void 0;
const uuid_1 = require("uuid");
const storageClient_1 = require("./storageClient");
const ocrPipeline_1 = require("./ocr/ocrPipeline");
const openAIClient_1 = require("./openAIClient");
const searchIndexer_1 = require("./searchIndexer");
const insights_1 = require("../utils/insights");
const orchestrateIngestion = async (request) => {
    const docId = (0, uuid_1.v4)();
    const uploadedUrl = await (0, storageClient_1.uploadPdfToStorage)(request.buffer, request.originalName, request.mimeType);
    const ocrResult = await (0, ocrPipeline_1.runOcrPipeline)(request.buffer, { forceEnhanced: request.forceEnhancedOcr });
    const text = ocrResult.text;
    if (!text) {
        throw new Error('text-extraction-failed');
    }
    const autoTags = (0, insights_1.deriveTags)(text);
    const combinedTags = Array.from(new Set([...(request.tags ?? []), ...autoTags]));
    const rules = (0, insights_1.deriveRules)(text);
    const metadata = await (0, openAIClient_1.generateChapterMetadata)(text);
    const insights = (0, insights_1.buildInsights)(metadata.summary, combinedTags);
    const indexedDoc = {
        title: metadata.title,
        summary: metadata.summary,
        content: text,
        tags: combinedTags,
        ocrMode: ocrResult.mode,
        score: {
            value: ocrResult.metrics.score,
            breakdown: {
                ocr: {
                    value: ocrResult.metrics.score,
                    reasons: ocrResult.metrics.reasons,
                    mode: ocrResult.mode,
                },
            },
        },
        rules,
        docType: request.docType,
        sourceFile: request.originalName,
        sourceUrl: uploadedUrl,
        metadata: {
            ...request.metadata,
            size: request.size,
            ocrComparison: ocrResult.comparison,
        },
        createdAt: new Date().toISOString(),
    };
    const searchableDoc = {
        id: docId,
        ...indexedDoc,
    };
    await (0, searchIndexer_1.pushDocumentToSearch)(searchableDoc);
    return {
        id: docId,
        ...indexedDoc,
        insights,
    };
};
exports.orchestrateIngestion = orchestrateIngestion;
