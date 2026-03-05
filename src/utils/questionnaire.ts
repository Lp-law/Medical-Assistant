/**
 * Deterministic gap detection and question generation for the damages calculator.
 * No LLM; mapsTo defines how answers become sheet patches.
 */

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
  reductions: Array<{ id: string; enabled: boolean; label: string; percent: number }>;
  defendants: Array<{ id: string; enabled: boolean; name: string; percent: number }>;
  contributoryNegligencePercent: number;
}

const uid = (): string => Math.random().toString(16).slice(2) + Date.now().toString(16);

/** Deterministic: which questions to show based on current sheet state. */
export function getGapQuestions(sheet: SheetLike): Question[] {
  const questions: Question[] = [];
  const activeDefendants = sheet.defendants.filter((d) => d.enabled);
  const hasLossOfChance = sheet.reductions.some(
    (r) => r.enabled && /סיכוי|חלמה|loss|chance/i.test(r.label)
  );

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

  if (!hasLossOfChance) {
    questions.push({
      id: 'loss_of_chance',
      text_he: 'האם להגדיר הפחתה בגין פגיעה בסיכויי החלמה? אם כן, הזן אחוז (0–100).',
      text_en: 'Add a reduction for loss of chance? If so, enter percent (0–100).',
      type: 'percent',
      min: 0,
      max: 100,
      mapsTo: 'addLossOfChancePercent',
    });
  }

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
  contributoryNegligencePercent?: number;
  attorneyFeePercent?: number;
  plaintiffExpenses?: number;
  reductions?: Array<{ id: string; enabled: boolean; label: string; percent: number }>;
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

  if ('contrib_neg' in answers && !isSkipped(answers['contrib_neg'])) {
    patch.contributoryNegligencePercent = Math.max(0, Math.min(100, num('contrib_neg')));
  }
  if ('attorney_fee' in answers && !isSkipped(answers['attorney_fee'])) {
    patch.attorneyFeePercent = Math.max(0, Math.min(100, num('attorney_fee')));
  }
  if ('plaintiff_expenses' in answers && !isSkipped(answers['plaintiff_expenses'])) {
    patch.plaintiffExpenses = Math.max(0, num('plaintiff_expenses'));
  }
  if ('loss_of_chance' in answers && !isSkipped(answers['loss_of_chance']) && num('loss_of_chance') > 0) {
    const pct = Math.max(0, Math.min(100, num('loss_of_chance')));
    const newRed = {
      id: uid(),
      enabled: true,
      label: sheet.reductions.some((r) => /סיכוי|חלמה/i.test(r.label))
        ? 'פגיעה בסיכויי החלמה (%)'
        : 'Loss of chance (%)',
      percent: pct,
    };
    patch.reductions = [...sheet.reductions, newRed];
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
