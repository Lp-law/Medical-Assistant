/**
 * Builds Word-friendly HTML (inline styles, no external CSS) for clipboard paste.
 * Uses exact totals/after/attorneyFeeAndGross from the calculator state.
 */

import {
  ExportLang,
  getLabels,
  formatCurrency,
  formatPercent,
  isRtl,
} from './exportForWordI18n';

export type ExportPayload = {
  sheet: {
    title: string;
    rows: Array<{
      id: string;
      enabled: boolean;
      name: string;
      kind: 'add' | 'deduct';
      plaintiff: number;
      defendant: number;
    }>;
    contributoryNegligencePercent: number;
    reductions: Array<{ id: string; enabled: boolean; label: string; percent: number }>;
    defendants: Array<{ id: string; enabled: boolean; name: string; percent: number }>;
    attorneyFeePercent: number;
    plaintiffExpenses: number;
  };
  totals: {
    plaintiffAdd: number;
    defendantAdd: number;
    avgAdd: number;
    plaintiffDeduct: number;
    defendantDeduct: number;
    avgDeduct: number;
    plaintiffNet: number;
    defendantNet: number;
    avgNet: number;
  };
  after: {
    plaintiff: { afterContrib: number; afterAll: number; reductionsFactor: number };
    defendant: { afterContrib: number; afterAll: number; reductionsFactor: number };
    avg: { afterContrib: number; afterAll: number; reductionsFactor: number };
  };
  attorneyFeeAndGross: {
    attorneyFeePlaintiff: number;
    attorneyFeeDefendant: number;
    attorneyFeeAvg: number;
    plaintiffExpenses: number;
    grossPlaintiff: number;
    grossDefendant: number;
    grossAvg: number;
  };
  defendantAmounts: {
    avg: Array<{ id: string; name: string; percent: number; amount: number }>;
  };
};

const tableStyle =
  'border-collapse:collapse;width:100%;font-family:Calibri,Arial,sans-serif;font-size:11pt;';
const thStyle =
  'border:1px solid #333;background:#e8e8e8;padding:6px 8px;font-weight:bold;';
const tdStyle = 'border:1px solid #333;padding:6px 8px;';
const thNum = thStyle + 'text-align:right;';
const tdNum = tdStyle + 'text-align:right;';

