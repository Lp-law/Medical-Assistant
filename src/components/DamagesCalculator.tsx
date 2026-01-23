import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Plus, Trash2, Upload, RotateCcw } from 'lucide-react';
import { storageGetItem, storageSetItem } from '../utils/storageGuard';

type HeadRow = {
  id: string;
  enabled: boolean;
  name: string;
  plaintiff: number; // ₪
  defendant: number; // ₪
};

type Adjustment = {
  id: string;
  enabled: boolean;
  label: string;
  percent: number; // 0-100
};

type Sheet = {
  version: 1;
  title: string;
  rows: HeadRow[];
  adjustments: Adjustment[];
  updatedAt: string;
};

// Must NOT start with "lexmedical_" (blocked by storageGuard as PHI).
const STORAGE_KEY = 'calc_damages_v1';

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

const DEFAULT_ROWS: HeadRow[] = [
  { id: uid(), enabled: true, name: 'כאב וסבל', plaintiff: 900000, defendant: 800000 },
  { id: uid(), enabled: true, name: 'עזרת צד ג׳', plaintiff: 5385000, defendant: 2444444 },
  { id: uid(), enabled: true, name: 'הוצאות רפואיות', plaintiff: 850000, defendant: 150000 },
  { id: uid(), enabled: true, name: 'אורתופד', plaintiff: 250000, defendant: 150000 },
  { id: uid(), enabled: true, name: 'הפסדי שכר', plaintiff: 2400000, defendant: 2260848 },
  { id: uid(), enabled: true, name: 'ניידות', plaintiff: 1100000, defendant: 600000 },
  { id: uid(), enabled: true, name: 'התאמות דיור', plaintiff: 500000, defendant: 200000 },
  { id: uid(), enabled: true, name: 'הוצאות עודפות בגין נסיעות לחו״ל', plaintiff: 250000, defendant: 0 },
  { id: uid(), enabled: true, name: 'מל״ל', plaintiff: 3307021, defendant: 3307021 },
];

const DEFAULT_ADJUSTMENTS: Adjustment[] = [
  { id: uid(), enabled: true, label: 'אשם תורם (%)', percent: 0 },
  { id: uid(), enabled: true, label: 'פגיעה בסיכויי החלמה (%)', percent: 0 },
  { id: uid(), enabled: true, label: 'חלוקת אחריות לגורמים נוספים (%)', percent: 0 },
];

const defaultSheet = (): Sheet => ({
  version: 1,
  title: 'מחשבון נזק',
  rows: DEFAULT_ROWS,
  adjustments: DEFAULT_ADJUSTMENTS,
  updatedAt: new Date().toISOString(),
});

const calcAvg = (p: number, d: number): number => (safeNumber(p) + safeNumber(d)) / 2;

const sum = (values: number[]): number => values.reduce((acc, v) => acc + safeNumber(v), 0);

const applyAdjustments = (base: number, adjustments: Adjustment[]): { final: number; factor: number } => {
  const factor = adjustments
    .filter((a) => a.enabled)
    .reduce((acc, a) => acc * (1 - clampPercent(a.percent) / 100), 1);
  return { final: base * factor, factor };
};

