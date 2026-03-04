/**
 * Export for Word: builds HTML + optional chart PNG and copies to clipboard.
 * All logic is local; no server/LLM.
 */

import type { ExportPayload } from './exportForWordHtml';
import { buildWordHtml, buildWordPlainText } from './exportForWordHtml';
import { barChartToPngBlob } from './chartToPng';
import type { ExportLang } from './exportForWordI18n';
import { getLabels } from './exportForWordI18n';

export type ExportForWordOptions = {
  lang: ExportLang;
  includeChart: boolean;
  includeReductions: boolean;
  includeDefendants: boolean;
};

export type ExportForWordResult = {
  success: boolean;
  imageCopied?: boolean;
  fallbackMessage?: string;
};

/**
 * Copies table(s) HTML and optionally chart PNG to clipboard.
 * Word pastes HTML as formatted tables; PNG as image.
 */
export async function exportForWord(
  payload: ExportPayload,
  options: ExportForWordOptions
): Promise<ExportForWordResult> {
  const { lang, includeChart, includeReductions, includeDefendants } = options;
  const html = buildWordHtml(payload, {
    lang,
    includeReductions,
    includeDefendants,
  });
  const plain = buildWordPlainText(payload, {
    lang,
    includeReductions,
    includeDefendants,
  });

  const htmlBlob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const plainBlob = new Blob([plain], { type: 'text/plain;charset=utf-8' });

  if (includeChart) {
    const L = getLabels(lang);
    const chartData = {
      labels: [L.claimant, L.defendant, L.average] as [string, string, string],
      seriesBefore: [
        payload.totals.plaintiffNet,
        payload.totals.defendantNet,
        payload.totals.avgNet,
      ] as [number, number, number],
      seriesAfter: [
        payload.after.plaintiff.afterAll,
        payload.after.defendant.afterAll,
        payload.after.avg.afterAll,
      ] as [number, number, number],
    };
    try {
      const pngBlob = await barChartToPngBlob(chartData, lang);
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': plainBlob,
            'image/png': pngBlob,
          }),
        ]);
        return { success: true, imageCopied: true };
      } catch {
        // Multi-item paste failed (e.g. some browsers); fallback to HTML only
        await navigator.clipboard.write([
          new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': plainBlob }),
        ]);
        return {
          success: true,
          imageCopied: false,
          fallbackMessage:
            lang === 'he'
              ? 'הועתקו הטבלאות. התרשים לא הועתק – הדבק את התרשים בנפרד או השתמש בייצוא DOCX.'
              : 'Tables copied. Chart was not copied – paste the chart separately or use DOCX export.',
        };
      }
    } catch (e) {
      await navigator.clipboard.write([
        new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': plainBlob }),
      ]);
      return {
        success: true,
        imageCopied: false,
        fallbackMessage:
          lang === 'he'
            ? 'הועתקו הטבלאות. יצירת התרשים נכשלה.'
            : 'Tables copied. Chart generation failed.',
      };
    }
  }

  await navigator.clipboard.write([
    new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': plainBlob }),
  ]);
  return { success: true };
}
