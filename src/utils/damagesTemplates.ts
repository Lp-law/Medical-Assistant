import { storageGetItem, storageSetItem } from './storageGuard';

/** Template item for damages calculator. Sheet shape matches DamagesCalculator Sheet. */
export type TemplateItem = {
  id: string;
  name: string;
  color: string; // tailwind class or hex, e.g. 'bg-emerald-500' or '#10b981'
  sheet: {
    version: 3;
    title: string;
    rows: Array<{ id: string; enabled: boolean; name: string; kind: 'add' | 'deduct'; plaintiff: number; defendant: number }>;
    contributoryNegligencePercent: number;
    reductions: Array<{ id: string; enabled: boolean; label: string; percent: number }>;
    defendants: Array<{ id: string; enabled: boolean; name: string; percent: number }>;
    attorneyFeePercent: number;
    plaintiffExpenses: number;
    updatedAt: string;
  };
};

const uid = (): string => Math.random().toString(16).slice(2) + Date.now().toString(16);

/** Built-in templates by case type. IDs are fixed; sheets get new ids when applied. */
export function getBuiltInTemplates(): TemplateItem[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'builtin-orthopedic',
      name: 'נזק אורטופדי',
      color: '#0ea5e9',
      sheet: {
        version: 3,
        title: 'נזק אורטופדי',
        rows: [
          { id: uid(), enabled: true, name: 'כאב וסבל', kind: 'add', plaintiff: 0, defendant: 0 },
          { id: uid(), enabled: true, name: 'עזרת צד ג׳', kind: 'add', plaintiff: 0, defendant: 0 },
          { id: uid(), enabled: true, name: 'הוצאות רפואיות', kind: 'add', plaintiff: 0, defendant: 0 },
          { id: uid(), enabled: true, name: 'הפסדי שכר', kind: 'add', plaintiff: 0, defendant: 0 },
          { id: uid(), enabled: true, name: 'ניידות', kind: 'add', plaintiff: 0, defendant: 0 },
          { id: uid(), enabled: true, name: 'מל״ל', kind: 'deduct', plaintiff: 0, defendant: 0 },
        ],
        contributoryNegligencePercent: 0,
        reductions: [
          { id: uid(), enabled: true, label: 'פגיעה בסיכויי החלמה (%)', percent: 0 },
        ],
        defendants: [{ id: uid(), enabled: true, name: 'נתבע 1', percent: 100 }],
        attorneyFeePercent: 0,
        plaintiffExpenses: 0,
        updatedAt: now,
      },
    },
    {
      id: 'builtin-dental',
      name: 'תביעת שיניים',
      color: '#8b5cf6',
      sheet: {
        version: 3,
        title: 'תביעת שיניים',
        rows: [
          { id: uid(), enabled: true, name: 'כאב וסבל', kind: 'add', plaintiff: 0, defendant: 0 },
          { id: uid(), enabled: true, name: 'הוצאות רפואיות / טיפולי שיניים', kind: 'add', plaintiff: 0, defendant: 0 },
          { id: uid(), enabled: true, name: 'הפסדי שכר', kind: 'add', plaintiff: 0, defendant: 0 },
          { id: uid(), enabled: true, name: 'מל״ל', kind: 'deduct', plaintiff: 0, defendant: 0 },
        ],
        contributoryNegligencePercent: 0,
        reductions: [
          { id: uid(), enabled: true, label: 'פגיעה בסיכויי החלמה (%)', percent: 0 },
        ],
        defendants: [{ id: uid(), enabled: true, name: 'נתבע 1', percent: 100 }],
        attorneyFeePercent: 0,
        plaintiffExpenses: 0,
        updatedAt: now,
      },
    },
    {
      id: 'builtin-cancer-delay',
      name: 'איחור בגילוי סרטן',
      color: '#dc2626',
      sheet: {
        version: 3,
        title: 'איחור בגילוי סרטן',
        rows: [
          { id: uid(), enabled: true, name: 'כאב וסבל', kind: 'add', plaintiff: 0, defendant: 0 },
          { id: uid(), enabled: true, name: 'עזרת צד ג׳', kind: 'add', plaintiff: 0, defendant: 0 },
          { id: uid(), enabled: true, name: 'הוצאות רפואיות', kind: 'add', plaintiff: 0, defendant: 0 },
          { id: uid(), enabled: true, name: 'הפסדי שכר', kind: 'add', plaintiff: 0, defendant: 0 },
          { id: uid(), enabled: true, name: 'מל״ל', kind: 'deduct', plaintiff: 0, defendant: 0 },
        ],
        contributoryNegligencePercent: 0,
        reductions: [
          { id: uid(), enabled: true, label: 'פגיעה בסיכויי החלמה (%)', percent: 0 },
        ],
        defendants: [{ id: uid(), enabled: true, name: 'נתבע 1', percent: 100 }],
        attorneyFeePercent: 0,
        plaintiffExpenses: 0,
        updatedAt: now,
      },
    },
    {
      id: 'builtin-road-accident',
      name: 'תאונת דרכים',
      color: '#059669',
      sheet: {
        version: 3,
        title: 'תאונת דרכים',
        rows: [
          { id: uid(), enabled: true, name: 'כאב וסבל', kind: 'add', plaintiff: 0, defendant: 0 },
          { id: uid(), enabled: true, name: 'עזרת צד ג׳', kind: 'add', plaintiff: 0, defendant: 0 },
          { id: uid(), enabled: true, name: 'הוצאות רפואיות', kind: 'add', plaintiff: 0, defendant: 0 },
          { id: uid(), enabled: true, name: 'הפסדי שכר', kind: 'add', plaintiff: 0, defendant: 0 },
          { id: uid(), enabled: true, name: 'ניידות', kind: 'add', plaintiff: 0, defendant: 0 },
          { id: uid(), enabled: true, name: 'מל״ל', kind: 'deduct', plaintiff: 0, defendant: 0 },
        ],
        contributoryNegligencePercent: 0,
        reductions: [
          { id: uid(), enabled: true, label: 'פגיעה בסיכויי החלמה (%)', percent: 0 },
        ],
        defendants: [{ id: uid(), enabled: true, name: 'נתבע 1', percent: 100 }],
        attorneyFeePercent: 0,
        plaintiffExpenses: 0,
        updatedAt: now,
      },
    },
    {
      id: 'builtin-general',
      name: 'מחשבון כללי',
      color: '#64748b',
      sheet: {
        version: 3,
        title: 'מחשבון נזק',
        rows: [
          { id: uid(), enabled: true, name: 'כאב וסבל', kind: 'add', plaintiff: 0, defendant: 0 },
          { id: uid(), enabled: true, name: 'עזרת צד ג׳', kind: 'add', plaintiff: 0, defendant: 0 },
          { id: uid(), enabled: true, name: 'הוצאות רפואיות', kind: 'add', plaintiff: 0, defendant: 0 },
          { id: uid(), enabled: true, name: 'הפסדי שכר', kind: 'add', plaintiff: 0, defendant: 0 },
          { id: uid(), enabled: true, name: 'ניידות', kind: 'add', plaintiff: 0, defendant: 0 },
          { id: uid(), enabled: true, name: 'התאמות דיור', kind: 'add', plaintiff: 0, defendant: 0 },
          { id: uid(), enabled: true, name: 'מל״ל', kind: 'deduct', plaintiff: 0, defendant: 0 },
        ],
        contributoryNegligencePercent: 0,
        reductions: [
          { id: uid(), enabled: true, label: 'פגיעה בסיכויי החלמה (%)', percent: 0 },
        ],
        defendants: [{ id: uid(), enabled: true, name: 'נתבע 1', percent: 100 }],
        attorneyFeePercent: 0,
        plaintiffExpenses: 0,
        updatedAt: now,
      },
    },
  ];
}