function cell(
  content: string,
  opts: { header?: boolean; alignRight?: boolean; dir?: string } = {}
): string {
  const { header = false, alignRight = false, dir } = opts;
  const baseStyle = header ? (alignRight ? thNum : thStyle) : (alignRight ? tdNum : tdStyle);
  const style =
    baseStyle + (dir ? `direction:${dir};text-align:${dir === 'rtl' ? 'right' : 'left'};` : '');
  const tag = header ? 'th' : 'td';
  return `<${tag} style="${style}">${escapeHtml(content)}</${tag}>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type BuildWordHtmlOptions = {
  lang: ExportLang;
  includeReductions: boolean;
  includeDefendants: boolean;
};

export function buildWordHtml(
  payload: ExportPayload,
  options: BuildWordHtmlOptions
): string {
  const { lang, includeReductions, includeDefendants } = options;
  const L = getLabels(lang);
  const rtl = isRtl(lang);
  const dir = rtl ? 'rtl' : 'ltr';

  const activeRows = payload.sheet.rows.filter((r) => r.enabled);
  const calcAvg = (p: number, d: number) => (p + d) / 2;

  let html = `<div style="direction:${dir};font-family:Calibri,Arial,sans-serif;font-size:11pt;padding:12px;" dir="${dir}">`;
  html += `<p style="font-size:14pt;font-weight:bold;margin-bottom:12px;">${escapeHtml(payload.sheet.title || L.title)}</p>`;

  // A) Breakdown of Damages
  html += `<p style="font-weight:bold;margin-top:16px;">${L.breakdownTitle}</p>`;
  html += `<table style="${tableStyle}">`;
  html += '<thead><tr>';
  html += cell(L.item, { header: true, dir });
  html += cell(L.type, { header: true, dir });
  html += cell(L.claimant + ' (₪)', { header: true, alignRight: true });
  html += cell(L.defendant + ' (₪)', { header: true, alignRight: true });
  html += cell(L.average + ' (₪)', { header: true, alignRight: true });
  html += '</tr></thead><tbody>';
  for (const r of activeRows) {
    const avg = calcAvg(r.plaintiff, r.defendant);
    html += '<tr>';
    html += cell(r.name, { dir });
    html += cell(r.kind === 'deduct' ? L.deduct : L.add, { dir });
    html += cell(formatCurrency(lang, r.plaintiff), { alignRight: true });
    html += cell(formatCurrency(lang, r.defendant), { alignRight: true });
    html += cell(formatCurrency(lang, avg), { alignRight: true });
    html += '</tr>';
  }
  html += '</tbody></table>';

  // B) Totals Summary
  html += `<p style="font-weight:bold;margin-top:16px;">${L.summaryTitle}</p>`;
  html += `<table style="${tableStyle}">`;
  const { totals, after, attorneyFeeAndGross } = payload;
  const rows: Array<[string, string, string, string]> = [
    [L.subtotalHeads, formatCurrency(lang, totals.plaintiffAdd), formatCurrency(lang, totals.defendantAdd), formatCurrency(lang, totals.avgAdd)],
    [L.deductions, formatCurrency(lang, totals.plaintiffDeduct), formatCurrency(lang, totals.defendantDeduct), formatCurrency(lang, totals.avgDeduct)],
    [L.netTotal, formatCurrency(lang, totals.plaintiffNet), formatCurrency(lang, totals.defendantNet), formatCurrency(lang, totals.avgNet)],
    [L.contributoryNegligence, payload.sheet.contributoryNegligencePercent + '%', payload.sheet.contributoryNegligencePercent + '%', payload.sheet.contributoryNegligencePercent + '%'],
    [L.attorneyFee, formatCurrency(lang, attorneyFeeAndGross.attorneyFeePlaintiff), formatCurrency(lang, attorneyFeeAndGross.attorneyFeeDefendant), formatCurrency(lang, attorneyFeeAndGross.attorneyFeeAvg)],
    [L.plaintiffExpenses, formatCurrency(lang, attorneyFeeAndGross.plaintiffExpenses), '—', formatCurrency(lang, attorneyFeeAndGross.plaintiffExpenses)],
    [L.grossTotal, formatCurrency(lang, attorneyFeeAndGross.grossPlaintiff), formatCurrency(lang, attorneyFeeAndGross.grossDefendant), formatCurrency(lang, attorneyFeeAndGross.grossAvg)],
    [L.totalAfter, formatCurrency(lang, after.plaintiff.afterAll), formatCurrency(lang, after.defendant.afterAll), formatCurrency(lang, after.avg.afterAll)],
  ];
  html += '<thead><tr>';
  html += cell('', { header: true, dir });
  html += cell(L.claimant, { header: true, alignRight: true });
  html += cell(L.defendant, { header: true, alignRight: true });
  html += cell(L.average, { header: true, alignRight: true });
  html += '</tr></thead><tbody>';
  for (const [label, p, d, a] of rows) {
    html += '<tr>';
    html += cell(label, { dir });
    html += cell(p, { alignRight: true });
    html += cell(d, { alignRight: true });
    html += cell(a, { alignRight: true });
    html += '</tr>';
  }
  html += '</tbody></table>';

  if (includeReductions && payload.sheet.reductions.length > 0) {
    html += `<p style="font-weight:bold;margin-top:16px;">${L.reductionsSection}</p>`;
    html += `<table style="${tableStyle}">`;
    html += '<thead><tr>';
    html += cell(L.reductionLabel, { header: true, dir });
    html += cell(L.percent, { header: true, alignRight: true });
    html += '</tr></thead><tbody>';
    for (const r of payload.sheet.reductions) {
      html += '<tr>';
      html += cell(r.label, { dir });
      html += cell(formatPercent(lang, r.percent), { alignRight: true });
      html += '</tr>';
    }
    html += '</tbody></table>';
  }

  if (includeDefendants && payload.defendantAmounts.avg.length > 0) {
    html += `<p style="font-weight:bold;margin-top:16px;">${L.defendantsSection}</p>`;
    html += `<table style="${tableStyle}">`;
    html += '<thead><tr>';
    html += cell(L.defendantName, { header: true, dir });
    html += cell(L.percent, { header: true, alignRight: true });
    html += cell(L.amount + ' (₪)', { header: true, alignRight: true });
    html += '</tr></thead><tbody>';
    for (const d of payload.defendantAmounts.avg) {
      html += '<tr>';
      html += cell(d.name, { dir });
      html += cell(formatPercent(lang, d.percent), { alignRight: true });
      html += cell(formatCurrency(lang, d.amount), { alignRight: true });
      html += '</tr>';
    }
    html += '</tbody></table>';
  }

  html += '</div>';
  return html;
}

/** Plain-text fallback for clipboard. */
export function buildWordPlainText(
  payload: ExportPayload,
  options: BuildWordHtmlOptions
): string {
  const { lang, includeDefendants } = options;
  void options.includeReductions; // reserved for future plain-text reductions section
  const L = getLabels(lang);
  const fmt = (n: number) => formatCurrency(lang, n);
  const activeRows = payload.sheet.rows.filter((r) => r.enabled);
  const calcAvg = (p: number, d: number) => (p + d) / 2;
  const lines: string[] = [payload.sheet.title || L.title, '', L.breakdownTitle];
  for (const r of activeRows) {
    const avg = calcAvg(r.plaintiff, r.defendant);
    lines.push(`${r.name}\t${fmt(r.plaintiff)}\t${fmt(r.defendant)}\t${fmt(avg)}`);
  }
  lines.push('', L.netTotal, `${fmt(payload.totals.plaintiffNet)}\t${fmt(payload.totals.defendantNet)}\t${fmt(payload.totals.avgNet)}`);
  lines.push('', L.totalAfter, `${fmt(payload.after.plaintiff.afterAll)}\t${fmt(payload.after.defendant.afterAll)}\t${fmt(payload.after.avg.afterAll)}`);
  if (includeDefendants && payload.defendantAmounts.avg.length > 0) {
    lines.push('', L.defendantsSection);
    for (const d of payload.defendantAmounts.avg) {
      lines.push(`${d.name}\t${d.percent}%\t${fmt(d.amount)}`);
    }
  }
  return lines.join('\n');
}
