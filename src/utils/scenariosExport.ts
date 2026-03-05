/**
 * Export three scenarios to Word: HTML table + chart PNG for clipboard.
 * Single rounding policy: 0 decimal places (whole currency).
 */

import type { Lang } from './calcI18n';
import { t, formatCurrency } from './calcI18n';
import type { ScenarioResult } from './scenarios';
import { barChartToPngBlob } from './chartToPng';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const tableStyle = 'border-collapse:collapse;width:100%;font-family:Calibri,Arial,sans-serif;font-size:11pt;';
const thStyle = 'border:1px solid #333;background:#e8e8e8;padding:6px 8px;font-weight:bold;';
const tdStyle = 'border:1px solid #333;padding:6px 8px;';
const thNumStyle = thStyle + 'text-align:right;';
const tdNumStyle = tdStyle + 'text-align:right;';
const tdLabelRtl = tdStyle + 'text-align:right;';
const tdLabelLtr = tdStyle + 'text-align:left;';

export function buildScenariosWordHtml(results: ScenarioResult[], lang: Lang): string {
  const dir = lang === 'he' ? 'rtl' : 'ltr';
  const tdLabel = lang === 'he' ? tdLabelRtl : tdLabelLtr;
  let html = `<div style="direction:${dir};font-family:Calibri,Arial,sans-serif;font-size:11pt;padding:12px;" dir="${dir}">`;
  html += `<p style="font-size:14pt;font-weight:bold;margin-bottom:12px;">${escapeHtml(t('scenarioComparisonTitle', lang))}</p>`;
  html += `<p style="font-size:10pt;color:#555;margin-bottom:12px;">${escapeHtml(t('scenarioAssumptions', lang))}</p>`;
  html += '<table style="' + tableStyle + '">';
  html += '<thead><tr>';
  html += `<th style="${tdLabel}">${escapeHtml(t('scenarios', lang))}</th>`;
  html += `<th style="${thNumStyle}">${escapeHtml(t('totalBefore', lang))} (₪)</th>`;
  html += `<th style="${thNumStyle}">${escapeHtml(t('totalAfter', lang))} (₪)</th>`;
  html += '</tr></thead><tbody>';
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const label = t(r.labelKey, lang);
    const isTotalRow = i === results.length - 1;
    const rowStyle = isTotalRow ? 'font-weight:bold;border-top:3px double #333;' : '';
    html += '<tr>';
    html += `<td style="${tdLabel};${rowStyle}">${escapeHtml(label)}</td>`;
    html += `<td style="${tdNumStyle};${rowStyle}">${formatCurrency(lang, Math.round(r.before.avg))}</td>`;
    html += `<td style="${tdNumStyle};${rowStyle}">${formatCurrency(lang, Math.round(r.after.avg))}</td>`;
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  return html;
}

/** Copy table-only HTML to clipboard (no chart). */
export async function copyScenariosTableOnly(results: ScenarioResult[], lang: Lang): Promise<boolean> {
  const html = buildScenariosWordHtml(results, lang);
  const htmlBlob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const plainBlob = new Blob(
    [results.map((r) => `${t(r.labelKey, lang)}\t${Math.round(r.before.avg)}\t${Math.round(r.after.avg)}`).join('\n')],
    { type: 'text/plain;charset=utf-8' }
  );
  await navigator.clipboard.write([new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': plainBlob })]);
  return true;
}

/** Copy chart-only PNG to clipboard. */
export async function copyScenariosChartOnly(results: ScenarioResult[], lang: Lang): Promise<boolean> {
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
  const pngBlob = await barChartToPngBlob(
    { labels, seriesBefore, seriesAfter },
    lang as 'he' | 'en-GB'
  );
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
  return true;
}

/**
 * Copy table + chart to clipboard (multi-item). Falls back to table-only if image permission fails.
 */
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
    [results.map((r) => `${t(r.labelKey, lang)}\t${Math.round(r.before.avg)}\t${Math.round(r.after.avg)}`).join('\n')],
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