const DamagesCalculator: React.FC = () => {
  const importRef = useRef<HTMLInputElement | null>(null);
  const [sheet, setSheet] = useState<Sheet>(() => {
    try {
      const raw = storageGetItem(STORAGE_KEY);
      if (!raw) return defaultSheet();
      const parsed = JSON.parse(raw) as Partial<Sheet>;
      if (parsed.version !== 1) return defaultSheet();
      return {
        version: 1,
        title: String(parsed.title ?? 'מחשבון נזק'),
        rows: Array.isArray(parsed.rows) ? (parsed.rows as any[]).map((r) => ({
          id: String(r.id ?? uid()),
          enabled: Boolean(r.enabled ?? true),
          name: String(r.name ?? ''),
          plaintiff: safeNumber(r.plaintiff),
          defendant: safeNumber(r.defendant),
        })) : DEFAULT_ROWS,
        adjustments: Array.isArray(parsed.adjustments) ? (parsed.adjustments as any[]).map((a) => ({
          id: String(a.id ?? uid()),
          enabled: Boolean(a.enabled ?? true),
          label: String(a.label ?? ''),
          percent: clampPercent(safeNumber(a.percent)),
        })) : DEFAULT_ADJUSTMENTS,
        updatedAt: String(parsed.updatedAt ?? new Date().toISOString()),
      };
    } catch {
      return defaultSheet();
    }
  });

  useEffect(() => {
    try {
      const next: Sheet = { ...sheet, updatedAt: new Date().toISOString() };
      storageSetItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet.title, sheet.rows, sheet.adjustments]);

  const activeRows = useMemo(() => sheet.rows.filter((r) => r.enabled), [sheet.rows]);

  const totals = useMemo(() => {
    const plaintiff = sum(activeRows.map((r) => r.plaintiff));
    const defendant = sum(activeRows.map((r) => r.defendant));
    const avg = sum(activeRows.map((r) => calcAvg(r.plaintiff, r.defendant)));
    return { plaintiff, defendant, avg };
  }, [activeRows]);

  const after = useMemo(() => {
    const plaintiff = applyAdjustments(totals.plaintiff, sheet.adjustments);
    const defendant = applyAdjustments(totals.defendant, sheet.adjustments);
    const avg = applyAdjustments(totals.avg, sheet.adjustments);
    return { plaintiff, defendant, avg };
  }, [sheet.adjustments, totals.avg, totals.defendant, totals.plaintiff]);

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
        { id: uid(), enabled: true, name: 'ראש נזק חדש', plaintiff: 0, defendant: 0 },
      ],
    }));

  const updateAdj = (id: string, patch: Partial<Adjustment>) => {
    setSheet((prev) => ({
      ...prev,
      adjustments: prev.adjustments.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  };

  const removeAdj = (id: string) =>
    setSheet((prev) => ({ ...prev, adjustments: prev.adjustments.filter((a) => a.id !== id) }));

  const addAdj = () =>
    setSheet((prev) => ({
      ...prev,
      adjustments: [...prev.adjustments, { id: uid(), enabled: true, label: 'הפחתה נוספת (%)', percent: 0 }],
    }));

  const reset = () => setSheet(defaultSheet());

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

  const importJson = async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text) as Partial<Sheet>;
    if (parsed.version !== 1) {
      throw new Error('קובץ לא נתמך (גרסה שונה).');
    }
    setSheet({
      version: 1,
      title: String(parsed.title ?? 'מחשבון נזק'),
      rows: Array.isArray(parsed.rows) ? (parsed.rows as any[]).map((r) => ({
        id: String(r.id ?? uid()),
        enabled: Boolean(r.enabled ?? true),
        name: String(r.name ?? ''),
        plaintiff: safeNumber(r.plaintiff),
        defendant: safeNumber(r.defendant),
      })) : [],
      adjustments: Array.isArray(parsed.adjustments) ? (parsed.adjustments as any[]).map((a) => ({
        id: String(a.id ?? uid()),
        enabled: Boolean(a.enabled ?? true),
        label: String(a.label ?? ''),
        percent: clampPercent(safeNumber(a.percent)),
      })) : [],
      updatedAt: new Date().toISOString(),
    });
  };

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
          <button type="button" className="btn-outline text-sm px-4 py-2" onClick={addAdj}>
            <Plus className="w-4 h-4" />
            הוסף הפחתה
          </button>
          <button type="button" className="btn-outline text-sm px-4 py-2" onClick={() => importRef.current?.click()}>
            <Upload className="w-4 h-4" />
            ייבוא JSON
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
                  <td className="px-3 py-3 font-semibold">סה״כ</td>
                  <td className="px-3 py-3 font-semibold">{formatILS(totals.plaintiff)}</td>
                  <td className="px-3 py-3 font-semibold">{formatILS(totals.defendant)}</td>
                  <td className="px-3 py-3 font-semibold">{formatILS(totals.avg)}</td>
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
                ההפחתות מוחלות בצורה מצטברת: מכפלה של \(1 - p/100\) לכל הפחתה פעילה.
              </p>
            </div>
          </div>
          <div className="card-underline" />
          <div className="card-body space-y-3">
            {sheet.adjustments.map((a) => (
              <div key={a.id} className="rounded-card border border-pearl bg-white p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={a.enabled}
                    onChange={(e) => updateAdj(a.id, { enabled: e.target.checked })}
                  />
                  <input
                    className="w-56 rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                    value={a.label}
                    onChange={(e) => updateAdj(a.id, { label: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2 justify-between sm:justify-end">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      className="w-28 rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                      value={a.percent}
                      onChange={(e) => updateAdj(a.id, { percent: clampPercent(safeNumber(e.target.value)) })}
                    />
                    <span className="text-xs text-slate-light">%</span>
                  </div>
                  <button type="button" className="btn-outline text-[11px] px-3 py-1.5" onClick={() => removeAdj(a.id)}>
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
                <span className="badge-strong">₪ {formatILS(after.plaintiff.final)}</span>
              </div>
              <p className="text-xs text-slate-light mt-1">
                לפני: ₪ {formatILS(totals.plaintiff)} · פקטור מצטבר: {after.plaintiff.factor.toFixed(3)}
              </p>
            </div>
            <div className="mini-card">
              <div className="flex items-center justify-between">
                <span className="font-semibold">תרחיש נתבע</span>
                <span className="badge-muted">₪ {formatILS(after.defendant.final)}</span>
              </div>
              <p className="text-xs text-slate-light mt-1">
                לפני: ₪ {formatILS(totals.defendant)} · פקטור מצטבר: {after.defendant.factor.toFixed(3)}
              </p>
            </div>
            <div className="mini-card">
              <div className="flex items-center justify-between">
                <span className="font-semibold">תרחיש ממוצע</span>
                <span className="badge-warning">₪ {formatILS(after.avg.final)}</span>
              </div>
              <p className="text-xs text-slate-light mt-1">
                לפני: ₪ {formatILS(totals.avg)} · פקטור מצטבר: {after.avg.factor.toFixed(3)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DamagesCalculator;


