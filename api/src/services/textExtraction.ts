import path from 'path';
import mammoth from 'mammoth';
import { extractTextLocally } from './localPdfParser';
import { config } from './env';
import { runOcrPipeline } from './ocr/ocrPipeline';

const isPdf = (filename: string, mimeType?: string): boolean => {
  const ext = path.extname(filename).toLowerCase();
  return mimeType === 'application/pdf' || ext === '.pdf';
};

const isDocx = (filename: string, mimeType?: string): boolean => {
  const ext = path.extname(filename).toLowerCase();
  return (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === '.docx'
  );
};

export const extractTextFromAttachment = async (
  buffer: Buffer,
  filename: string,
  mimeType?: string,
): Promise<string> => {
  if (isPdf(filename, mimeType)) {
    const local = await extractTextLocally(buffer);
    if (local && local.length >= 200) {
      return local;
    }

    // Fallback to Azure OCR pipeline when configured (helps for scanned PDFs / image-only pages).
    if (config.ocr.endpoint && config.ocr.key) {
      try {
        const ocr = await runOcrPipeline(buffer);
        return (ocr.text ?? '').replace(/\s+/g, ' ').trim();
      } catch (error) {
        console.warn('[textExtraction] OCR fallback failed:', error);
      }
    }

    return local ?? '';
  }

  if (isDocx(filename, mimeType)) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return (result.value ?? '').replace(/\s+/g, ' ').trim();
    } catch (error) {
      console.warn('[textExtraction] failed to parse docx:', error);
      return '';
    }
  }

  // Legacy .doc is not supported without external converters.
  return '';
};


