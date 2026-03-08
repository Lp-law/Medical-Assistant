import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun } from 'docx';
import type { ExportLang } from './exportForWordI18n';
import { getLabels, formatNumber } from './exportForWordI18n';

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Sheet = {
  title: string;
  rows: Array<{ name: string; kind: string; plaintiff: number; defendant: number; enabled: boolean }>;
  contributoryNegligencePercent: number;
  reductions: Array<{ label: string; percent: number; enabled: boolean }>;
  defendants: Array<{ name: string; percent: number }>;
  attorneyFeePercent: number;
  plaintiffExpenses: number;
};

type Totals = {
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

type After = {
  plaintiff: { afterAll: number };
  defendant: { afterAll: number };
  avg: { afterAll: number };
};

type AttorneyFeeGross = {
  attorneyFeePlaintiff: number;
  attorneyFeeAvg: number;
  plaintiffExpenses: number;
  grossPlaintiff: number;
  grossDefendant: number;
  grossAvg: number;
};

const cell = (text: string): TableCell => new TableCell({ children: [new Paragraph(text)] });

export async function exportDamagesToDocx(
  sheet: Sheet,
  totals: Totals,
  after: After,
  attorneyFeeAndGross: AttorneyFeeGross,
  lang: ExportLang = 'he',
): Promise<void> {
  const exportLang: ExportLang = lang === 'en-GB' ? 'en-GB' : 'he';
  const L = getLabels(exportLang);
  const fmt = (n: number): string => formatNumber(exportLang, Number.isFinite(n) ? n : 0);
  const currencySymbol = '₪';

  const rows: TableRow[] = [];

  const headerRow = new TableRow({
    children: [
      cell(L.item),
      cell(`${L.claimant} (${currencySymbol})`),
      cell(`${L.defendant} (${currencySymbol})`),
      cell(`${L.average} (${currencySymbol})`),
    ],
    tableHeader: true,
  });
  rows.push(headerRow);

  for (const r of sheet.rows) {
    if (!r.enabled) continue;
    const avg = (r.plaintiff + r.defendant) / 2;
    rows.push(
      new TableRow({
        children: [
          cell(r.name),
          cell(fmt(r.plaintiff)),
          cell(fmt(r.defendant)),
          cell(fmt(avg)),
        ],
      }),
    );
  }

  rows.push(
    new TableRow({
      children: [
        cell(L.netTotal),
        cell(fmt(totals.plaintiffNet)),
        cell(fmt(totals.defendantNet)),
        cell(fmt(totals.avgNet)),
      ],
    }),
  );
  rows.push(
    new TableRow({
      children: [
        cell(L.grossTotal),
        cell(fmt(attorneyFeeAndGross.grossPlaintiff)),
        cell(fmt(attorneyFeeAndGross.grossDefendant)),
        cell(fmt(attorneyFeeAndGross.grossAvg)),
      ],
    }),
  );

  const table = new Table({
    rows,
    width: { size: 100, type: 'pct' },
    visuallyRightToLeft: exportLang === 'he',
  });

  const summaryLines = [
    `${L.titleLabel}: ${sheet.title}`,
    `${L.contributoryNegligence}: ${sheet.contributoryNegligencePercent}%`,
    `${L.attorneyFeePct}: ${sheet.attorneyFeePercent}%`,
    `${L.plaintiffExpenses}: ${currencySymbol}${fmt(sheet.plaintiffExpenses)}`,
    `${L.resultClaimant}: ${currencySymbol}${fmt(after.plaintiff.afterAll)}`,
    `${L.resultDefendant}: ${currencySymbol}${fmt(after.defendant.afterAll)}`,
    `${L.resultAvg}: ${currencySymbol}${fmt(after.avg.afterAll)}`,
  ];

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({ children: [new TextRun({ text: sheet.title, bold: true, size: 32 })] }),
          new Paragraph(''),
          table,
          new Paragraph(''),
          new Paragraph({ children: [new TextRun({ text: L.summaryTitle, bold: true, size: 28 })] }),
          ...summaryLines.map((line) => new Paragraph(line)),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeTitle = sheet.title.replace(/[^\w\u0590-\u05FF\s-]/g, '-').replace(/\s+/g, '-');
  const name = `damages-${safeTitle}-${new Date().toISOString().slice(0, 10)}.docx`;
  saveBlob(blob, name);
}
