/**
 * Deterministic gap detection and question generation for the damages calculator.
 * No LLM; mapsTo defines how answers become sheet patches.
 */

import { getBuiltInTemplates } from './damagesTemplates';

export type QuestionType = 'number' | 'percent' | 'select' | 'text';

export interface Question {
  id: string;
  text_he: string;
  text_en: string;
  type: QuestionType;
  options?: Array<{ value: string; label_he: string; label_en: string }>;
  min?: number;
  max?: number;
  mapsTo: string;
}

export interface SheetLike {
  rows: Array<{ enabled: boolean; name: string }>;
  reductions: Array<{ id: string; enabled: boolean; label: string; percent: number; type?: 'percent' | 'nii' | 'risk'; value?: number }>;
  defendants: Array<{ id: string; enabled: boolean; name: string; percent: number }>;
  contributoryNegligencePercent: number;
}

const uid = (): string => Math.random().toString(16).slice(2) + Date.now().toString(16);

/** Deterministic: which questions to show. Always includes damage type, NII, loss of chance, and other gaps. */
export function getGapQuestions(sheet: SheetLike): Question[] {
  const questions: Question[] = [];
  const activeDefendants = sheet.defendants.filter((d) => d.enabled);
  const builtIns = getBuiltInTemplates();

  questions.push({
    id: 'damage_type',
    text_he: 'סוג נזק – בחר תבנית לטעינה (או "אחר" להשאיר את המחשבון כפי שהוא).',
    text_en: 'Damage type – choose a template to load (or "Other" to keep current sheet).',
    type: 'select',
    mapsTo: 'loadTemplateId',
    options: [
      { value: '', label_he: 'אחר (לא לטעון תבנית)', label_en: 'Other (do not load template)' },
      ...builtIns.map((t) => ({ value: t.id, label_he: t.name, label_en: t.name })),
    ],
  });

  if (sheet.contributoryNegligencePercent === 0) {
    questions.push({
      id: 'contrib_neg',
      text_he: 'האם יש אשם תורם? אם כן, הזן אחוז (0–100).',
      text_en: 'Is there contributory negligence? If so, enter percent (0–100).',
      type: 'percent',
      min: 0,
      max: 100,
      mapsTo: 'contributoryNegligencePercent',
    });
  }

  questions.push({
    id: 'loss_of_chance',
    text_he: 'פגיעה בסיכויי החלמה (%) – הזן אחוז (0–100) או דלג.',
    text_en: 'Loss of chance (%) – enter percent (0–100) or skip.',
    type: 'percent',
    min: 0,
    max: 100,
    mapsTo: 'addLossOfChancePercent',
  });

  if (activeDefendants.length <= 1) {
    questions.push({
      id: 'defendant_count',
      text_he: 'כמה נתבעים יש? (1–10)',
      text_en: 'How many defendants? (1–10)',
      type: 'number',
      min: 1,
      max: 10,
      mapsTo: 'defendantCount',
    });
  }

  questions.push({
    id: 'nii_amount',
    text_he: 'הפחתת מל״ל (סכום ₪) – הזן סכום לקיזוז או 0.',
    text_en: 'NII deduction (amount ₪) – enter amount to deduct or 0.',
    type: 'number',
    min: 0,
    mapsTo: 'niiAmount',
  });

  const hasMedicalRows = sheet.rows.some(
    (r) => r.enabled && /רפואי|הוצאות|medical|expenses/i.test(r.name)
  );
  if (hasMedicalRows) {
    questions.push({
      id: 'plaintiff_expenses',
      text_he: 'האם יש הוצאות תובע (₪) נוספות מעבר לראשי הנזק? הזן סכום או 0.',
      text_en: 'Any additional plaintiff expenses (₪) beyond damage heads? Enter amount or 0.',
      type: 'number',
      min: 0,
      mapsTo: 'plaintiffExpenses',
    });
  }

  questions.push({
    id: 'attorney_fee',
    text_he: 'אחוז שכר טרחה ב"כ התובע (0–100)?',
    text_en: 'Attorney fee percent for claimant (0–100)?',
    type: 'percent',
    min: 0,
    max: 100,
    mapsTo: 'attorneyFeePercent',
  });

  return questions;
}

export interface QuestionnairePatch {
  loadTemplateId?: string;
  contributoryNegligencePercent?: number;
  attorneyFeePercent?: number;
  plaintiffExpenses?: number;
  reductions?: Array<{ id: string; enabled: boolean; label: string; percent: number; type?: 'percent' | 'nii' | 'risk'; value?: number }>;
  defendants?: Array<{ id: string; enabled: boolean; name: string; percent: number }>;
}