const STORAGE_KEY_TEMPLATES = 'calc_templates_v1';

export function getSavedTemplates(): TemplateItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = storageGetItem(STORAGE_KEY_TEMPLATES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTemplate(item: TemplateItem): void {
  const list = getSavedTemplates().filter((t) => t.id !== item.id);
  list.push(item);
  storageSetItem(STORAGE_KEY_TEMPLATES, JSON.stringify(list));
}

export function deleteSavedTemplate(id: string): void {
  const list = getSavedTemplates().filter((t) => t.id !== id);
  storageSetItem(STORAGE_KEY_TEMPLATES, JSON.stringify(list));
}

/** Regenerate all ids in a sheet so it can be applied without id clashes. */
export function cloneSheetWithNewIds<T extends { rows?: Array<{ id: string }>; reductions?: Array<{ id: string }>; defendants?: Array<{ id: string }> }>(sheet: T): T {
  return {
    ...sheet,
    rows: sheet.rows?.map((r) => ({ ...r, id: uid() })) ?? [],
    reductions: sheet.reductions?.map((r) => ({ ...r, id: uid() })) ?? [],
    defendants: sheet.defendants?.map((d) => ({ ...d, id: uid() })) ?? [],
    updatedAt: new Date().toISOString(),
  } as T;
}
