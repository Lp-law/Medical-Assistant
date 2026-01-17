import '../ocr/canvasSetup';
import pdfParse from 'pdf-parse';
import { PDFDocument } from 'pdf-lib';
import { analyzeWithAzureOcr } from '../ocrClient';
import { selectOcrStrategy, OcrMode } from './strategySelector';
import { renderPdfPages } from './pdfRenderer';
import { preprocessImage } from './preprocessImage';
import { computeOcrMetrics, OcrMetrics } from './metrics';

interface RunOcrOptions {
  forceEnhanced?: boolean;
  azureClient?: typeof analyzeWithAzureOcr;
  pdfParser?: (data: Buffer) => Promise<{ text?: string; numpages?: number }>;
}

interface OcrPipelineResult {
  text: string;
  mode: OcrMode;
  metrics: OcrMetrics;
  pageCount: number;
  comparison: {
    baseScore: number;
    enhancedScore?: number;
  };
}

const buildPdfFromImages = async (buffers: Buffer[]): Promise<Buffer> => {
  const pdfDoc = await PDFDocument.create();
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

interface EnhancedPassResult {
  selected: { text: string; metrics: OcrMetrics; mode: OcrMode };
  baseMetrics: OcrMetrics;
  enhancedMetrics: OcrMetrics;
}

const runEnhancedPasses = async (
  buffer: Buffer,
  azureClient: typeof analyzeWithAzureOcr,
): Promise<EnhancedPassResult> => {
  const baseText = await azureClient(buffer);
  const baseMetrics = computeOcrMetrics(baseText);

  const renderedPages = await renderPdfPages(buffer, 300);
  const processedImages = await Promise.all(renderedPages.map((page) => preprocessImage(page.pngBuffer)));
  const rebuiltPdf = await buildPdfFromImages(processedImages);
  const enhancedText = await azureClient(rebuiltPdf);
  const enhancedMetrics = computeOcrMetrics(enhancedText);

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

export const runOcrPipeline = async (buffer: Buffer, options?: RunOcrOptions): Promise<OcrPipelineResult> => {
  const parser = options?.pdfParser ?? pdfParse;
  const pdfData = await parser(buffer);
  const baseText = (pdfData.text ?? '').trim();
  const baseParseMetrics = computeOcrMetrics(baseText);
  const strategy = selectOcrStrategy({
    textSample: baseText,
    pageCount: pdfData.numpages ?? 1,
    fileSize: buffer.length,
    forceEnhanced: options?.forceEnhanced,
  });

  const azureClient = options?.azureClient ?? analyzeWithAzureOcr;
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

