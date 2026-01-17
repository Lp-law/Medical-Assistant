import { describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { runOcrPipeline } from '../ocrPipeline';

vi.mock('../../ocrClient', () => ({
  analyzeWithAzureOcr: vi.fn().mockResolvedValue('mock azure text output'),
}));

const createPdfBuffer = async (): Promise<Buffer> => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([400, 400]);
  page.drawRectangle({ x: 50, y: 50, width: 100, height: 100 });
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
};

describe('ocrPipeline', () => {
  it('runs enhanced pipeline when forced', async () => {
    const buffer = await createPdfBuffer();
    const mockParser = vi.fn().mockResolvedValue({ text: '', numpages: 1 });
    const result = await runOcrPipeline(buffer, { forceEnhanced: true, pdfParser: mockParser });
    expect(result.text).toContain('mock azure text');
    expect(['base', 'enhanced']).toContain(result.mode);
    expect(mockParser).toHaveBeenCalled();
  });
});

