import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Plus, Trash2, Upload, RotateCcw } from 'lucide-react';
import { storageGetItem, storageSetItem } from '../utils/storageGuard';

type HeadRowKind = 'add' | 'deduct';

type HeadRow = {
  id: string;
  enabled: boolean;
  name: string;
  kind: HeadRowKind; // add = תוספת, deduct = הפחתה (קיזוז)
  plaintiff: number; // ₪
  defendant: number; // ₪
};

type Reduction = {
  id: string;
  enabled: boolean;
  label: string;
  percent: number; // 0-100
};

type DefendantShare = {
  id: string;
  enabled: boolean;
  name: string;
  percent: number; // 0-100
};

type Sheet = {
  version: 3;
  title: string;
  rows: HeadRow[];
  contributoryNegligencePercent: number; // אשם תורם (%), applied first
  reductions: Reduction[]; // applied after contributory negligence (multiplicative)
  defendants: DefendantShare[]; // allocation after all reductions
  updatedAt: string;
};

// Must NOT start with "lexmedical_" (blocked by storageGuard as PHI).
const STORAGE_KEY_V3 = 'calc_damages_v3';
const STORAGE_KEY_V2 = 'calc_damages_v2';
const STORAGE_KEY_V1 = 'calc_damages_v1';

const uid = (): string => Math.random().toString(16).slice(2) + Date.now().toString(16);

const clampPercent = (value: number): number => Math.max(0, Math.min(100, value));

const safeNumber = (value: unknown): number => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
};

const formatILS = (value: number): string => {
  const n = Number.isFinite(value) ? value : 0;
  return n.toLocaleString('he-IL', { maximumFractionDigits: 0 });
};

