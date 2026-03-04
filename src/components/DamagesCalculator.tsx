import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Plus, Trash2, Upload, RotateCcw, Undo2, Redo2, LayoutTemplate, FileText, X } from 'lucide-react';
import { storageGetItem, storageSetItem } from '../utils/storageGuard';
import { getBuiltInTemplates, getSavedTemplates, saveTemplate, deleteSavedTemplate, cloneSheetWithNewIds, type TemplateItem } from '../utils/damagesTemplates';
import { exportDamagesToDocx } from '../utils/exportDamagesDocx';

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
  attorneyFeePercent: number; // אחוז שכ"ט ב"כ התובע (0–100), מחושב מסה"כ נטו
  plaintiffExpenses: number; // הוצאות תובע (₪)
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

// שורות שהוסרו מהמערכת – מסירים גם מנתונים שמורים (localStorage)
const REMOVED_ROW_NAMES_NORMALIZED = [
  normalizeHebrewKey('אורתופד'),
  normalizeHebrewKey('הוצאות עודפות בגין נסיעות לחו"ל'),
];

const isRemovedRow = (name: string): boolean =>
  REMOVED_ROW_NAMES_NORMALIZED.includes(normalizeHebrewKey(name));

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
  { id: uid(), enabled: true, name: 'הפסדי שכר', kind: 'add', plaintiff: 0, defendant: 0 },
  { id: uid(), enabled: true, name: 'ניידות', kind: 'add', plaintiff: 0, defendant: 0 },
  { id: uid(), enabled: true, name: 'התאמות דיור', kind: 'add', plaintiff: 0, defendant: 0 },
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
  attorneyFeePercent: 0,
  plaintiffExpenses: 0,
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

/** Max size for JSON import (2MB). */
const MAX_IMPORT_JSON_BYTES = 2 * 1024 * 1024;

/** Basic validation for imported JSON structure (v1/v2/v3). */
const validateImportedSheet = (parsed: unknown): parsed is { version: number; title?: unknown; rows?: unknown; reductions?: unknown; defendants?: unknown; contributoryNegligencePercent?: unknown; attorneyFeePercent?: unknown; plaintiffExpenses?: unknown; adjustments?: unknown } => {
  if (!parsed || typeof parsed !== 'object') return false;
  const o = parsed as Record<string, unknown>;
  const v = o.version;
  if (v !== 1 && v !== 2 && v !== 3) return false;
  if (v === 3 || v === 2) {
    if (o.rows !== undefined && !Array.isArray(o.rows)) return false;
    if (o.reductions !== undefined && !Array.isArray(o.reductions)) return false;
    if (o.defendants !== undefined && !Array.isArray(o.defendants)) return false;
  }
  if (v === 1 && o.adjustments !== undefined && !Array.isArray(o.adjustments)) return false;
  return true;
};

const MAX_UNDO = 50;

