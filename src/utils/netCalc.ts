/**
 * Single source of truth for Net ("After") calculation.
 * Order: 1) Total Before  2) Contributory Negligence  3) NII (absolute)  4) Risk (loss of chance %)  5) Defendants on final.
 * Deterministic, local only.
 */

export type ReductionForNet = {
  enabled: boolean;
  type?: 'percent' | 'nii';
  percent?: number;
  value?: number;
  label?: string;
};

export type SheetForNet = {
  contributoryNegligencePercent: number;
  reductions: ReductionForNet[];
};

const clampPct = (x: number): number => Math.max(0, Math.min(100, x));

/** NII = תגמולי מל"ל. Sum of enabled reductions with type === 'nii' (value = amount in ₪). */
export function getNiiAmount(reductions: ReductionForNet[]): number {
  return reductions
    .filter((r) => r.enabled && r.type === 'nii')
    .reduce((sum, r) => {
      const v = r.value;
      return sum + (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : 0);
    }, 0);
}

/** Risk % from first enabled loss-of-chance reduction (by label), or 0. */
export function getRiskPctFromSheet(reductions: ReductionForNet[]): number {
  const label = (r: ReductionForNet) => (r.label || '').toLowerCase();
  const lossOfChance = reductions.find(
    (r) => r.enabled && /סיכוי|חלמה|loss|chance|risk/i.test(label(r))
  );
  if (!lossOfChance) return 0;
  return clampPct(Number(lossOfChance.percent) || 0);
}

export interface CalcNetTotalsResult {
  before: number;
  afterContrib: number;
  afterNii: number;
  afterRisk: number;
  after: number;
}

/**
 * Calc net in fixed order: before → afterContrib → afterNii (minus NII amount) → afterRisk (minus risk %) → after.
 * @param baseTotal - Total Before (net from rows)
 * @param sheet - contributoryNegligencePercent + reductions (with optional type 'nii' and value)
 * @param params - riskPct overrides sheet loss-of-chance (e.g. for scenarios)
 */
export function calcNetTotals(
  baseTotal: number,
  sheet: SheetForNet,
  params?: { riskPct?: number }
): CalcNetTotalsResult {
  const before = baseTotal;
  const contribFactor = 1 - clampPct(sheet.contributoryNegligencePercent) / 100;
  const afterContrib = before * contribFactor;

  const niiAmount = getNiiAmount(sheet.reductions);
  const afterNii = Math.max(afterContrib - niiAmount, 0);

  const riskPct = params?.riskPct !== undefined && params?.riskPct !== null
    ? clampPct(params.riskPct)
    : getRiskPctFromSheet(sheet.reductions);
  const afterRisk = afterNii * (1 - riskPct / 100);

  return {
    before,
    afterContrib,
    afterNii,
    afterRisk,
    after: afterRisk,
  };
}