const normalizeHebrewKey = (value: string): string =>
  (value ?? '')
    .toString()
    .replace(/[״"'`]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();

const inferRowKind = (name: string): HeadRowKind => {
  const key = normalizeHebrewKey(name);
  // מל"ל is a classic deduction line item
  if (key.includes('מלל')) return 'deduct';
  return 'add';
};

const DEFAULT_ROWS: HeadRow[] = [
  { id: uid(), enabled: true, name: 'כאב וסבל', kind: 'add', plaintiff: 0, defendant: 0 },
  { id: uid(), enabled: true, name: 'עזרת צד ג׳', kind: 'add', plaintiff: 0, defendant: 0 },
  { id: uid(), enabled: true, name: 'הוצאות רפואיות', kind: 'add', plaintiff: 0, defendant: 0 },
  { id: uid(), enabled: true, name: 'אורתופד', kind: 'add', plaintiff: 0, defendant: 0 },
  { id: uid(), enabled: true, name: 'הפסדי שכר', kind: 'add', plaintiff: 0, defendant: 0 },
  { id: uid(), enabled: true, name: 'ניידות', kind: 'add', plaintiff: 0, defendant: 0 },
  { id: uid(), enabled: true, name: 'התאמות דיור', kind: 'add', plaintiff: 0, defendant: 0 },
  { id: uid(), enabled: true, name: 'הוצאות עודפות בגין נסיעות לחו״ל', kind: 'add', plaintiff: 0, defendant: 0 },
  { id: uid(), enabled: true, name: 'מל״ל', kind: 'deduct', plaintiff: 0, defendant: 0 },
];

const DEFAULT_REDUCTIONS: Reduction[] = [
  { id: uid(), enabled: true, label: 'פגיעה בסיכויי החלמה (%)', percent: 0 },
];

const DEFAULT_DEFENDANTS: DefendantShare[] = [
  { id: uid(), enabled: true, name: 'נתבע 1', percent: 100 },
];

const defaultSheet = (): Sheet => ({
  version: 3,
  title: 'מחשבון נזק',
  rows: DEFAULT_ROWS,
  contributoryNegligencePercent: 0,
  reductions: DEFAULT_REDUCTIONS,
  defendants: DEFAULT_DEFENDANTS,
  updatedAt: new Date().toISOString(),
});

const calcAvg = (p: number, d: number): number => (safeNumber(p) + safeNumber(d)) / 2;

const sum = (values: number[]): number => values.reduce((acc, v) => acc + safeNumber(v), 0);

const applyContribAndReductions = (
  base: number,
  contributoryNegligencePercent: number,
  reductions: Reduction[],
): { afterContrib: number; afterAll: number; contribFactor: number; reductionsFactor: number } => {
  const contribFactor = 1 - clampPercent(contributoryNegligencePercent) / 100;
  const afterContrib = base * contribFactor;
  const reductionsFactor = reductions
    .filter((r) => r.enabled)
    .reduce((acc, r) => acc * (1 - clampPercent(r.percent) / 100), 1);
  const afterAll = afterContrib * reductionsFactor;
  return { afterContrib, afterAll, contribFactor, reductionsFactor };
};

const DamagesCalculator: React.FC = () => {
  const importRef = useRef<HTMLInputElement | null>(null);
  const [sheet, setSheet] = useState<Sheet>(() => {
    try {
      // Prefer v3; if missing, try migrating from v2/v1.
      const raw = storageGetItem(STORAGE_KEY_V3) ?? storageGetItem(STORAGE_KEY_V2) ?? storageGetItem(STORAGE_KEY_V1);
      if (!raw) return defaultSheet();
      const parsed = JSON.parse(raw) as any;
      // v3
      if ((parsed as any).version === 3) {
        return {
          version: 3,
          title: String(parsed.title ?? 'מחשבון נזק'),
          rows: Array.isArray(parsed.rows)
            ? (parsed.rows as any[]).map((r) => ({
                id: String(r.id ?? uid()),
                enabled: Boolean(r.enabled ?? true),
                name: String(r.name ?? ''),
                kind: (r.kind === 'deduct' || r.kind === 'add') ? r.kind : inferRowKind(String(r.name ?? '')),
                plaintiff: safeNumber(r.plaintiff),
                defendant: safeNumber(r.defendant),
              }))
            : DEFAULT_ROWS,
          contributoryNegligencePercent: clampPercent(safeNumber((parsed as any).contributoryNegligencePercent)),
          reductions: Array.isArray((parsed as any).reductions)
            ? ((parsed as any).reductions as any[]).map((r) => ({
                id: String(r.id ?? uid()),
                enabled: Boolean(r.enabled ?? true),
                label: String(r.label ?? ''),
                percent: clampPercent(safeNumber(r.percent)),
              }))
            : DEFAULT_REDUCTIONS,
          defendants: Array.isArray((parsed as any).defendants)
            ? ((parsed as any).defendants as any[]).map((d) => ({
                id: String(d.id ?? uid()),
                enabled: Boolean(d.enabled ?? true),
                name: String(d.name ?? 'נתבע'),
                percent: clampPercent(safeNumber(d.percent)),
              }))
            : DEFAULT_DEFENDANTS,
          updatedAt: String(parsed.updatedAt ?? new Date().toISOString()),
        };
      }
      // v2
      if ((parsed as any).version === 2) {
        return {
          version: 3,
          title: String(parsed.title ?? 'מחשבון נזק'),
          rows: Array.isArray(parsed.rows)
            ? (parsed.rows as any[]).map((r) => ({
                id: String(r.id ?? uid()),
                enabled: Boolean(r.enabled ?? true),
                name: String(r.name ?? ''),
                kind: inferRowKind(String(r.name ?? '')),
                plaintiff: safeNumber(r.plaintiff),
                defendant: safeNumber(r.defendant),
              }))
            : DEFAULT_ROWS,
          contributoryNegligencePercent: clampPercent(safeNumber((parsed as any).contributoryNegligencePercent)),
          reductions: Array.isArray((parsed as any).reductions)
            ? ((parsed as any).reductions as any[]).map((r) => ({
                id: String(r.id ?? uid()),
                enabled: Boolean(r.enabled ?? true),
                label: String(r.label ?? ''),
                percent: clampPercent(safeNumber(r.percent)),
              }))
            : DEFAULT_REDUCTIONS,
          defendants: Array.isArray((parsed as any).defendants)
            ? ((parsed as any).defendants as any[]).map((d) => ({
                id: String(d.id ?? uid()),
                enabled: Boolean(d.enabled ?? true),
                name: String(d.name ?? 'נתבע'),
                percent: clampPercent(safeNumber(d.percent)),
              }))
            : DEFAULT_DEFENDANTS,
          updatedAt: String(parsed.updatedAt ?? new Date().toISOString()),
        };
      }

      // v1 migration
      if ((parsed as any).version === 1) {
        const v1Adjustments = Array.isArray((parsed as any).adjustments) ? ((parsed as any).adjustments as any[]) : [];
        const contributory = v1Adjustments.find((a) => String(a.label ?? '').includes('אשם'))?.percent ?? 0;
        const lossChance = v1Adjustments.find((a) => String(a.label ?? '').includes('סיכויי'))?.percent ?? 0;
        return {
          version: 3,
          title: String(parsed.title ?? 'מחשבון נזק'),
          rows: Array.isArray(parsed.rows)
            ? (parsed.rows as any[]).map((r) => ({
                id: String(r.id ?? uid()),
                enabled: Boolean(r.enabled ?? true),
                name: String(r.name ?? ''),
                kind: inferRowKind(String(r.name ?? '')),
                plaintiff: safeNumber(r.plaintiff),
                defendant: safeNumber(r.defendant),
              }))
            : DEFAULT_ROWS,
          contributoryNegligencePercent: clampPercent(safeNumber(contributory)),
          reductions: [
            { id: uid(), enabled: true, label: 'פגיעה בסיכויי החלמה (%)', percent: clampPercent(safeNumber(lossChance)) },
          ],
          defendants: DEFAULT_DEFENDANTS,
          updatedAt: new Date().toISOString(),
        };
      }

      return defaultSheet();
    } catch {
      return defaultSheet();
    }
  });

  useEffect(() => {
    try {
      const next: Sheet = { ...sheet, updatedAt: new Date().toISOString() };
      storageSetItem(STORAGE_KEY_V3, JSON.stringify(next));
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet.title, sheet.rows, sheet.contributoryNegligencePercent, sheet.reductions, sheet.defendants]);

  const activeRows = useMemo(() => sheet.rows.filter((r) => r.enabled), [sheet.rows]);

  const totals = useMemo(() => {
    const addRows = activeRows.filter((r) => r.kind === 'add');
    const deductRows = activeRows.filter((r) => r.kind === 'deduct');

    const plaintiffAdd = sum(addRows.map((r) => r.plaintiff));
    const defendantAdd = sum(addRows.map((r) => r.defendant));
    const avgAdd = sum(addRows.map((r) => calcAvg(r.plaintiff, r.defendant)));

    const plaintiffDeduct = sum(deductRows.map((r) => r.plaintiff));
    const defendantDeduct = sum(deductRows.map((r) => r.defendant));
    const avgDeduct = sum(deductRows.map((r) => calcAvg(r.plaintiff, r.defendant)));

    const plaintiffNet = plaintiffAdd - plaintiffDeduct;
    const defendantNet = defendantAdd - defendantDeduct;
    const avgNet = avgAdd - avgDeduct;

    return {
      plaintiffAdd,
      defendantAdd,
      avgAdd,
      plaintiffDeduct,
      defendantDeduct,
      avgDeduct,
      plaintiffNet,
      defendantNet,
      avgNet,
    };
  }, [activeRows]);

  const after = useMemo(() => {
    // Apply reductions on the NET total (after deductions like מל"ל).
    const plaintiff = applyContribAndReductions(totals.plaintiffNet, sheet.contributoryNegligencePercent, sheet.reductions);
    const defendant = applyContribAndReductions(totals.defendantNet, sheet.contributoryNegligencePercent, sheet.reductions);
    const avg = applyContribAndReductions(totals.avgNet, sheet.contributoryNegligencePercent, sheet.reductions);
    return { plaintiff, defendant, avg };
  }, [sheet.contributoryNegligencePercent, sheet.reductions, totals.avgNet, totals.defendantNet, totals.plaintiffNet]);

  const updateRow = (id: string, patch: Partial<HeadRow>) => {
    setSheet((prev) => ({
      ...prev,
      rows: prev.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  };

  const removeRow = (id: string) => setSheet((prev) => ({ ...prev, rows: prev.rows.filter((r) => r.id !== id) }));

  const addRow = () =>
    setSheet((prev) => ({
      ...prev,
      rows: [
        ...prev.rows,
        { id: uid(), enabled: true, name: 'ראש נזק חדש', kind: 'add', plaintiff: 0, defendant: 0 },
      ],
    }));

  const updateReduction = (id: string, patch: Partial<Reduction>) => {
    setSheet((prev) => ({
      ...prev,
      reductions: prev.reductions.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  };

  const removeReduction = (id: string) =>
    setSheet((prev) => ({ ...prev, reductions: prev.reductions.filter((r) => r.id !== id) }));

  const addReduction = () =>
    setSheet((prev) => ({
      ...prev,
      reductions: [...prev.reductions, { id: uid(), enabled: true, label: 'הפחתה נוספת (%)', percent: 0 }],
    }));

  // Reset: restore the original head list and set all values to 0 (including reductions/defendants).
  const reset = () => setSheet((prev) => ({ ...defaultSheet(), title: prev.title }));

  const exportJson = () => {
    const payload: Sheet = { ...sheet, updatedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `damages-calculator-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    const quote = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines: string[] = [];
    lines.push([quote('כותרת'), quote(sheet.title), quote('עודכן'), quote(new Date().toISOString())].join(','));
    lines.push('');
    lines.push([quote('כלול'), quote('סוג'), quote('ראש נזק'), quote('טענות תובע'), quote('טענות נתבע'), quote('ממוצע')].join(','));
    for (const r of sheet.rows) {
      const avg = calcAvg(r.plaintiff, r.defendant);
      lines.push(
        [
          quote(r.enabled ? 'כן' : 'לא'),
          quote(r.kind === 'deduct' ? 'הפחתה' : 'תוספת'),
          quote(r.name),
          quote(safeNumber(r.plaintiff)),
          quote(safeNumber(r.defendant)),
          quote(avg),
        ].join(','),
      );
    }
    lines.push('');
    lines.push([quote('סה״כ ראשי נזק'), quote(totals.plaintiffAdd), quote(totals.defendantAdd), quote(totals.avgAdd)].join(','));
    lines.push([quote('קיזוזים (למשל מל״ל)'), quote(totals.plaintiffDeduct), quote(totals.defendantDeduct), quote(totals.avgDeduct)].join(','));
    lines.push([quote('סה״כ נטו'), quote(totals.plaintiffNet), quote(totals.defendantNet), quote(totals.avgNet)].join(','));
    lines.push('');
    lines.push([quote('אשם תורם (%)'), quote(sheet.contributoryNegligencePercent)].join(','));
    for (const r of sheet.reductions) {
      lines.push([quote(r.enabled ? 'הפחתה פעילה' : 'הפחתה לא פעילה'), quote(r.label), quote(r.percent)].join(','));
    }
    lines.push('');
    lines.push([quote('סה״כ לאחר הפחתות'), quote(after.plaintiff.afterAll), quote(after.defendant.afterAll), quote(after.avg.afterAll)].join(','));
    lines.push('');
    lines.push([quote('חלוקת נתבעים'), quote('נתבע'), quote('%'), quote('תובע'), quote('נתבע'), quote('ממוצע')].join(','));
    for (const d of sheet.defendants) {
      const pAmt = after.plaintiff.afterAll * (clampPercent(d.percent) / 100);
      const dAmt = after.defendant.afterAll * (clampPercent(d.percent) / 100);
      const aAmt = after.avg.afterAll * (clampPercent(d.percent) / 100);
      lines.push([quote(d.enabled ? 'כן' : 'לא'), quote(d.name), quote(d.percent), quote(pAmt), quote(dAmt), quote(aAmt)].join(','));
    }

    // UTF-8 BOM so Excel opens Hebrew correctly.
    const csv = '\uFEFF' + lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `damages-calculator-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text) as any;
    // Support v3 import, and v2/v1 import (migrated).
    if ((parsed as any).version === 3) {
      setSheet({
        version: 3,
        title: String(parsed.title ?? 'מחשבון נזק'),
        rows: Array.isArray(parsed.rows)
          ? (parsed.rows as any[]).map((r) => ({
              id: String(r.id ?? uid()),
              enabled: Boolean(r.enabled ?? true),
              name: String(r.name ?? ''),
              kind: (r.kind === 'deduct' || r.kind === 'add') ? r.kind : inferRowKind(String(r.name ?? '')),
              plaintiff: safeNumber(r.plaintiff),
              defendant: safeNumber(r.defendant),
            }))
          : [],
        contributoryNegligencePercent: clampPercent(safeNumber((parsed as any).contributoryNegligencePercent)),
        reductions: Array.isArray((parsed as any).reductions)
          ? ((parsed as any).reductions as any[]).map((r) => ({
              id: String(r.id ?? uid()),
              enabled: Boolean(r.enabled ?? true),
              label: String(r.label ?? ''),
              percent: clampPercent(safeNumber(r.percent)),
            }))
          : [],
        defendants: Array.isArray((parsed as any).defendants)
          ? ((parsed as any).defendants as any[]).map((d) => ({
              id: String(d.id ?? uid()),
              enabled: Boolean(d.enabled ?? true),
              name: String(d.name ?? 'נתבע'),
              percent: clampPercent(safeNumber(d.percent)),
            }))
          : DEFAULT_DEFENDANTS,
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    if ((parsed as any).version === 2) {
      setSheet({
        version: 3,
        title: String(parsed.title ?? 'מחשבון נזק'),
        rows: Array.isArray(parsed.rows)
          ? (parsed.rows as any[]).map((r) => ({
              id: String(r.id ?? uid()),
              enabled: Boolean(r.enabled ?? true),
              name: String(r.name ?? ''),
              kind: inferRowKind(String(r.name ?? '')),
              plaintiff: safeNumber(r.plaintiff),
              defendant: safeNumber(r.defendant),
            }))
          : [],
        contributoryNegligencePercent: clampPercent(safeNumber((parsed as any).contributoryNegligencePercent)),
        reductions: Array.isArray((parsed as any).reductions)
          ? ((parsed as any).reductions as any[]).map((r) => ({
              id: String(r.id ?? uid()),
              enabled: Boolean(r.enabled ?? true),
              label: String(r.label ?? ''),
              percent: clampPercent(safeNumber(r.percent)),
            }))
          : [],
        defendants: Array.isArray((parsed as any).defendants)
          ? ((parsed as any).defendants as any[]).map((d) => ({
              id: String(d.id ?? uid()),
              enabled: Boolean(d.enabled ?? true),
              name: String(d.name ?? 'נתבע'),
              percent: clampPercent(safeNumber(d.percent)),
            }))
          : DEFAULT_DEFENDANTS,
        updatedAt: new Date().toISOString(),
      });
      return;
    }
    if ((parsed as any).version === 1) {
      const v1Adjustments = Array.isArray((parsed as any).adjustments) ? ((parsed as any).adjustments as any[]) : [];
      const contributory = v1Adjustments.find((a) => String(a.label ?? '').includes('אשם'))?.percent ?? 0;
      const lossChance = v1Adjustments.find((a) => String(a.label ?? '').includes('סיכויי'))?.percent ?? 0;
      setSheet({
        version: 3,
        title: String(parsed.title ?? 'מחשבון נזק'),
        rows: Array.isArray(parsed.rows)
          ? (parsed.rows as any[]).map((r) => ({
              id: String(r.id ?? uid()),
              enabled: Boolean(r.enabled ?? true),
              name: String(r.name ?? ''),
              kind: inferRowKind(String(r.name ?? '')),
              plaintiff: safeNumber(r.plaintiff),
              defendant: safeNumber(r.defendant),
            }))
          : [],
        contributoryNegligencePercent: clampPercent(safeNumber(contributory)),
        reductions: [
          { id: uid(), enabled: true, label: 'פגיעה בסיכויי החלמה (%)', percent: clampPercent(safeNumber(lossChance)) },
        ],
        defendants: DEFAULT_DEFENDANTS,
        updatedAt: new Date().toISOString(),
      });
      return;
    }
    throw new Error('קובץ לא נתמך (גרסה שונה).');
  };

  const updateDefendant = (id: string, patch: Partial<DefendantShare>) => {
    setSheet((prev) => ({
      ...prev,
      defendants: prev.defendants.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    }));
  };

  const removeDefendant = (id: string) =>
    setSheet((prev) => ({ ...prev, defendants: prev.defendants.filter((d) => d.id !== id) }));

  const addDefendant = () =>
    setSheet((prev) => ({
      ...prev,
      defendants: [...prev.defendants, { id: uid(), enabled: true, name: `נתבע ${prev.defendants.length + 1}`, percent: 0 }],
    }));

  const activeDefendants = useMemo(() => sheet.defendants.filter((d) => d.enabled), [sheet.defendants]);
  const defendantsPercentSum = useMemo(() => sum(activeDefendants.map((d) => d.percent)), [activeDefendants]);
  const defendantAmounts = useMemo(() => {
    const calcFor = (baseAfterAll: number) => {
      return activeDefendants.map((d) => ({
        id: d.id,
        name: d.name,
        percent: d.percent,
        amount: baseAfterAll * (clampPercent(d.percent) / 100),
      }));
    };
    return {
      plaintiff: calcFor(after.plaintiff.afterAll),
      defendant: calcFor(after.defendant.afterAll),
      avg: calcFor(after.avg.afterAll),
    };
  }, [activeDefendants, after.avg.afterAll, after.defendant.afterAll, after.plaintiff.afterAll]);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="rounded-card border border-pearl bg-white p-4 shadow-card-xl flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-lg font-semibold text-navy">מחשבון נזק</p>
          <p className="text-xs text-slate-light">טבלה דינמית · תובע/נתבע/ממוצע · הפחתות באחוזים · שמירה מקומית</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-outline text-sm px-4 py-2" onClick={addRow}>
            <Plus className="w-4 h-4" />
            הוסף ראש נזק
          </button>
          <button type="button" className="btn-outline text-sm px-4 py-2" onClick={addReduction}>
            <Plus className="w-4 h-4" />
            הוסף הפחתה
          </button>
          <button type="button" className="btn-outline text-sm px-4 py-2" onClick={addDefendant}>
            <Plus className="w-4 h-4" />
            הוסף נתבע
          </button>
          <button type="button" className="btn-outline text-sm px-4 py-2" onClick={() => importRef.current?.click()}>
            <Upload className="w-4 h-4" />
            ייבוא JSON
          </button>
          <button type="button" className="btn-outline text-sm px-4 py-2" onClick={exportCsv}>
            <Download className="w-4 h-4" />
            ייצוא אקסל (CSV)
          </button>
          <button type="button" className="btn-outline text-sm px-4 py-2" onClick={exportJson}>
            <Download className="w-4 h-4" />
            ייצוא JSON
          </button>
          <button type="button" className="btn-outline text-sm px-4 py-2" onClick={reset}>
            <RotateCcw className="w-4 h-4" />
            איפוס
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              importJson(f).catch((err: any) => {
                alert(err?.message ?? 'ייבוא נכשל');
              });
              e.target.value = '';
            }}
          />
        </div>
      </div>

      <div className="card-shell">
        <div className="card-accent" />
        <div className="card-head">
          <div className="space-y-1">
            <p className="text-sm font-semibold">טבלת ראשי נזק</p>
            <p className="text-xs text-slate-light">שורה = ראש נזק. ניתן לכבות שורות/לשנות סכומים/למחוק.</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-light">שם תבנית</label>
            <input
              className="rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
              value={sheet.title}
              onChange={(e) => setSheet((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="לדוגמה: תיק פלוני"
            />
          </div>
        </div>
        <div className="card-underline" />

        <div className="card-body">
          <div className="overflow-auto">
            <table className="min-w-[920px] w-full text-sm border-separate border-spacing-0">
              <thead>
                <tr className="text-slate-light">
                  <th className="text-right px-3 py-2 border-b border-pearl">כלול</th>
                  <th className="text-right px-3 py-2 border-b border-pearl">סוג</th>
                  <th className="text-right px-3 py-2 border-b border-pearl">ראש נזק</th>
                  <th className="text-right px-3 py-2 border-b border-pearl">טענות תובע (₪)</th>
                  <th className="text-right px-3 py-2 border-b border-pearl">טענות נתבע (₪)</th>
                  <th className="text-right px-3 py-2 border-b border-pearl">ממוצע (₪)</th>
                  <th className="text-right px-3 py-2 border-b border-pearl">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {sheet.rows.map((r) => {
                  const avg = calcAvg(r.plaintiff, r.defendant);
                  return (
                    <tr key={r.id} className="align-top">
                      <td className="px-3 py-2 border-b border-pearl">
                        <input
                          type="checkbox"
                          checked={r.enabled}
                          onChange={(e) => updateRow(r.id, { enabled: e.target.checked })}
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-pearl">
                        <select
                          className="w-28 rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                          value={r.kind}
                          onChange={(e) => updateRow(r.id, { kind: (e.target.value as HeadRowKind) ?? 'add' })}
                          title="תוספת/הפחתה"
                        >
                          <option value="add">תוספת</option>
                          <option value="deduct">הפחתה</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 border-b border-pearl">
                        <input
                          className="w-64 rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                          value={r.name}
                          onChange={(e) => updateRow(r.id, { name: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-pearl">
                        <input
                          type="number"
                          className="w-44 rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                          value={r.plaintiff}
                          onChange={(e) => updateRow(r.id, { plaintiff: safeNumber(e.target.value) })}
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-pearl">
                        <input
                          type="number"
                          className="w-44 rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                          value={r.defendant}
                          onChange={(e) => updateRow(r.id, { defendant: safeNumber(e.target.value) })}
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-pearl">
                        <div className="w-44 rounded-card bg-pearl/60 border border-pearl p-2 text-sm text-navy">
                          {formatILS(avg)}
                        </div>
                      </td>
                      <td className="px-3 py-2 border-b border-pearl">
                        <button
                          type="button"
                          className="btn-outline text-[11px] px-3 py-1.5"
                          onClick={() => removeRow(r.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                          מחק
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className="px-3 py-3" />
                  <td className="px-3 py-3" />
                  <td className="px-3 py-3 font-semibold">סה״כ ראשי נזק</td>
                  <td className="px-3 py-3 font-semibold">{formatILS(totals.plaintiffAdd)}</td>
                  <td className="px-3 py-3 font-semibold">{formatILS(totals.defendantAdd)}</td>
                  <td className="px-3 py-3 font-semibold">{formatILS(totals.avgAdd)}</td>
                  <td className="px-3 py-3" />
                </tr>
                <tr>
                  <td className="px-3 py-3" />
                  <td className="px-3 py-3" />
                  <td className="px-3 py-3 font-semibold text-slate">קיזוזים (למשל מל״ל)</td>
                  <td className="px-3 py-3 font-semibold text-slate">{formatILS(totals.plaintiffDeduct)}</td>
                  <td className="px-3 py-3 font-semibold text-slate">{formatILS(totals.defendantDeduct)}</td>
                  <td className="px-3 py-3 font-semibold text-slate">{formatILS(totals.avgDeduct)}</td>
                  <td className="px-3 py-3" />
                </tr>
                <tr>
                  <td className="px-3 py-3" />
                  <td className="px-3 py-3" />
                  <td className="px-3 py-3 font-semibold">סה״כ נטו</td>
                  <td className="px-3 py-3 font-semibold">{formatILS(totals.plaintiffNet)}</td>
                  <td className="px-3 py-3 font-semibold">{formatILS(totals.defendantNet)}</td>
                  <td className="px-3 py-3 font-semibold">{formatILS(totals.avgNet)}</td>
                  <td className="px-3 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="card-shell">
          <div className="card-accent" />
          <div className="card-head">
            <div className="space-y-1">
              <p className="text-sm font-semibold">הפחתות באחוזים</p>
              <p className="text-xs text-slate-light">
                סדר החישוב: קודם מפחיתים אשם תורם, אחר כך מפחיתים שאר ההפחתות (מצטבר במכפלה), ורק אז מחלקים אחריות בין נתבעים.
              </p>
            </div>
          </div>
          <div className="card-underline" />
          <div className="card-body space-y-3">
            <div className="rounded-card border border-pearl bg-white p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="badge-warning">אשם תורם</span>
                <span className="text-xs text-slate-light">(% מהסכום הכולל)</span>
              </div>
              <div className="flex items-center gap-2 justify-between sm:justify-end">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    className="w-28 rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                    value={sheet.contributoryNegligencePercent}
                    onChange={(e) =>
                      setSheet((prev) => ({ ...prev, contributoryNegligencePercent: clampPercent(safeNumber(e.target.value)) }))
                    }
                  />
                  <span className="text-xs text-slate-light">%</span>
                </div>
              </div>
            </div>

            {sheet.reductions.map((r) => (
              <div key={r.id} className="rounded-card border border-pearl bg-white p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    onChange={(e) => updateReduction(r.id, { enabled: e.target.checked })}
                  />
                  <input
                    className="w-56 rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                    value={r.label}
                    onChange={(e) => updateReduction(r.id, { label: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2 justify-between sm:justify-end">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      className="w-28 rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                      value={r.percent}
                      onChange={(e) => updateReduction(r.id, { percent: clampPercent(safeNumber(e.target.value)) })}
                    />
                    <span className="text-xs text-slate-light">%</span>
                  </div>
                  <button type="button" className="btn-outline text-[11px] px-3 py-1.5" onClick={() => removeReduction(r.id)}>
                    <Trash2 className="w-4 h-4" />
                    הסר
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card-shell">
          <div className="card-accent" />
          <div className="card-head">
            <div className="space-y-1">
              <p className="text-sm font-semibold">תוצאה לאחר הפחתות</p>
              <p className="text-xs text-slate-light">השוואה מהירה בין שלושת התרחישים.</p>
            </div>
          </div>
          <div className="card-underline" />
          <div className="card-body space-y-3 text-sm">
            <div className="mini-card">
              <div className="flex items-center justify-between">
                <span className="font-semibold">תרחיש תובע</span>
                <span className="badge-strong">₪ {formatILS(after.plaintiff.afterAll)}</span>
              </div>
              <p className="text-xs text-slate-light mt-1">
                נטו לפני: ₪ {formatILS(totals.plaintiffNet)} · אחרי אשם תורם: ₪ {formatILS(after.plaintiff.afterContrib)} · פקטור הפחתות: {after.plaintiff.reductionsFactor.toFixed(3)}
              </p>
            </div>
            <div className="mini-card">
              <div className="flex items-center justify-between">
                <span className="font-semibold">תרחיש נתבע</span>
                <span className="badge-muted">₪ {formatILS(after.defendant.afterAll)}</span>
              </div>
              <p className="text-xs text-slate-light mt-1">
                נטו לפני: ₪ {formatILS(totals.defendantNet)} · אחרי אשם תורם: ₪ {formatILS(after.defendant.afterContrib)} · פקטור הפחתות: {after.defendant.reductionsFactor.toFixed(3)}
              </p>
            </div>
            <div className="mini-card">
              <div className="flex items-center justify-between">
                <span className="font-semibold">תרחיש ממוצע</span>
                <span className="badge-warning">₪ {formatILS(after.avg.afterAll)}</span>
              </div>
              <p className="text-xs text-slate-light mt-1">
                נטו לפני: ₪ {formatILS(totals.avgNet)} · אחרי אשם תורם: ₪ {formatILS(after.avg.afterContrib)} · פקטור הפחתות: {after.avg.reductionsFactor.toFixed(3)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card-shell">
        <div className="card-accent" />
        <div className="card-head">
          <div className="space-y-1">
            <p className="text-sm font-semibold">חלוקת אחריות בין נתבעים</p>
            <p className="text-xs text-slate-light">
              לאחר כל ההפחתות, הסכום מתחלק לפי אחוז לכל נתבע. מומלץ שסכום האחוזים יהיה 100%.
            </p>
          </div>
          <span className={defendantsPercentSum === 100 ? 'badge-info' : 'badge-warning'}>
            סה״כ אחוזים: {formatILS(defendantsPercentSum)}%
          </span>
        </div>
        <div className="card-underline" />
        <div className="card-body space-y-4">
          <div className="overflow-auto">
            <table className="min-w-[760px] w-full text-sm border-separate border-spacing-0">
              <thead>
                <tr className="text-slate-light">
                  <th className="text-right px-3 py-2 border-b border-pearl">כלול</th>
                  <th className="text-right px-3 py-2 border-b border-pearl">נתבע</th>
                  <th className="text-right px-3 py-2 border-b border-pearl">אחוז (%)</th>
                  <th className="text-right px-3 py-2 border-b border-pearl">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {sheet.defendants.map((d) => (
                  <tr key={d.id}>
                    <td className="px-3 py-2 border-b border-pearl">
                      <input
                        type="checkbox"
                        checked={d.enabled}
                        onChange={(e) => updateDefendant(d.id, { enabled: e.target.checked })}
                      />
                    </td>
                    <td className="px-3 py-2 border-b border-pearl">
                      <input
                        className="w-56 rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                        value={d.name}
                        onChange={(e) => updateDefendant(d.id, { name: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2 border-b border-pearl">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="w-28 rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                          value={d.percent}
                          onChange={(e) => updateDefendant(d.id, { percent: clampPercent(safeNumber(e.target.value)) })}
                        />
                        <span className="text-xs text-slate-light">%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 border-b border-pearl">
                      <button type="button" className="btn-outline text-[11px] px-3 py-1.5" onClick={() => removeDefendant(d.id)}>
                        <Trash2 className="w-4 h-4" />
                        הסר
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="mini-card">
              <div className="flex items-center justify-between">
                <span className="font-semibold">תרחיש תובע</span>
                <span className="badge-strong">₪ {formatILS(after.plaintiff.afterAll)}</span>
              </div>
              <div className="mt-2 space-y-1 text-xs text-slate">
                {defendantAmounts.plaintiff.map((x) => (
                  <div key={`p-${x.id}`} className="flex items-center justify-between">
                    <span>{x.name} ({formatILS(x.percent)}%)</span>
                    <span>₪ {formatILS(x.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mini-card">
              <div className="flex items-center justify-between">
                <span className="font-semibold">תרחיש נתבע</span>
                <span className="badge-muted">₪ {formatILS(after.defendant.afterAll)}</span>
              </div>
              <div className="mt-2 space-y-1 text-xs text-slate">
                {defendantAmounts.defendant.map((x) => (
                  <div key={`d-${x.id}`} className="flex items-center justify-between">
                    <span>{x.name} ({formatILS(x.percent)}%)</span>
                    <span>₪ {formatILS(x.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mini-card">
              <div className="flex items-center justify-between">
                <span className="font-semibold">תרחיש ממוצע</span>
                <span className="badge-warning">₪ {formatILS(after.avg.afterAll)}</span>
              </div>
              <div className="mt-2 space-y-1 text-xs text-slate">
                {defendantAmounts.avg.map((x) => (
                  <div key={`a-${x.id}`} className="flex items-center justify-between">
                    <span>{x.name} ({formatILS(x.percent)}%)</span>
                    <span>₪ {formatILS(x.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DamagesCalculator;


