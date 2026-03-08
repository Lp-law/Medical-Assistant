import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Plus, Trash2, Upload, RotateCcw, Undo2, Redo2, LayoutTemplate, FileText, FileDown, X, Save } from 'lucide-react';
import { storageGetItem, storageSetItem } from '../utils/storageGuard';
import { getBuiltInTemplates, getSavedTemplates, saveTemplate, deleteSavedTemplate, cloneSheetWithNewIds, type TemplateItem } from '../utils/damagesTemplates';
import { exportDamagesToDocx } from '../utils/exportDamagesDocx';
import ExportForWordModal from './ExportForWordModal';
import type { ExportPayload } from '../utils/exportForWordHtml';
import { useLang } from '../context/LangContext';
import { calcNetTotals } from '../utils/netCalc';
import { t } from '../utils/calcI18n';
import SanityCheckPanel from './SanityCheckPanel';
import QuestionnaireModal from './QuestionnaireModal';
import ScenariosPanel from './ScenariosPanel';

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
  /** 'nii' = תגמולי מל"ל (amount in value); 'risk' = סיכון/פגיעה בסיכויי החלמה (%); default = percent */
  type?: 'percent' | 'nii' | 'risk';
  /** For type 'nii': amount in ₪ to deduct after contrib */
  value?: number;
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
  { id: uid(), enabled: true, label: 'פגיעה בסיכויי החלמה (%)', percent: 0, type: 'risk' },
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

/**
 * Normalize defendant percents so enabled ones sum to 100%.
 * Proportional scaling; rounds to 2 decimals and adjusts last to fix rounding.
 */
const normalizeDefendants = (defendants: DefendantShare[]): DefendantShare[] => {
  const enabled = defendants.filter((d) => d.enabled);
  const total = sum(enabled.map((d) => d.percent));
  if (enabled.length === 0) return defendants;
  if (total <= 0) {
    let first = true;
    return defendants.map((d) => {
      if (!d.enabled) return d;
      const p = first ? 100 : 0;
      first = false;
      return { ...d, percent: p };
    });
  }
  const scale = 100 / total;
  const updated = new Map<string, number>();
  let firstEnabledId: string | null = null;
  let running = 0;
  enabled.forEach((d) => {
    const p = Math.round(clampPercent(d.percent) * scale * 100) / 100;
    updated.set(d.id, p);
    running += p;
    if (firstEnabledId === null) firstEnabledId = d.id;
  });
  const diff = 100 - running;
  if (firstEnabledId != null && Math.abs(diff) > 0.001) {
    updated.set(firstEnabledId, clampPercent((updated.get(firstEnabledId) ?? 0) + diff));
  }
  return defendants.map((d) => (d.enabled && updated.has(d.id) ? { ...d, percent: updated.get(d.id)! } : d));
};

/** Uses single source of truth: contrib → NII (absolute) → risk %. */
function computeAfter(
  base: number,
  sheet: { contributoryNegligencePercent: number; reductions: Reduction[] }
): { afterContrib: number; afterAll: number; contribFactor: number; reductionsFactor: number } {
  const res = calcNetTotals(base, {
    contributoryNegligencePercent: sheet.contributoryNegligencePercent,
    reductions: sheet.reductions.map((r) => ({
      enabled: r.enabled,
      type: r.type,
      percent: r.percent,
      value: r.value,
      label: r.label,
    })),
  });
  const contribFactor = res.before > 0 ? res.afterContrib / res.before : 1;
  const reductionsFactor = res.afterContrib > 0 ? res.after / res.afterContrib : 0;
  return {
    afterContrib: res.afterContrib,
    afterAll: res.after,
    contribFactor,
    reductionsFactor,
  };
}

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

type ViewMode = 'full' | 'defendantOnly';
type ColumnId = 'claimant' | 'defendant' | 'average';

