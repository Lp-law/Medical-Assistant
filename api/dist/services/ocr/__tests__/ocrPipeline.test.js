"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const pdf_lib_1 = require("pdf-lib");
const ocrPipeline_1 = require("../ocrPipeline");
vitest_1.vi.mock('../../ocrClient', () => ({
    analyzeWithAzureOcr: vitest_1.vi.fn().mockResolvedValue('mock azure text output'),
}));
const createPdfBuffer = async () => {
    const pdfDoc = await pdf_lib_1.PDFDocument.create();
    const page = pdfDoc.addPage([400, 400]);
    page.drawRectangle({ x: 50, y: 50, width: 100, height: 100 });
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
};
(0, vitest_1.describe)('ocrPipeline', () => {
    (0, vitest_1.it)('runs enhanced pipeline when forced', async () => {
        const buffer = await createPdfBuffer();
        const mockParser = vitest_1.vi.fn().mockResolvedValue({ text: '', numpages: 1 });
        const result = await (0, ocrPipeline_1.runOcrPipeline)(buffer, { forceEnhanced: true, pdfParser: mockParser });
        (0, vitest_1.expect)(result.text).toContain('mock azure text');
        (0, vitest_1.expect)(['base', 'enhanced']).toContain(result.mode);
        (0, vitest_1.expect)(mockParser).toHaveBeenCalled();
    });
});
