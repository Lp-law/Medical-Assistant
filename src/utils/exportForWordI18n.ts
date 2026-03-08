/**
 * Minimal i18n for Export for Word: Hebrew (RTL) and English UK (LTR).
 * Labels and number/currency formatting only.
 */

export type ExportLang = 'he' | 'en-GB';

const labels = {
  he: {
    title: 'מחשבון נזק – סיכום',
    breakdownTitle: 'פירוט נזק',
    summaryTitle: 'סיכום',
    item: 'ראש נזק',
    type: 'סוג',
    add: 'תוספת',
    deduct: 'הפחתה',
    claimant: 'תובע',
    defendant: 'נתבע',
    average: 'ממוצע',
    subtotalHeads: 'סה״כ ראשי נזק',
    deductions: 'קיזוזים (מל״ל וכו׳)',
    netTotal: 'סה״כ נטו',
    totalCompensationNet: 'סה״כ פיצוי (נטו)',
    contributoryNegligence: 'אשם תורם',
    reductionsTotal: 'סה״כ הפחתות',
    attorneyFee: 'שכ״ט ב״כ התובע',
    plaintiffExpenses: 'הוצאות תובע',
    grossTotal: 'סה״כ ברוטו',
    grandTotalPayable: 'סה״כ לתשלום',
    totalAfter: 'סה״כ אחרי (אשם תורם + מל״ל + סיכון)',
    reductionsSection: 'הפחתות והתאמות',
    reductionLabel: 'הפחתה',
    percent: 'אחוז',
    defendantsSection: 'חלוקת נתבעים',
    defendantName: 'נתבע',
    amount: 'סכום',
    chartTitle: 'תרחישים – לאחר הפחתות',
    titleLabel: 'כותרת',
    attorneyFeePct: 'אחוז שכ״ט',
    resultClaimant: 'תוצאה תובע',
    resultDefendant: 'תוצאה נתבע',
    resultAvg: 'תוצאה ממוצע',
  },
  'en-GB': {
    title: 'Damages Calculator – Summary',
    breakdownTitle: 'Breakdown of Damages',
    summaryTitle: 'Summary',
    item: 'Item',
    type: 'Type',
    add: 'Add',
    deduct: 'Deduct',
    claimant: 'Claimant',
    defendant: 'Defendant',
    average: 'Average',
    subtotalHeads: 'Subtotal (heads)',
    deductions: 'Deductions (e.g. MLL)',
    netTotal: 'Net total',
    totalCompensationNet: 'Total compensation (net)',
    contributoryNegligence: 'Contributory negligence',
    reductionsTotal: 'Total reductions',
    attorneyFee: 'Attorney fee (claimant)',
    plaintiffExpenses: 'Plaintiff expenses',
    grossTotal: 'Gross total',
    grandTotalPayable: 'Grand total payable',
    totalAfter: 'Total (After: contrib. negligence + NII + risk)',
    reductionsSection: 'Reductions & Adjustments',
    reductionLabel: 'Reduction',
    percent: 'Percent',
    defendantsSection: 'Defendants Allocation',
    defendantName: 'Defendant',
    amount: 'Amount',
    chartTitle: 'Scenarios – After Reductions',
    titleLabel: 'Title',
    attorneyFeePct: 'Attorney fee %',
    resultClaimant: 'Result (claimant)',
    resultDefendant: 'Result (defendant)',
    resultAvg: 'Result (average)',
  },
} as const;

export function getLabels(lang: ExportLang): Record<keyof typeof labels.he, string> {
  return labels[lang] as Record<keyof typeof labels.he, string>;
}

export function formatNumber(lang: ExportLang, value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  const locale = lang === 'he' ? 'he-IL' : 'en-GB';
  return n.toLocaleString(locale, { maximumFractionDigits: 0 });
}

export function formatPercent(lang: ExportLang, value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  const locale = lang === 'he' ? 'he-IL' : 'en-GB';
  return n.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + '%';
}

const currencySymbol = '₪';

export function formatCurrency(lang: ExportLang, value: number): string {
  return currencySymbol + ' ' + formatNumber(lang, value);
}

export function isRtl(lang: ExportLang): boolean {
  return lang === 'he';
}
