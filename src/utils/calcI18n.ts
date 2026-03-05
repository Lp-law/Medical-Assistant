/**
 * Shared i18n for calculator bot features: Sanity Check, Questionnaire, Scenarios.
 * All user-facing strings are he + en-GB. Re-exports formatters from exportForWordI18n.
 */

export type Lang = 'he' | 'en-GB';

export {
  formatNumber,
  formatPercent,
  formatCurrency,
  isRtl,
  getLabels,
} from './exportForWordI18n';
export type { ExportLang } from './exportForWordI18n';

const dict: Record<Lang, Record<string, string>> = {
  he: {
    sanityCheck: 'בדיקת שפיות',
    sanityCheckTitle: 'בדיקת שפיות לתחשיב',
    fix: 'תקן',
    fixAllSafe: 'תקן את כל הבטוחים',
    noIssues: 'לא נמצאו בעיות.',
    severity: 'חומרה',
    p0: 'קריטי',
    p1: 'גבוהה',
    p2: 'בינונית',
    defPctNot100: 'סכום אחוזי הנתבעים אינו 100%',
    defPctNot100Detail: 'סכום האחוזים הוא {sum}%. מומלץ לנרמל ל-100%.',
    duplicateReduction: 'הפחתה כפולה',
    duplicateReductionDetail: 'קיימות הפחתות זהות (תווית ואחוז).',
    afterGtBefore: 'הסכום לאחר הפחתות גדול מהנטו',
    afterGtBeforeDetail: 'בתרחיש {scenario} הסכום לאחר הפחתות גדול מהנטו – ייתכן שהגדרות ההפחתה שגויות.',
    negativeValues: 'ערכים שליליים לא צפויים',
    negativeValuesDetail: 'קיימים ערכים שליליים בשורות או בהפחתות.',
    rowOutlier: 'שורה עם סכום חריג',
    rowOutlierDetail: 'שורה עם סכום מעל 50 מיליון ₪.',
    totalMismatch: 'אִי־התאמה בחישוב סיכום',
    totalMismatchDetail: 'סיכום השורות אינו תואם את הנטו המחושב.',
    normalizeDefendants: 'נרמל אחוזי נתבעים ל-100%',
    removeDuplicateReduction: 'הסר הפחתה כפולה',
    claimant: 'תובע',
    defendant: 'נתבע',
    average: 'ממוצע',
    questionnaire: 'שאלון חכמה',
    generateQuestions: 'צור שאלות',
    buildProposal: 'בנה הצעה',
    previewChanges: 'תצוגת מקדימה',
    apply: 'החל',
    cancel: 'ביטול',
    noQuestions: 'אין שאלות להצגה.',
    answersRequired: 'נא לענות על השאלות.',
    conservative: 'שמרני',
    reasonable: 'סביר',
    aggressive: 'אגרסיבי',
    scenarios: 'תרחישים',
    scenariosTitle: 'שלושה תרחישים',
    contribNegPct: 'אשם תורם (%)',
    lossOfChancePct: 'פגיעה בסיכויי החלמה (%)',
    defendantsAllocation: 'חלוקת נתבעים',
    totalBefore: 'סה״כ לפני',
    totalAfter: 'סה״כ לאחר',
    exportScenariosToWord: 'יצוא תרחישים ל-Word',
    scenarioSummary: 'סיכום תרחישים',
    name: 'שם',
    percent: 'אחוז',
    amount: 'סכום',
    language: 'שפה',
    hebrew: 'עברית',
    english: 'English (UK)',
    attorneyFee: 'שכ״ט ב״כ התובע',
  },
  'en-GB': {
    sanityCheck: 'Sanity Check',
    sanityCheckTitle: 'Sanity check for calculation',
    fix: 'Fix',
    fixAllSafe: 'Fix all safe',
    noIssues: 'No issues found.',
    severity: 'Severity',
    p0: 'Critical',
    p1: 'High',
    p2: 'Medium',
    defPctNot100: 'Defendants total percent is not 100%',
    defPctNot100Detail: 'Sum of percents is {sum}%. Consider normalising to 100%.',
    duplicateReduction: 'Duplicate reduction',
    duplicateReductionDetail: 'Identical reductions (label and percent) exist.',
    afterGtBefore: 'Amount after reductions exceeds net',
    afterGtBeforeDetail: 'In scenario {scenario} the amount after reductions exceeds net – check reduction settings.',
    negativeValues: 'Unexpected negative values',
    negativeValuesDetail: 'Negative values in rows or reductions.',
    rowOutlier: 'Row with outlier amount',
    rowOutlierDetail: 'Row with amount over 50 million ₪.',
    totalMismatch: 'Total mismatch',
    totalMismatchDetail: 'Sum of rows does not match computed net.',
    normalizeDefendants: 'Normalise defendant percents to 100%',
    removeDuplicateReduction: 'Remove duplicate reduction',
    claimant: 'Claimant',
    defendant: 'Defendant',
    average: 'Average',
    questionnaire: 'Smart questionnaire',
    generateQuestions: 'Generate questions',
    buildProposal: 'Build proposal',
    previewChanges: 'Preview changes',
    apply: 'Apply',
    cancel: 'Cancel',
    noQuestions: 'No questions to show.',
    answersRequired: 'Please answer the questions.',
    conservative: 'Conservative',
    reasonable: 'Reasonable',
    aggressive: 'Aggressive',
    scenarios: 'Scenarios',
    scenariosTitle: 'Three scenarios',
    contribNegPct: 'Contributory negligence (%)',
    lossOfChancePct: 'Loss of chance (%)',
    defendantsAllocation: 'Defendants allocation',
    totalBefore: 'Total before',
    totalAfter: 'Total after',
    exportScenariosToWord: 'Export scenarios to Word',
    scenarioSummary: 'Scenario summary',
    name: 'Name',
    percent: 'Percent',
    amount: 'Amount',
    language: 'Language',
    hebrew: 'Hebrew',
    english: 'English (UK)',
    attorneyFee: 'Attorney fee (claimant)',
  },
};

export function t(key: string, lang: Lang): string {
  const s = dict[lang]?.[key] ?? dict['he']?.[key] ?? key;
  return typeof s === 'string' ? s : key;
}

export function tReplace(key: string, lang: Lang, vars: Record<string, string | number>): string {
  let s = t(key, lang);
  for (const [k, v] of Object.entries(vars)) {
    s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }
  return s;
}