/** Sentinel for skipped questions; skipped fields are not included in the patch. */
export const SKIP_SENTINEL = '__skip__';

function isSkipped(v: unknown): boolean {
  return v === SKIP_SENTINEL;
}

/**
 * Build a patch from answers. Skipped answers (SKIP_SENTINEL) are not included.
 * Caller applies via setSheetWithHistory(prev => ({ ...prev, ...patch })).
 */
export function buildProposal(
  answers: Record<string, string | number>,
  sheet: SheetLike
): QuestionnairePatch {
  const patch: QuestionnairePatch = {};
  const num = (key: string): number => {
    const v = answers[key];
    if (isSkipped(v)) return 0;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const str = (key: string): string => {
    const v = answers[key];
    if (isSkipped(v) || v == null) return '';
    return String(v).trim();
  };

  if ('damage_type' in answers && !isSkipped(answers['damage_type']) && str('damage_type')) {
    patch.loadTemplateId = str('damage_type');
  }
  if ('contrib_neg' in answers && !isSkipped(answers['contrib_neg'])) {
    patch.contributoryNegligencePercent = Math.max(0, Math.min(100, num('contrib_neg')));
  }
  if ('attorney_fee' in answers && !isSkipped(answers['attorney_fee'])) {
    patch.attorneyFeePercent = Math.max(0, Math.min(100, num('attorney_fee')));
  }
  if ('plaintiff_expenses' in answers && !isSkipped(answers['plaintiff_expenses'])) {
    patch.plaintiffExpenses = Math.max(0, num('plaintiff_expenses'));
  }
  if ('nii_amount' in answers && !isSkipped(answers['nii_amount'])) {
    const amount = Math.max(0, num('nii_amount'));
    const existingNii = sheet.reductions.find((r) => (r as { type?: string }).type === 'nii');
    const newNii = {
      id: existingNii?.id ?? uid(),
      enabled: true,
      label: 'מל״ל',
      percent: 0,
      type: 'nii' as const,
      value: amount,
    };
    if (existingNii) {
      patch.reductions = sheet.reductions.map((r) =>
        (r as { type?: string }).type === 'nii' ? { ...r, ...newNii } : r
      );
    } else {
      patch.reductions = [...sheet.reductions, newNii];
    }
  }
  if ('loss_of_chance' in answers && !isSkipped(answers['loss_of_chance'])) {
    const pct = Math.max(0, Math.min(100, num('loss_of_chance')));
    const existingRisk = sheet.reductions.find(
      (r) => (r as { type?: string }).type === 'risk' || /סיכוי|חלמה|chance/i.test(r.label)
    );
    const label = sheet.reductions.some((r) => /סיכוי|חלמה/i.test(r.label))
      ? 'פגיעה בסיכויי החלמה (%)'
      : 'Loss of chance (%)';
    const newRed = {
      id: existingRisk?.id ?? uid(),
      enabled: true,
      label,
      percent: pct,
      type: 'risk' as const,
    };
    if (existingRisk) {
      patch.reductions = patch.reductions ?? [...sheet.reductions];
      const idx = patch.reductions.findIndex(
        (r) => (r as { type?: string }).type === 'risk' || /סיכוי|חלמה|chance/i.test(r.label)
      );
      if (idx >= 0) {
        patch.reductions = patch.reductions.map((r, i) => (i === idx ? { ...r, ...newRed } : r));
      } else {
        patch.reductions = [...patch.reductions, newRed];
      }
    } else {
      patch.reductions = patch.reductions ?? [...sheet.reductions];
      patch.reductions = [...patch.reductions, newRed];
    }
  }
  if ('defendant_count' in answers && !isSkipped(answers['defendant_count'])) {
    const count = Math.max(1, Math.min(10, Math.round(num('defendant_count'))));
    const current = sheet.defendants.filter((d) => d.enabled);
    const perPercent = Math.floor(100 / count);
    const remainder = 100 - perPercent * count;
    const newDefs: Array<{ id: string; enabled: boolean; name: string; percent: number }> = [];
    for (let i = 0; i < count; i++) {
      const pct = i === 0 ? perPercent + remainder : perPercent;
      const name = current[i]?.name ?? `נתבע ${i + 1}`;
      newDefs.push({
        id: current[i]?.id ?? uid(),
        enabled: true,
        name,
        percent: pct,
      });
    }
    patch.defendants = newDefs;
  }

  return patch;
}
