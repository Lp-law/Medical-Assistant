/**
 * Export three scenarios to Word: HTML table + chart PNG for clipboard.
 */

import type { Lang } from './calcI18n';
import { t, formatCurrency } from './calcI18n';
import type { ScenarioResult } from './scenarios';
import { barChartToPngBlob } from './chartToPng';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const tableStyle = 'border-collapse:collapse;width:100%;font-family:Calibri,Arial,sans-serif;font-size:11pt;';
const thStyle = 'border:1px solid #333;background:#e8e8e8;padding:6px 8px;font-weight:bold;text-align:right;';
const tdStyle = 'border:1px solid #333;padding:6px 8px;text-align:right;';

export function buildScenariosWordHtml(results: ScenarioResult[], lang: Lang): string {
  const dir = lang === 'he' ? 'rtl' : 'ltr';
  let html = `<div style="direction:${dir};font-family:Calibri,Arial,sans-serif;font-size:11pt;padding:12px;" dir="${dir}">`;
  html += `<p style="font-size:14pt;font-weight:bold;margin-bottom:12px;">${escapeHtml(t('scenarioSummary', lang))}</p>`;
  html += '<table style="' + tableStyle + '">';
  html += '<thead><tr>';
  html += `<th style="${thStyle}">${escapeHtml(t('scenarios', lang))}</th>`;
  html += `<th style="${thStyle}">${escapeHtml(t('totalBefore', lang))} (₪)</th>`;
  html += `<th style="${thStyle}">${escapeHtml(t('totalAfter', lang))} (₪)</th>`;
  html += '</tr></thead><tbody>';
  for (const r of results) {
    const label = t(r.labelKey, lang);
    html += '<tr>';
    html += `<td style="${tdStyle}">${escapeHtml(label)}</td>`;
    html += `<td style="${tdStyle}">${formatCurrency(lang, r.before.avg)}</td>`;
    html += `<td style="${tdStyle}">${formatCurrency(lang, r.after.avg)}</td>`;
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  return html;
}

export async function exportScenariosToWord(
  results: ScenarioResult[],
  lang: Lang
): Promise<{ success: boolean; imageCopied?: boolean }> {
  const html = buildScenariosWordHtml(results, lang);
  const labels: [string, string, string] = [
    t('conservative', lang),
    t('reasonable', lang),
    t('aggressive', lang),
  ];
  const seriesBefore: [number, number, number] = [
    results[0]?.before.avg ?? 0,
    results[1]?.before.avg ?? 0,
    results[2]?.before.avg ?? 0,
  ];
  const seriesAfter: [number, number, number] = [
    results[0]?.after.avg ?? 0,
    results[1]?.after.avg ?? 0,
    results[2]?.after.avg ?? 0,
  ];
  const htmlBlob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const plainBlob = new Blob(
    [results.map((r) => `${t(r.labelKey, lang)}\t${r.before.avg}\t${r.after.avg}`).join('\n')],
    { type: 'text/plain;charset=utf-8' }
  );
  try {
    const pngBlob = await barChartToPngBlob(
      { labels, seriesBefore, seriesAfter },
      lang as 'he' | 'en-GB'
    );
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': htmlBlob,
        'text/plain': plainBlob,
        'image/png': pngBlob,
      }),
    ]);
    return { success: true, imageCopied: true };
  } catch {
    await navigator.clipboard.write([
      new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': plainBlob }),
    ]);
    return { success: true, imageCopied: false };
  }
}
