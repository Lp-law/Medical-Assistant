"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderPdfPages = void 0;
require("./canvasSetup");
const canvas_1 = require("@napi-rs/canvas");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
pdfjsLib.GlobalWorkerOptions.workerSrc = require('pdfjs-dist/legacy/build/pdf.worker.js');
class NodeCanvasFactory {
    create(width, height) {
        const canvas = (0, canvas_1.createCanvas)(width, height);
        const context = canvas.getContext('2d');
        return { canvas, context };
    }
    reset(canvasAndContext, width, height) {
        canvasAndContext.canvas.width = width;
        canvasAndContext.canvas.height = height;
    }
    destroy(canvasAndContext) {
        canvasAndContext.canvas.width = 0;
        canvasAndContext.canvas.height = 0;
        canvasAndContext.canvas = null;
        canvasAndContext.context = null;
    }
}
const MAX_RENDER_PAGES = 10;
const renderPdfPages = async (buffer, dpi = 300) => {
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
    const pdfDocument = await loadingTask.promise;
    const pageCount = Math.min(pdfDocument.numPages, MAX_RENDER_PAGES);
    const scale = dpi / 72;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        const page = await pdfDocument.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        const canvasFactory = new NodeCanvasFactory();
        const { canvas, context } = canvasFactory.create(viewport.width, viewport.height);
        const renderContext = {
            canvasContext: context,
            viewport,
            canvasFactory,
        };
        await page.render(renderContext).promise;
        const pngBuffer = canvas.toBuffer('image/png');
        pages.push({ pageNumber, pngBuffer });
        canvasFactory.destroy({ canvas, context });
    }
    return pages;
};
exports.renderPdfPages = renderPdfPages;
