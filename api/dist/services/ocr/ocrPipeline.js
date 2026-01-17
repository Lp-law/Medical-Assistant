"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runOcrPipeline = void 0;
require("../ocr/canvasSetup");
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const pdf_lib_1 = require("pdf-lib");
const ocrClient_1 = require("../ocrClient");
const strategySelector_1 = require("./strategySelector");
const pdfRenderer_1 = require("./pdfRenderer");
const preprocessImage_1 = require("./preprocessImage");
const metrics_1 = require("./metrics");
const buildPdfFromImages = async (buffers) => {
    const pdfDoc = await pdf_lib_1.PDFDocument.create();
    for (const buffer of buffers) {
        const pngImage = await pdfDoc.embedPng(buffer);
        const page = pdfDoc.addPage([pngImage.width, pngImage.height]);
        page.drawImage(pngImage, {
            x: 0,
            y: 0,
            width: pngImage.width,
            height: pngImage.height,
        });
    }
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
};
const runEnhancedPasses = async (buffer, azureClient) => {
    const baseText = await azureClient(buffer);
    const baseMetrics = (0, metrics_1.computeOcrMetrics)(baseText);
    const renderedPages = await (0, pdfRenderer_1.renderPdfPages)(buffer, 300);
    const processedImages = await Promise.all(renderedPages.map((page) => (0, preprocessImage_1.preprocessImage)(page.pngBuffer)));
    const rebuiltPdf = await buildPdfFromImages(processedImages);
    const enhancedText = await azureClient(rebuiltPdf);
    const enhancedMetrics = (0, metrics_1.computeOcrMetrics)(enhancedText);
    if (enhancedMetrics.score >= baseMetrics.score) {
        return {
            selected: { text: enhancedText, metrics: enhancedMetrics, mode: 'enhanced' },
            baseMetrics,
            enhancedMetrics,
        };
    }
    return {
        selected: { text: baseText, metrics: baseMetrics, mode: 'base' },
        baseMetrics,
        enhancedMetrics,
    };
};
const runOcrPipeline = async (buffer, options) => {
    const parser = options?.pdfParser ?? pdf_parse_1.default;
    const pdfData = await parser(buffer);
    const baseText = (pdfData.text ?? '').trim();
    const baseParseMetrics = (0, metrics_1.computeOcrMetrics)(baseText);
    const strategy = (0, strategySelector_1.selectOcrStrategy)({
        textSample: baseText,
        pageCount: pdfData.numpages ?? 1,
        fileSize: buffer.length,
        forceEnhanced: options?.forceEnhanced,
    });
    const azureClient = options?.azureClient ?? ocrClient_1.analyzeWithAzureOcr;
    const pageCount = pdfData.numpages ?? 1;
    if (strategy.mode === 'base' && baseText.length > 200) {
        return {
            text: baseText,
            mode: 'base',
            metrics: baseParseMetrics,
            pageCount,
            comparison: {
                baseScore: baseParseMetrics.score,
            },
        };
    }
    const enhancedResult = await runEnhancedPasses(buffer, azureClient);
    if (enhancedResult.selected.mode === 'enhanced') {
        return {
            text: enhancedResult.selected.text,
            mode: 'enhanced',
            metrics: enhancedResult.selected.metrics,
            pageCount,
            comparison: {
                baseScore: enhancedResult.baseMetrics.score,
                enhancedScore: enhancedResult.enhancedMetrics.score,
            },
        };
    }
    if (baseText.length) {
        return {
            text: baseText,
            mode: 'base',
            metrics: baseParseMetrics,
            pageCount,
            comparison: {
                baseScore: baseParseMetrics.score,
                enhancedScore: enhancedResult.enhancedMetrics.score,
            },
        };
    }
    return {
        text: enhancedResult.selected.text,
        mode: 'base',
        metrics: enhancedResult.selected.metrics,
        pageCount,
        comparison: {
            baseScore: enhancedResult.baseMetrics.score,
            enhancedScore: enhancedResult.enhancedMetrics.score,
        },
    };
};
exports.runOcrPipeline = runOcrPipeline;