const DamagesCalculator: React.FC = () => {
  const importRef = useRef<HTMLInputElement | null>(null);
  const contribInputRef = useRef<HTMLInputElement | null>(null);
  const [storageSaveError, setStorageSaveError] = useState<string | null>(null);
  const [past, setPast] = useState<Sheet[]>([]);
  const [future, setFuture] = useState<Sheet[]>([]);
  const [templateLibraryOpen, setTemplateLibraryOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateColor, setNewTemplateColor] = useState('#0ea5e9');
  const [savedTemplates, setSavedTemplates] = useState<TemplateItem[]>(() => getSavedTemplates());
  const [viewMode, setViewMode] = useState<ViewMode>('full');

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
                type: r.type === 'nii' ? 'nii' : r.type === 'risk' ? 'risk' : undefined,
                value: r.type === 'nii' ? Math.max(0, safeNumber(r.value)) : undefined,
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
                type: r.type === 'nii' ? 'nii' : r.type === 'risk' ? 'risk' : undefined,
                value: r.type === 'nii' ? Math.max(0, safeNumber(r.value)) : undefined,
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
    // Order: Before → contrib → NII (absolute) → risk %. Defendants on final.
    const sheetForNet = { contributoryNegligencePercent: sheet.contributoryNegligencePercent, reductions: sheet.reductions };
    const plaintiff = computeAfter(totals.plaintiffNet, sheetForNet);
    const defendant = computeAfter(totals.defendantNet, sheetForNet);
    const avg = computeAfter(totals.avgNet, sheetForNet);
    return { plaintiff, defendant, avg };
  }, [sheet.contributoryNegligencePercent, sheet.reductions, totals.avgNet, totals.defendantNet, totals.plaintiffNet]);

  const activeColumns = useMemo((): ColumnId[] => {
    return viewMode === 'defendantOnly' ? ['defendant'] : ['claimant', 'defendant', 'average'];
  }, [viewMode]);

  const attorneyFeeAndGross = useMemo(() => {
    const pct = clampPercent(sheet.attorneyFeePercent) / 100;
    const expenses = safeNumber(sheet.plaintiffExpenses);
    const compensationNetPlaintiff = after.plaintiff.afterAll;
    const compensationNetDefendant = after.defendant.afterAll;
    const compensationNetAvg = after.avg.afterAll;
    const attorneyFeePlaintiff = Math.round(compensationNetPlaintiff * pct);
    const attorneyFeeDefendant = Math.round(compensationNetDefendant * pct);
    const attorneyFeeAvg = Math.round(compensationNetAvg * pct);
    return {
      attorneyFeePlaintiff,
      attorneyFeeDefendant,
      attorneyFeeAvg,
      plaintiffExpenses: expenses,
      compensationNetPlaintiff,
      compensationNetDefendant,
      compensationNetAvg,
      grossPlaintiff: compensationNetPlaintiff + attorneyFeePlaintiff + expenses,
      grossDefendant: compensationNetDefendant + attorneyFeeDefendant + expenses,
      grossAvg: compensationNetAvg + attorneyFeeAvg + expenses,
    };
  }, [sheet.attorneyFeePercent, sheet.plaintiffExpenses, after.plaintiff.afterAll, after.defendant.afterAll, after.avg.afterAll]);

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

  const addNiiReduction = () =>
    setSheetWithHistory((prev) => ({
      ...prev,
      reductions: [
        ...prev.reductions,
        { id: uid(), enabled: true, label: lang === 'he' ? 'מל״ל' : 'NII', percent: 0, type: 'nii' as const, value: 0 },
      ],
    }));

  const addRiskReduction = () =>
    setSheetWithHistory((prev) => ({
      ...prev,
      reductions: [
        ...prev.reductions,
        { id: uid(), enabled: true, label: lang === 'he' ? 'פגיעה בסיכויי החלמה (%)' : 'Loss of chance (%)', percent: 0, type: 'risk' as const },
      ],
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
              type: r.type === 'nii' ? 'nii' : r.type === 'risk' ? 'risk' : undefined,
              value: r.type === 'nii' ? Math.max(0, safeNumber(r.value)) : undefined,
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
              type: r.type === 'nii' ? 'nii' : r.type === 'risk' ? 'risk' : undefined,
              value: r.type === 'nii' ? Math.max(0, safeNumber(r.value)) : undefined,
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
    const currentLang = langRef.current;
    exportDamagesToDocx(sheet, totals, after, attorneyFeeAndGross, currentLang).catch((e) => {
      alert(e?.message ?? (currentLang === 'he' ? 'ייצוא DOCX נכשל' : 'DOCX export failed'));
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

  const { lang, setLang } = useLang();
  const langRef = useRef(lang);
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);
  const [exportForWordOpen, setExportForWordOpen] = useState(false);
  const [questionnaireOpen, setQuestionnaireOpen] = useState(false);
  const showColumn = (col: ColumnId): boolean => activeColumns.includes(col);
  const exportForWordPayload: ExportPayload = useMemo(
    () => ({
      sheet: {
        title: sheet.title,
        rows: sheet.rows,
        contributoryNegligencePercent: sheet.contributoryNegligencePercent,
        reductions: sheet.reductions,
        defendants: sheet.defendants,
        attorneyFeePercent: sheet.attorneyFeePercent,
        plaintiffExpenses: sheet.plaintiffExpenses,
      },
      totals,
      after,
      attorneyFeeAndGross,
      defendantAmounts,
      viewMode,
    }),
    [sheet, totals, after, attorneyFeeAndGross, defendantAmounts, viewMode]
  );

  const applySanityPatch = useCallback(
    (patch: { defendants?: typeof sheet.defendants; reductions?: typeof sheet.reductions }) => {
      setSheetWithHistory((prev) => ({ ...prev, ...patch }));
    },
    // sheet only used for typing; patch is applied to prev state
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setSheetWithHistory]
  );

  const applyQuestionnairePatch = useCallback(
    (patch: {
      contributoryNegligencePercent?: number;
      attorneyFeePercent?: number;
      plaintiffExpenses?: number;
      reductions?: typeof sheet.reductions;
      defendants?: typeof sheet.defendants;
    }) => {
      setSheetWithHistory((prev) => ({ ...prev, ...patch }));
    },
    // sheet only used for typing
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setSheetWithHistory]
  );

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        <aside className="md:w-56 shrink-0 rounded-card border border-pearl bg-white p-4 shadow-card-xl h-fit md:sticky md:top-4 space-y-5">
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-light uppercase tracking-wide">{t('sidebarActions', lang)}</h3>
            <div className="flex flex-col gap-1.5">
              <button type="button" className="btn-outline text-sm px-3 py-2 justify-start gap-2" onClick={addRow}>
                <Plus className="w-4 h-4 shrink-0" />
                {t('addDamageHead', lang)}
              </button>
              <button type="button" className="btn-outline text-sm px-3 py-2 justify-start gap-2" onClick={addReduction}>
                <Plus className="w-4 h-4 shrink-0" />
                {t('addDeduction', lang)}
              </button>
              <button type="button" className="btn-outline text-sm px-3 py-2 justify-start gap-2" onClick={addNiiReduction}>
                <Plus className="w-4 h-4 shrink-0" />
                {lang === 'he' ? 'מל״ל (סכום)' : 'NII (amount)'}
              </button>
              <button
                type="button"
                className="btn-outline text-sm px-3 py-2 justify-start gap-2"
                onClick={() => { contribInputRef.current?.focus(); contribInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }}
              >
                {t('contribNegPct', lang)}
              </button>
              <button type="button" className="btn-outline text-sm px-3 py-2 justify-start gap-2" onClick={addRiskReduction}>
                <Plus className="w-4 h-4 shrink-0" />
                {t('lossOfChancePct', lang)}
              </button>
              <button type="button" className="btn-outline text-sm px-3 py-2 justify-start gap-2" onClick={addDefendant}>
                <Plus className="w-4 h-4 shrink-0" />
                {t('addDefendant', lang)}
              </button>
            </div>
          </section>
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-light uppercase tracking-wide">{t('sidebarTemplates', lang)}</h3>
            <div className="flex flex-col gap-1.5">
              <button type="button" className="btn-outline text-sm px-3 py-2 justify-start gap-2" onClick={() => setTemplateLibraryOpen(true)}>
                <LayoutTemplate className="w-4 h-4 shrink-0" />
                {t('templates', lang)}
              </button>
              <button type="button" className="btn-outline text-sm px-3 py-2 justify-start gap-2" onClick={() => setSaveTemplateOpen(true)}>
                <Save className="w-4 h-4 shrink-0" />
                {t('saveAsTemplate', lang)}
              </button>
            </div>
          </section>
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-light uppercase tracking-wide">{t('sidebarHistory', lang)}</h3>
            <div className="flex flex-col gap-1.5">
              <button type="button" className="btn-outline text-sm px-3 py-2 justify-start gap-2" onClick={undo} disabled={past.length === 0} title="Ctrl+Z">
                <Undo2 className="w-4 h-4 shrink-0" />
                {t('undo', lang)}
              </button>
              <button type="button" className="btn-outline text-sm px-3 py-2 justify-start gap-2" onClick={redo} disabled={future.length === 0} title="Ctrl+Y">
                <Redo2 className="w-4 h-4 shrink-0" />
                {t('redo', lang)}
              </button>
            </div>
          </section>
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-light uppercase tracking-wide">{t('sidebarExport', lang)}</h3>
            <div className="flex flex-col gap-1.5">
              <button type="button" className="btn-outline text-sm px-3 py-2 justify-start gap-2" onClick={() => importRef.current?.click()}>
                <Upload className="w-4 h-4 shrink-0" />
                {t('importJson', lang)}
              </button>
              <button type="button" className="btn-outline text-sm px-3 py-2 justify-start gap-2" onClick={exportCsv}>
                <Download className="w-4 h-4 shrink-0" />
                {t('exportExcel', lang)}
              </button>
              <button type="button" className="btn-outline text-sm px-3 py-2 justify-start gap-2" onClick={exportJson}>
                <Download className="w-4 h-4 shrink-0" />
                {t('exportJson', lang)}
              </button>
              <button type="button" className="btn-outline text-sm px-3 py-2 justify-start gap-2" onClick={exportDocx}>
                <FileText className="w-4 h-4 shrink-0" />
                {t('exportDocx', lang)}
              </button>
              <button type="button" className="btn-outline text-sm px-3 py-2 justify-start gap-2" onClick={() => setExportForWordOpen(true)}>
                <FileDown className="w-4 h-4 shrink-0" />
                {t('exportWord', lang)}
              </button>
            </div>
          </section>
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-light uppercase tracking-wide">{t('sidebarTools', lang)}</h3>
            <div className="flex flex-col gap-1.5">
              <button type="button" className="btn-outline text-sm px-3 py-2 justify-start gap-2" onClick={reset}>
                <RotateCcw className="w-4 h-4 shrink-0" />
                {t('reset', lang)}
              </button>
              <button type="button" className="btn-outline text-sm px-3 py-2 justify-start gap-2" onClick={() => setQuestionnaireOpen(true)}>
                <FileText className="w-4 h-4 shrink-0" />
                {t('questionnaire', lang)}
              </button>
            </div>
          </section>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-hidden="true"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              importJson(f).catch((err: unknown) => {
                alert(err instanceof Error ? err.message : 'ייבוא נכשל');
              });
              e.target.value = '';
            }}
          />
        </aside>

        <main className="flex-1 min-w-0 space-y-6">
          <div className="rounded-card border border-pearl bg-white p-4 shadow-card-xl flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-lg font-semibold text-navy">מחשבון נזק</p>
                <span className="text-xs text-slate-light flex items-center gap-2">
                  <span>{lang === 'he' ? 'שפה:' : 'Language:'}</span>
                  <button
                    type="button"
                    onClick={() => setLang('he')}
                    className={`px-2 py-1 rounded text-xs font-medium ${lang === 'he' ? 'bg-navy text-gold' : 'bg-pearl text-slate'}`}
                  >
                    {t('hebrew', lang)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLang('en-GB')}
                    className={`px-2 py-1 rounded text-xs font-medium ${lang === 'en-GB' ? 'bg-navy text-gold' : 'bg-pearl text-slate'}`}
                  >
                    {t('english', lang)}
                  </button>
                </span>
              </div>
              <p className="text-xs text-slate-light">טבלה דינמית · תובע/נתבע/ממוצע · הפחתות באחוזים · שמירה מקומית</p>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <span className="text-xs text-slate-light">{lang === 'he' ? 'תצוגה:' : 'View:'}</span>
                <button
                  type="button"
                  onClick={() => setViewMode('full')}
                  className={`px-2 py-1 rounded text-xs font-medium ${viewMode === 'full' ? 'bg-navy text-gold' : 'bg-pearl text-slate'}`}
                >
                  {t('viewFull', lang)}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('defendantOnly')}
                  className={`px-2 py-1 rounded text-xs font-medium ${viewMode === 'defendantOnly' ? 'bg-navy text-gold' : 'bg-pearl text-slate'}`}
                >
                  {t('viewDefendantOnly', lang)}
                </button>
              </div>
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

      <SanityCheckPanel
        lang={lang}
        sheet={sheet}
        totals={totals}
        after={after}
        onApplyPatch={applySanityPatch}
      />

      <ScenariosPanel
        lang={lang}
        baseNets={{
          plaintiffNet: totals.plaintiffNet,
          defendantNet: totals.defendantNet,
          avgNet: totals.avgNet,
        }}
        sheetReductions={sheet.reductions}
      />

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
                  setSheetWithHistory((prev) => ({ ...prev, plaintiffExpenses: Math.max(0, safeNumber(e.target.value)) }))
                }
              />
            </label>
          </div>
          <div className="overflow-auto">
            <table className={`w-full text-sm border-separate border-spacing-0 ${viewMode === 'defendantOnly' ? 'min-w-[520px]' : 'min-w-[920px]'}`}>
              <thead>
                <tr className="text-slate-light">
                  <th className="text-right px-3 py-2 border-b border-pearl">כלול</th>
                  <th className="text-right px-3 py-2 border-b border-pearl">סוג</th>
                  <th className="text-right px-3 py-2 border-b border-pearl">ראש נזק</th>
                  {showColumn('claimant') && <th className="text-right px-3 py-2 border-b border-pearl">{t('claimant', lang)} (₪)</th>}
                  {showColumn('defendant') && <th className="text-right px-3 py-2 border-b border-pearl">{t('defendant', lang)} (₪)</th>}
                  {showColumn('average') && <th className="text-right px-3 py-2 border-b border-pearl">{t('average', lang)} (₪)</th>}
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
                      {showColumn('claimant') && (
                        <td className="px-3 py-2 border-b border-pearl">
                          <input
                            type="number"
                            className="w-44 rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                            value={r.plaintiff}
                            onChange={(e) => updateRow(r.id, { plaintiff: safeNumber(e.target.value) })}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); } if (e.key === 'Escape') (e.target as HTMLElement).blur(); }}
                          />
                        </td>
                      )}
                      {showColumn('defendant') && (
                        <td className="px-3 py-2 border-b border-pearl">
                          <input
                            type="number"
                            className="w-44 rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                            value={r.defendant}
                            onChange={(e) => updateRow(r.id, { defendant: safeNumber(e.target.value) })}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); } if (e.key === 'Escape') (e.target as HTMLElement).blur(); }}
                          />
                        </td>
                      )}
                      {showColumn('average') && (
                        <td className="px-3 py-2 border-b border-pearl">
                          <div className="w-44 rounded-card bg-pearl/60 border border-pearl p-2 text-sm text-navy">
                            {formatILS(avg)}
                          </div>
                        </td>
                      )}
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
                  {showColumn('claimant') && <td className="px-3 py-3 font-semibold">{formatILS(totals.plaintiffAdd)}</td>}
                  {showColumn('defendant') && <td className="px-3 py-3 font-semibold">{formatILS(totals.defendantAdd)}</td>}
                  {showColumn('average') && <td className="px-3 py-3 font-semibold">{formatILS(totals.avgAdd)}</td>}
                  <td className="px-3 py-3" />
                </tr>
                <tr>
                  <td className="px-3 py-3" />
                  <td className="px-3 py-3" />
                  <td className="px-3 py-3 font-semibold text-slate">קיזוזים (למשל מל״ל)</td>
                  {showColumn('claimant') && <td className="px-3 py-3 font-semibold text-slate">{formatILS(totals.plaintiffDeduct)}</td>}
                  {showColumn('defendant') && <td className="px-3 py-3 font-semibold text-slate">{formatILS(totals.defendantDeduct)}</td>}
                  {showColumn('average') && <td className="px-3 py-3 font-semibold text-slate">{formatILS(totals.avgDeduct)}</td>}
                  <td className="px-3 py-3" />
                </tr>
                <tr>
                  <td className="px-3 py-3" />
                  <td className="px-3 py-3" />
                  <td className="px-3 py-3 font-semibold">סה״כ נטו</td>
                  {showColumn('claimant') && <td className="px-3 py-3 font-semibold">{formatILS(totals.plaintiffNet)}</td>}
                  {showColumn('defendant') && <td className="px-3 py-3 font-semibold">{formatILS(totals.defendantNet)}</td>}
                  {showColumn('average') && <td className="px-3 py-3 font-semibold">{formatILS(totals.avgNet)}</td>}
                  <td className="px-3 py-3" />
                </tr>
                <tr className="bg-pearl/30">
                  <td className="px-3 py-3" colSpan={3}>{t('totalCompensationNet', lang)}</td>
                  {showColumn('claimant') && <td className="px-3 py-3 font-semibold text-slate">{formatILS(attorneyFeeAndGross.compensationNetPlaintiff)}</td>}
                  {showColumn('defendant') && <td className="px-3 py-3 font-semibold text-slate">{formatILS(attorneyFeeAndGross.compensationNetDefendant)}</td>}
                  {showColumn('average') && <td className="px-3 py-3 font-semibold text-slate">{formatILS(attorneyFeeAndGross.compensationNetAvg)}</td>}
                  <td className="px-3 py-3" />
                </tr>
                {/* שכ"ט והוצאות תובע מוצגים בכל תרחיש: תובע, נתבע, ממוצע */}
                <tr className="bg-pearl/30">
                  <td className="px-3 py-3 font-semibold text-slate" colSpan={3}>{t('plaintiffSolicitorFee', lang)} ({sheet.attorneyFeePercent}%)</td>
                  {showColumn('claimant') && <td className="px-3 py-3 font-semibold text-slate text-right" data-column="claimant">{formatILS(Number(attorneyFeeAndGross?.attorneyFeePlaintiff) || 0)}</td>}
                  {showColumn('defendant') && <td className="px-3 py-3 font-semibold text-slate text-right" data-column="defendant">{formatILS(Number(attorneyFeeAndGross?.attorneyFeeDefendant) || 0)}</td>}
                  {showColumn('average') && <td className="px-3 py-3 font-semibold text-slate text-right" data-column="average">{formatILS(Number(attorneyFeeAndGross?.attorneyFeeAvg) || 0)}</td>}
                  <td className="px-3 py-3" />
                </tr>
                <tr className="bg-pearl/30">
                  <td className="px-3 py-3 font-semibold text-slate" colSpan={3}>{t('plaintiffExpenses', lang)}</td>
                  {showColumn('claimant') && <td className="px-3 py-3 font-semibold text-slate text-right" data-column="claimant">{formatILS(Number(attorneyFeeAndGross?.plaintiffExpenses) || 0)}</td>}
                  {showColumn('defendant') && <td className="px-3 py-3 font-semibold text-slate text-right" data-column="defendant">{formatILS(Number(attorneyFeeAndGross?.plaintiffExpenses) || 0)}</td>}
                  {showColumn('average') && <td className="px-3 py-3 font-semibold text-slate text-right" data-column="average">{formatILS(Number(attorneyFeeAndGross?.plaintiffExpenses) || 0)}</td>}
                  <td className="px-3 py-3" />
                </tr>
                <tr>
                  <td className="px-3 py-3" />
                  <td className="px-3 py-3" />
                  <td className="px-3 py-3 font-bold bg-gold/20">{t('grandTotalPayable', lang)}</td>
                  {showColumn('claimant') && <td className="px-3 py-3 font-bold bg-gold/20 text-right" data-column="claimant">{formatILS(Number(attorneyFeeAndGross?.grossPlaintiff) || 0)}</td>}
                  {showColumn('defendant') && <td className="px-3 py-3 font-bold bg-gold/20 text-right" data-column="defendant">{formatILS(Number(attorneyFeeAndGross?.grossDefendant) || 0)}</td>}
                  {showColumn('average') && <td className="px-3 py-3 font-bold bg-gold/20 text-right" data-column="average">{formatILS(Number(attorneyFeeAndGross?.grossAvg) || 0)}</td>}
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
              <p className="text-sm font-semibold">הפחתות</p>
              <p className="text-xs text-slate-light">
                סדר החישוב: 1) אשם תורם (%) 2) מל״ל (סכום ₪) 3) סיכון/פגיעה בסיכויי החלמה (%) — אחר כך חלוקת נתבעים.
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
                    ref={contribInputRef}
                    id="contributory-negligence-percent"
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
              <div key={r.id} className="rounded-card border border-pearl bg-white p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    onChange={(e) => updateReduction(r.id, { enabled: e.target.checked })}
                    className="shrink-0"
                  />
                  <input
                    className="w-56 min-w-0 rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                    value={r.label}
                    onChange={(e) => updateReduction(r.id, { label: e.target.value })}
                  />
                  {r.type === 'nii' && <span className="text-xs text-slate-light shrink-0">(₪)</span>}
                </div>
                <div className="flex items-center gap-3 justify-end shrink-0">
                  <div className="flex items-center gap-2">
                    {r.type === 'nii' ? (
                      <>
                        <input
                          type="number"
                          min={0}
                          className="w-28 rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                          value={r.value ?? 0}
                          onChange={(e) => updateReduction(r.id, { value: Math.max(0, safeNumber(e.target.value)) })}
                        />
                        <span className="text-xs text-slate-light">₪</span>
                      </>
                    ) : (
                      <>
                        <input
                          type="number"
                          className="w-28 rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                          value={r.percent}
                          onChange={(e) => updateReduction(r.id, { percent: clampPercent(safeNumber(e.target.value)) })}
                        />
                        <span className="text-xs text-slate-light">%</span>
                      </>
                    )}
                  </div>
                  <button type="button" className="btn-outline text-[11px] px-3 py-1.5 shrink-0 inline-flex items-center gap-1.5" onClick={() => removeReduction(r.id)} aria-label="הסר הפחתה">
                    <Trash2 className="w-4 h-4 shrink-0" />
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
            {showColumn('claimant') && (
              <div className="mini-card">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{t('claimant', lang)}</span>
                  <span className="badge-strong">₪ {formatILS(after.plaintiff.afterAll)}</span>
                </div>
                <p className="text-xs text-slate-light mt-1">
                  נטו לפני: ₪ {formatILS(totals.plaintiffNet)} · אחרי אשם תורם: ₪ {formatILS(after.plaintiff.afterContrib)} · פקטור הפחתות: {after.plaintiff.reductionsFactor.toFixed(3)}
                </p>
              </div>
            )}
            {showColumn('defendant') && (
              <div className="mini-card">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{t('defendant', lang)}</span>
                  <span className="badge-muted">₪ {formatILS(after.defendant.afterAll)}</span>
                </div>
                <p className="text-xs text-slate-light mt-1">
                  נטו לפני: ₪ {formatILS(totals.defendantNet)} · אחרי אשם תורם: ₪ {formatILS(after.defendant.afterContrib)} · פקטור הפחתות: {after.defendant.reductionsFactor.toFixed(3)}
                </p>
              </div>
            )}
            {showColumn('average') && (
              <div className="mini-card">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{t('average', lang)}</span>
                  <span className="badge-warning">₪ {formatILS(after.avg.afterAll)}</span>
                </div>
                <p className="text-xs text-slate-light mt-1">
                  נטו לפני: ₪ {formatILS(totals.avgNet)} · אחרי אשם תורם: ₪ {formatILS(after.avg.afterContrib)} · פקטור הפחתות: {after.avg.reductionsFactor.toFixed(3)}
                </p>
              </div>
            )}
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
              {showColumn('claimant') && (
                <div className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-navy rounded-t min-h-[8px] transition-all"
                    style={{ height: `${Math.min(100, (after.plaintiff.afterAll / (Math.max(after.plaintiff.afterAll, after.defendant.afterAll, after.avg.afterAll, 1) || 1)) * 100)}%` }}
                    title={`${t('claimant', lang)}: ₪${formatILS(after.plaintiff.afterAll)}`}
                  />
                  <span className="text-[11px] text-slate">{t('claimant', lang)}</span>
                </div>
              )}
              {showColumn('defendant') && (
                <div className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-slate-400 rounded-t min-h-[8px] transition-all"
                    style={{ height: `${Math.min(100, (after.defendant.afterAll / (Math.max(after.plaintiff.afterAll, after.defendant.afterAll, after.avg.afterAll, 1) || 1)) * 100)}%` }}
                    title={`${t('defendant', lang)}: ₪${formatILS(after.defendant.afterAll)}`}
                  />
                  <span className="text-[11px] text-slate">{t('defendant', lang)}</span>
                </div>
              )}
              {showColumn('average') && (
                <div className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-gold rounded-t min-h-[8px] transition-all"
                    style={{ height: `${Math.min(100, (after.avg.afterAll / (Math.max(after.plaintiff.afterAll, after.defendant.afterAll, after.avg.afterAll, 1) || 1)) * 100)}%` }}
                    title={`${t('average', lang)}: ₪${formatILS(after.avg.afterAll)}`}
                  />
                  <span className="text-[11px] text-slate">{t('average', lang)}</span>
                </div>
              )}
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
          <div className="flex flex-wrap items-center gap-2">
            <span className={Math.abs(defendantsPercentSum - 100) <= 0.01 ? 'badge-info' : 'badge-warning'}>
              סה״כ אחוזים: {defendantsPercentSum.toFixed(1)}%
            </span>
            {Math.abs(defendantsPercentSum - 100) > 0.01 && activeDefendants.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  setSheetWithHistory((prev) => ({ ...prev, defendants: normalizeDefendants(prev.defendants) }))
                }
                className="btn-outline text-xs px-3 py-1.5"
              >
                נרמל ל-100%
              </button>
            )}
          </div>
        </div>
        <div className="card-underline" />
        <div className="card-body space-y-4">
          {Math.abs(defendantsPercentSum - 100) > 0.01 && activeDefendants.length > 0 && (
            <div className="rounded-card border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
              <p className="font-semibold">סכום אחוזי הנתבעים אינו 100% (כרגיל {defendantsPercentSum.toFixed(1)}%). לחץ &quot;נרמל ל-100%&quot; כדי לחלק מחדש באופן יחסי.</p>
            </div>
          )}
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
            {showColumn('claimant') && (
              <div className="mini-card">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{t('claimant', lang)}</span>
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
            )}
            {showColumn('defendant') && (
              <div className="mini-card">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{t('defendant', lang)}</span>
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
            )}
            {showColumn('average') && (
              <div className="mini-card">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{t('average', lang)}</span>
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
            )}
          </div>
        </div>
      </div>
        </main>
      </div>

      {exportForWordOpen && (
        <ExportForWordModal
          payload={exportForWordPayload}
          onClose={() => setExportForWordOpen(false)}
        />
      )}

      {questionnaireOpen && (
        <QuestionnaireModal
          lang={lang}
          sheet={sheet}
          onApplyPatch={applyQuestionnairePatch}
          onClose={() => setQuestionnaireOpen(false)}
        />
      )}

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
                          className="btn-outline text-[11px] px-2 py-1.5 text-red-600 border-red-200 inline-flex items-center gap-1.5 shrink-0"
                          onClick={() => { deleteSavedTemplate(t.id); setSavedTemplates(getSavedTemplates()); }}
                          aria-label={lang === 'he' ? 'מחק תבנית' : 'Delete template'}
                        >
                          <Trash2 className="w-4 h-4" />
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
              <button type="button" className="btn-outline px-4 py-2" onClick={() => setSaveTemplateOpen(false)}>
                {t('cancel', lang)}
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


