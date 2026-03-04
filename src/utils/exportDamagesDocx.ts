import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun } from 'docx';

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

const fmt = (n: number): string => (Number.isFinite(n) ? n : 0).toLocaleString('he-IL', { maximumFractionDigits: 0 });
const cell = (text: string): TableCell => new TableCell({ children: [new Paragraph(text)] });

export async function exportDamagesToDocx(
  sheet: Sheet,
  totals: Totals,
  after: After,
  attorneyFeeAndGross: AttorneyFeeGross,
): Promise<void> {
  const rows: TableRow[] = [];

  const headerRow = new TableRow({
    children: [
      cell('ראש נזק'),
      cell('תובע (₪)'),
      cell('נתבע (₪)'),
      cell('ממוצע (₪)'),
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
        cell('סה״כ נטו'),
        cell(fmt(totals.plaintiffNet)),
        cell(fmt(totals.defendantNet)),
        cell(fmt(totals.avgNet)),
      ],
    }),
  );
  rows.push(
    new TableRow({
      children: [
        cell('סה״כ ברוטו'),
        cell(fmt(attorneyFeeAndGross.grossPlaintiff)),
        cell(fmt(attorneyFeeAndGross.grossDefendant)),
        cell(fmt(attorneyFeeAndGross.grossAvg)),
      ],
    }),
  );

  const table = new Table({
    rows,
    width: { size: 100, type: 'pct' },
    visuallyRightToLeft: true,
  });

  const summaryLines = [
    `כותרת: ${sheet.title}`,
    `אשם תורם: ${sheet.contributoryNegligencePercent}%`,
    `אחוז שכ״ט: ${sheet.attorneyFeePercent}%`,
    `הוצאות תובע: ₪${fmt(sheet.plaintiffExpenses)}`,
    `תוצאה תובע: ₪${fmt(after.plaintiff.afterAll)}`,
    `תוצאה נתבע: ₪${fmt(after.defendant.afterAll)}`,
    `תוצאה ממוצע: ₪${fmt(after.avg.afterAll)}`,
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
          new Paragraph({ children: [new TextRun({ text: 'סיכום', bold: true, size: 28 })] }),
          ...summaryLines.map((line) => new Paragraph(line)),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const name = `damages-${sheet.title.replace(/[^\w\u0590-\u05FF]/g, '-')}-${new Date().toISOString().slice(0, 10)}.docx`;
  saveBlob(blob, name);
}
