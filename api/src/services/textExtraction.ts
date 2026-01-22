import path from 'path';
import mammoth from 'mammoth';
import { extractTextLocally } from './localPdfParser';

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
    return await extractTextLocally(buffer);
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