const DamagesCalculator: React.FC = () => {
  const importRef = useRef<HTMLInputElement | null>(null);
  const [storageSaveError, setStorageSaveError] = useState<string | null>(null);
  const [past, setPast] = useState<Sheet[]>([]);
  const [future, setFuture] = useState<Sheet[]>([]);
  const [templateLibraryOpen, setTemplateLibraryOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateColor, setNewTemplateColor] = useState('#0ea5e9');
  const [savedTemplates, setSavedTemplates] = useState<TemplateItem[]>(() => getSavedTemplates());

  const pastRef = useRef<Sheet[]>([]);
  const futureRef = useRef<Sheet[]>([]);
  const [, setHistoryVersion] = useState(0);

  const pushHistory = useCallback((current: Sheet) => {
    pastRef.current = [...pastRef.current, current].slice(-MAX_UNDO);
    futureRef.current = [];
    setPast(pastRef.current);
    setFuture([]);
    setHistoryVersion((v) => v + 1);
  }, []);

  const setSheetWithHistory = useCallback((next: Sheet | ((prev: Sheet) => Sheet)) => {
    setSheet((prev) => {
      const nextSheet = typeof next === 'function' ? next(prev) : next;
      pushHistory(prev);
      return nextSheet;
    });
  }, [pushHistory]);

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return;
    setSheet((current) => {
      const last = pastRef.current.pop()!;
      futureRef.current = [current, ...futureRef.current];
      setPast([...pastRef.current]);
      setFuture([...futureRef.current]);
      setHistoryVersion((v) => v + 1);
      return last;
    });
  }, []);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    setSheet((current) => {
      const first = futureRef.current.shift()!;
      pastRef.current = [...pastRef.current, current];
      setPast([...pastRef.current]);
      setFuture([...futureRef.current]);
      setHistoryVersion((v) => v + 1);
      return first;
    });
  }, []);

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
            ? (parsed.rows as any[])
                .filter((r) => !isRemovedRow(String(r.name ?? '')))
                .map((r) => ({
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
          attorneyFeePercent: clampPercent(safeNumber((parsed as any).attorneyFeePercent)),
          plaintiffExpenses: safeNumber((parsed as any).plaintiffExpenses),
          updatedAt: String(parsed.updatedAt ?? new Date().toISOString()),
        };
      }
      // v2
      if ((parsed as any).version === 2) {
        return {
          version: 3,
          title: String(parsed.title ?? 'מחשבון נזק'),
          rows: Array.isArray(parsed.rows)
            ? (parsed.rows as any[])
                .filter((r) => !isRemovedRow(String(r.name ?? '')))
                .map((r) => ({
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
          attorneyFeePercent: clampPercent(safeNumber((parsed as any).attorneyFeePercent)),
          plaintiffExpenses: safeNumber((parsed as any).plaintiffExpenses),
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
            ? (parsed.rows as any[])
                .filter((r) => !isRemovedRow(String(r.name ?? '')))
                .map((r) => ({
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
          attorneyFeePercent: 0,
          plaintiffExpenses: 0,
          updatedAt: new Date().toISOString(),
        };
      }

      return defaultSheet();
    } catch {
      return defaultSheet();
    }
  });

  useEffect(() => {
    setStorageSaveError(null);
    try {
      const next: Sheet = { ...sheet, updatedAt: new Date().toISOString() };
      storageSetItem(STORAGE_KEY_V3, JSON.stringify(next));
    } catch (e) {
      const msg =
        typeof e === 'object' && e !== null && (e as DOMException).name === 'QuotaExceededError'
          ? 'אין מקום פנוי באחסון המקומי – נא לפנות מקום או לייצא גיבוי.'
          : 'שמירה מקומית נכשלה.';
      setStorageSaveError(msg);
    }
    // Persist only when these fields change; full `sheet` would trigger on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet.title, sheet.rows, sheet.contributoryNegligencePercent, sheet.reductions, sheet.defendants, sheet.attorneyFeePercent, sheet.plaintiffExpenses]);

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

  const attorneyFeeAndGross = useMemo(() => {
    const pct = clampPercent(sheet.attorneyFeePercent) / 100;
    const attorneyFeePlaintiff = totals.plaintiffNet * pct;
    const attorneyFeeAvg = totals.avgNet * pct;
    const expenses = safeNumber(sheet.plaintiffExpenses);
    return {
      attorneyFeePlaintiff,
      attorneyFeeDefendant: 0,
      attorneyFeeAvg,
      plaintiffExpenses: expenses,
      grossPlaintiff: totals.plaintiffNet + attorneyFeePlaintiff + expenses,
      grossDefendant: totals.defendantNet,
      grossAvg: totals.avgNet + attorneyFeeAvg + expenses,
    };
  }, [sheet.attorneyFeePercent, sheet.plaintiffExpenses, totals.plaintiffNet, totals.defendantNet, totals.avgNet]);

  const updateRow = (id: string, patch: Partial<HeadRow>) => {
    setSheetWithHistory((prev) => ({
      ...prev,
      rows: prev.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  };

  const removeRow = (id: string) => setSheetWithHistory((prev) => ({ ...prev, rows: prev.rows.filter((r) => r.id !== id) }));

  const addRow = () =>
    setSheetWithHistory((prev) => ({
      ...prev,
      rows: [
        ...prev.rows,
        { id: uid(), enabled: true, name: 'ראש נזק חדש', kind: 'add', plaintiff: 0, defendant: 0 },
      ],
    }));

  const updateReduction = (id: string, patch: Partial<Reduction>) => {
    setSheetWithHistory((prev) => ({
      ...prev,
      reductions: prev.reductions.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  };

  const removeReduction = (id: string) =>
    setSheetWithHistory((prev) => ({ ...prev, reductions: prev.reductions.filter((r) => r.id !== id) }));

  const addReduction = () =>
    setSheetWithHistory((prev) => ({
      ...prev,
      reductions: [...prev.reductions, { id: uid(), enabled: true, label: 'הפחתה נוספת (%)', percent: 0 }],
    }));

  const reset = () => setSheetWithHistory((prev) => ({ ...defaultSheet(), title: prev.title }));

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
    lines.push([quote('שכ״ט ב״כ התובע'), quote(attorneyFeeAndGross.attorneyFeePlaintiff), quote(attorneyFeeAndGross.attorneyFeeDefendant), quote(attorneyFeeAndGross.attorneyFeeAvg)].join(','));
    lines.push([quote('הוצאות תובע'), quote(attorneyFeeAndGross.plaintiffExpenses), quote(0), quote(attorneyFeeAndGross.plaintiffExpenses)].join(','));
    lines.push([quote('סה״כ ברוטו'), quote(attorneyFeeAndGross.grossPlaintiff), quote(attorneyFeeAndGross.grossDefendant), quote(attorneyFeeAndGross.grossAvg)].join(','));
    lines.push('');
    lines.push([quote('אחוז שכ״ט (%)'), quote(sheet.attorneyFeePercent)].join(','));
    lines.push([quote('הוצאות תובע (₪)'), quote(sheet.plaintiffExpenses)].join(','));
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
    if (file.size > MAX_IMPORT_JSON_BYTES) {
      throw new Error(`קובץ גדול מדי (עד ${MAX_IMPORT_JSON_BYTES / 1024 / 1024} MB).`);
    }
    const text = await file.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('קובץ JSON לא תקין.');
    }
    if (!validateImportedSheet(parsed)) {
      throw new Error('מבנה הקובץ לא נתמך (נדרשת גרסה 1, 2 או 3 של מחשבון הנזק).');
    }
    const p = parsed as { version: number; title?: unknown; rows?: unknown[]; reductions?: unknown[]; defendants?: unknown[]; contributoryNegligencePercent?: unknown; attorneyFeePercent?: unknown; plaintiffExpenses?: unknown; updatedAt?: unknown; adjustments?: unknown[] };
    if (p.version === 3) {
      setSheet({
        version: 3,
        title: String(p.title ?? 'מחשבון נזק'),
        rows: Array.isArray(p.rows)
          ? p.rows.map((r: Record<string, unknown>) => ({
              id: String(r.id ?? uid()),
              enabled: Boolean(r.enabled ?? true),
              name: String(r.name ?? ''),
              kind: (r.kind === 'deduct' || r.kind === 'add') ? r.kind : inferRowKind(String(r.name ?? '')),
              plaintiff: safeNumber(r.plaintiff),
              defendant: safeNumber(r.defendant),
            }))
          : [],
        contributoryNegligencePercent: clampPercent(safeNumber(p.contributoryNegligencePercent)),
        reductions: Array.isArray(p.reductions)
          ? p.reductions.map((r: Record<string, unknown>) => ({
              id: String(r.id ?? uid()),
              enabled: Boolean(r.enabled ?? true),
              label: String(r.label ?? ''),
              percent: clampPercent(safeNumber(r.percent)),
            }))
          : [],
        defendants: Array.isArray(p.defendants)
          ? p.defendants.map((d: Record<string, unknown>) => ({
              id: String(d.id ?? uid()),
              enabled: Boolean(d.enabled ?? true),
              name: String(d.name ?? 'נתבע'),
              percent: clampPercent(safeNumber(d.percent)),
            }))
          : DEFAULT_DEFENDANTS,
        attorneyFeePercent: clampPercent(safeNumber(p.attorneyFeePercent)),
        plaintiffExpenses: safeNumber(p.plaintiffExpenses),
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    if (p.version === 2) {
      setSheet({
        version: 3,
        title: String(p.title ?? 'מחשבון נזק'),
        rows: Array.isArray(p.rows)
          ? p.rows.map((r: Record<string, unknown>) => ({
              id: String(r.id ?? uid()),
              enabled: Boolean(r.enabled ?? true),
              name: String(r.name ?? ''),
              kind: inferRowKind(String(r.name ?? '')),
              plaintiff: safeNumber(r.plaintiff),
              defendant: safeNumber(r.defendant),
            }))
          : [],
        contributoryNegligencePercent: clampPercent(safeNumber(p.contributoryNegligencePercent)),
        reductions: Array.isArray(p.reductions)
          ? p.reductions.map((r: Record<string, unknown>) => ({
              id: String(r.id ?? uid()),
              enabled: Boolean(r.enabled ?? true),
              label: String(r.label ?? ''),
              percent: clampPercent(safeNumber(r.percent)),
            }))
          : [],
        defendants: Array.isArray(p.defendants)
          ? p.defendants.map((d: Record<string, unknown>) => ({
              id: String(d.id ?? uid()),
              enabled: Boolean(d.enabled ?? true),
              name: String(d.name ?? 'נתבע'),
              percent: clampPercent(safeNumber(d.percent)),
            }))
          : DEFAULT_DEFENDANTS,
        attorneyFeePercent: clampPercent(safeNumber(p.attorneyFeePercent)),
        plaintiffExpenses: safeNumber(p.plaintiffExpenses),
        updatedAt: new Date().toISOString(),
      });
      return;
    }
    if (p.version === 1) {
      const v1Adjustments = Array.isArray(p.adjustments) ? p.adjustments : [];
      const contributory = (v1Adjustments as Record<string, unknown>[]).find((a) => String(a?.label ?? '').includes('אשם'))?.percent ?? 0;
      const lossChance = (v1Adjustments as Record<string, unknown>[]).find((a) => String(a?.label ?? '').includes('סיכויי'))?.percent ?? 0;
      setSheet({
        version: 3,
        title: String(p.title ?? 'מחשבון נזק'),
        rows: Array.isArray(p.rows)
          ? (p.rows as Record<string, unknown>[])
              .filter((r) => !isRemovedRow(String(r.name ?? '')))
              .map((r) => ({
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
        attorneyFeePercent: 0,
        plaintiffExpenses: 0,
        updatedAt: new Date().toISOString(),
      });
      return;
    }
    throw new Error('קובץ לא נתמך (גרסה שונה).');
  };

  const updateDefendant = (id: string, patch: Partial<DefendantShare>) => {
    setSheetWithHistory((prev) => ({
      ...prev,
      defendants: prev.defendants.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    }));
  };

  const removeDefendant = (id: string) =>
    setSheetWithHistory((prev) => ({ ...prev, defendants: prev.defendants.filter((d) => d.id !== id) }));

  const addDefendant = () =>
    setSheetWithHistory((prev) => ({
      ...prev,
      defendants: [...prev.defendants, { id: uid(), enabled: true, name: `נתבע ${prev.defendants.length + 1}`, percent: 0 }],
    }));

  const activeDefendants = useMemo(() => sheet.defendants.filter((d) => d.enabled), [sheet.defendants]);
  const defendantsPercentSum = useMemo(() => sum(activeDefendants.map((d) => d.percent)), [activeDefendants]);

  const validationWarnings = useMemo(() => {
    const w: string[] = [];
    if (Math.abs(defendantsPercentSum - 100) > 0.01) {
      w.push(`סכום אחוזי הנתבעים הוא ${defendantsPercentSum.toFixed(1)}% (מומלץ 100%).`);
    }
    const maxRow = Math.max(...sheet.rows.map((r) => Math.max(r.plaintiff, r.defendant)), 0);
    if (maxRow > 50_000_000) {
      w.push('קיים סכום חריג בשורה (מעל 50 מיליון ₪). וודא שהערכים נכונים.');
    }
    const totalNet = totals.plaintiffNet + totals.defendantNet;
    if (totalNet > 100_000_000) {
      w.push('סה״כ נטו חריג (מעל 100 מיליון ₪). וודא שהערכים נכונים.');
    }
    return w;
  }, [defendantsPercentSum, sheet.rows, totals.plaintiffNet, totals.defendantNet]);

  const applyTemplate = (t: TemplateItem) => {
    const cloned = cloneSheetWithNewIds(t.sheet) as Sheet;
    setSheet(cloned);
    setTemplateLibraryOpen(false);
  };

  const handleSaveAsTemplate = () => {
    const name = newTemplateName.trim() || sheet.title || 'תבנית חדשה';
    const id = `saved-${Date.now()}`;
    saveTemplate({
      id,
      name,
      color: newTemplateColor,
      sheet: { ...sheet, updatedAt: new Date().toISOString() },
    });
    setSavedTemplates(getSavedTemplates());
    setSaveTemplateOpen(false);
    setNewTemplateName('');
  };

  const exportDocx = () => {
    exportDamagesToDocx(sheet, totals, after, attorneyFeeAndGross).catch((e) => {
      alert(e?.message ?? 'ייצוא DOCX נכשל');
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
        } else if (e.key === 'y') {
          e.preventDefault();
          redo();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

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
          <button type="button" className="btn-outline text-sm px-4 py-2" onClick={undo} disabled={past.length === 0} title="בטל (Ctrl+Z)">
            <Undo2 className="w-4 h-4" />
            בטל
          </button>
          <button type="button" className="btn-outline text-sm px-4 py-2" onClick={redo} disabled={future.length === 0} title="בצע שוב">
            <Redo2 className="w-4 h-4" />
            בצע שוב
          </button>
          <button type="button" className="btn-outline text-sm px-4 py-2" onClick={() => setTemplateLibraryOpen(true)}>
            <LayoutTemplate className="w-4 h-4" />
            תבניות
          </button>
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
          <button type="button" className="btn-outline text-sm px-4 py-2" onClick={exportDocx}>
            <FileText className="w-4 h-4" />
            ייצוא DOCX
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

      {storageSaveError && (
        <div className="rounded-card border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800" role="alert">
          {storageSaveError}
        </div>
      )}

      {validationWarnings.length > 0 && (
        <div className="rounded-card border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
          <p className="font-semibold mb-1">אזהרות אימות</p>
          <ul className="list-disc list-inside">
            {validationWarnings.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

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
              onChange={(e) => setSheetWithHistory((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="לדוגמה: תיק פלוני"
            />
          </div>
        </div>
        <div className="card-underline" />

        <div className="card-body space-y-3">
          <div className="flex flex-wrap items-center gap-4 rounded-card border border-pearl bg-pearl/30 p-3">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-slate-light">אחוז שכ״ט ב״כ התובע (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                className="w-24 rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                value={sheet.attorneyFeePercent}
                onChange={(e) =>
                  setSheetWithHistory((prev) => ({ ...prev, attorneyFeePercent: clampPercent(safeNumber(e.target.value)) }))
                }
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-slate-light">הוצאות תובע (₪)</span>
              <input
                type="number"
                min={0}
                step={1}
                className="w-32 rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                value={sheet.plaintiffExpenses || ''}
                onChange={(e) =>
                  setSheet((prev) => ({ ...prev, plaintiffExpenses: Math.max(0, safeNumber(e.target.value)) }))
                }
              />
            </label>
          </div>
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
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); } if (e.key === 'Escape') (e.target as HTMLElement).blur(); }}
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-pearl">
                        <input
                          type="number"
                          className="w-44 rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                          value={r.plaintiff}
                          onChange={(e) => updateRow(r.id, { plaintiff: safeNumber(e.target.value) })}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); } if (e.key === 'Escape') (e.target as HTMLElement).blur(); }}
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-pearl">
                        <input
                          type="number"
                          className="w-44 rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                          value={r.defendant}
                          onChange={(e) => updateRow(r.id, { defendant: safeNumber(e.target.value) })}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); } if (e.key === 'Escape') (e.target as HTMLElement).blur(); }}
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
                <tr className="bg-pearl/30">
                  <td className="px-3 py-3" colSpan={3} />
                  <td className="px-3 py-3 font-semibold text-slate">שכ״ט ב״כ התובע</td>
                  <td className="px-3 py-3 font-semibold text-slate">{formatILS(attorneyFeeAndGross.attorneyFeePlaintiff)}</td>
                  <td className="px-3 py-3 font-semibold text-slate">{formatILS(attorneyFeeAndGross.attorneyFeeDefendant)}</td>
                  <td className="px-3 py-3 font-semibold text-slate">{formatILS(attorneyFeeAndGross.attorneyFeeAvg)}</td>
                  <td className="px-3 py-3" />
                </tr>
                <tr className="bg-pearl/30">
                  <td className="px-3 py-3" colSpan={3} />
                  <td className="px-3 py-3 font-semibold text-slate">הוצאות תובע</td>
                  <td className="px-3 py-3 font-semibold text-slate">{formatILS(attorneyFeeAndGross.plaintiffExpenses)}</td>
                  <td className="px-3 py-3 font-semibold text-slate">—</td>
                  <td className="px-3 py-3 font-semibold text-slate">{formatILS(attorneyFeeAndGross.plaintiffExpenses)}</td>
                  <td className="px-3 py-3" />
                </tr>
                <tr>
                  <td className="px-3 py-3" />
                  <td className="px-3 py-3" />
                  <td className="px-3 py-3 font-bold bg-gold/20">סה״כ ברוטו</td>
                  <td className="px-3 py-3 font-bold bg-gold/20">{formatILS(attorneyFeeAndGross.grossPlaintiff)}</td>
                  <td className="px-3 py-3 font-bold bg-gold/20">{formatILS(attorneyFeeAndGross.grossDefendant)}</td>
                  <td className="px-3 py-3 font-bold bg-gold/20">{formatILS(attorneyFeeAndGross.grossAvg)}</td>
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
                      setSheetWithHistory((prev) => ({ ...prev, contributoryNegligencePercent: clampPercent(safeNumber(e.target.value)) }))
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
            <p className="text-sm font-semibold">תצוגה גרפית</p>
            <p className="text-xs text-slate-light">חלוקת סכומים – תובע / נתבע / ממוצע, וחלוקה בין נתבעים</p>
          </div>
        </div>
        <div className="card-underline" />
        <div className="card-body space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-light mb-2">תרחישים (לאחר הפחתות)</p>
            <div className="flex gap-4 items-end justify-end h-24" dir="ltr">
              <div className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-navy rounded-t min-h-[8px] transition-all"
                  style={{ height: `${Math.min(100, (after.plaintiff.afterAll / (Math.max(after.plaintiff.afterAll, after.defendant.afterAll, after.avg.afterAll, 1) || 1)) * 100)}%` }}
                  title={`תובע: ₪${formatILS(after.plaintiff.afterAll)}`}
                />
                <span className="text-[11px] text-slate">תובע</span>
              </div>
              <div className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-slate-400 rounded-t min-h-[8px] transition-all"
                  style={{ height: `${Math.min(100, (after.defendant.afterAll / (Math.max(after.plaintiff.afterAll, after.defendant.afterAll, after.avg.afterAll, 1) || 1)) * 100)}%` }}
                  title={`נתבע: ₪${formatILS(after.defendant.afterAll)}`}
                />
                <span className="text-[11px] text-slate">נתבע</span>
              </div>
              <div className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-gold rounded-t min-h-[8px] transition-all"
                  style={{ height: `${Math.min(100, (after.avg.afterAll / (Math.max(after.plaintiff.afterAll, after.defendant.afterAll, after.avg.afterAll, 1) || 1)) * 100)}%` }}
                  title={`ממוצע: ₪${formatILS(after.avg.afterAll)}`}
                />
                <span className="text-[11px] text-slate">ממוצע</span>
              </div>
            </div>
          </div>
          {activeDefendants.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-light mb-2">חלוקה בין נתבעים (תרחיש ממוצע)</p>
              <div className="flex h-8 rounded overflow-hidden border border-pearl" dir="ltr">
                {activeDefendants.map((d, i) => {
                  const pct = clampPercent(d.percent);
                  const colors = ['#0f766e', '#0369a1', '#7c2d12', '#4c1d95', '#15803d'];
                  const color = colors[i % colors.length];
                  return (
                    <div
                      key={d.id}
                      className="transition-all min-w-0"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                      title={`${d.name}: ${pct}%`}
                    />
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-3 mt-1 justify-end">
                {activeDefendants.map((d, i) => {
                  const colors = ['#0f766e', '#0369a1', '#7c2d12', '#4c1d95', '#15803d'];
                  return (
                    <span key={d.id} className="text-[11px] text-slate flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: colors[i % colors.length] }} />
                      {d.name} ({formatILS(d.percent)}%)
                    </span>
                  );
                })}
              </div>
            </div>
          )}
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

      {templateLibraryOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="ספריית תבניות">
          <div className="bg-white rounded-card shadow-card-xl border border-pearl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-pearl">
              <h3 className="text-lg font-semibold text-navy">ספריית תבניות</h3>
              <div className="flex gap-2">
                <button type="button" className="btn-outline text-sm px-3 py-1.5" onClick={() => { setSaveTemplateOpen(true); setTemplateLibraryOpen(false); }}>
                  שמור תבנית נוכחית
                </button>
                <button type="button" className="text-slate hover:text-navy" onClick={() => setTemplateLibraryOpen(false)} aria-label="סגור">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="overflow-auto p-5 space-y-6">
              <div>
                <p className="text-xs font-semibold text-slate-light mb-2">תבניות מובנות</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {getBuiltInTemplates().map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => applyTemplate(t)}
                      className="rounded-card border border-pearl bg-white p-4 text-right hover:shadow-card-xl transition flex items-center gap-3"
                    >
                      <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: t.color }} aria-hidden />
                      <span className="font-semibold text-navy">{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-light mb-2">התבניות שלי</p>
                {savedTemplates.length === 0 ? (
                  <p className="text-sm text-slate">אין תבניות שמורות. שמור את המחשבון הנוכחי כתבנית.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {savedTemplates.map((t) => (
                      <div key={t.id} className="rounded-card border border-pearl bg-white p-4 flex items-center justify-between gap-3">
                        <button type="button" onClick={() => applyTemplate(t)} className="flex items-center gap-3 flex-1 min-w-0 text-right">
                          <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: t.color }} aria-hidden />
                          <span className="font-semibold text-navy truncate">{t.name}</span>
                        </button>
                        <button
                          type="button"
                          className="btn-outline text-[11px] px-2 py-1 text-red-600 border-red-200"
                          onClick={() => { deleteSavedTemplate(t.id); setSavedTemplates(getSavedTemplates()); }}
                          aria-label="מחק תבנית"
                        >
                          מחק
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {saveTemplateOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="שמור כתבנית">
          <div className="bg-white rounded-card shadow-card-xl border border-pearl max-w-md w-full p-5">
            <h3 className="text-lg font-semibold text-navy mb-4">שמור תבנית</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-light mb-1">שם התבנית</label>
                <input
                  className="w-full rounded-card border border-pearl bg-white p-2 text-sm"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder={sheet.title || 'תבנית חדשה'}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-light mb-1">צבע (לזיהוי ויזואלי)</label>
                <div className="flex gap-2 items-center">
                  <input type="color" className="w-10 h-10 rounded border border-pearl cursor-pointer" value={newTemplateColor} onChange={(e) => setNewTemplateColor(e.target.value)} />
                  <span className="text-sm text-slate">{newTemplateColor}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <button type="button" className="btn-outline px-4 py-2" onClick={() => { setSaveTemplateOpen(false); setTemplateLibraryOpen(true); }}>
                ביטול
              </button>
              <button type="button" className="btn-primary px-4 py-2" onClick={handleSaveAsTemplate}>
                שמור
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DamagesCalculator;


