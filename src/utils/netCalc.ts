/**
 * Single source of truth for Net ("After") calculation.
 * Order: 1) Total Before  2) Contributory Negligence  3) NII (absolute)  4) Risk (loss of chance %)  5) Defendants on final.
 * Deterministic, local only.
 */

export type ReductionForNet = {
  enabled: boolean;
  type?: 'percent' | 'contrib' | 'nii' | 'risk';
  percent?: number;
  value?: number;
  label?: string;
};

export type SheetForNet = {
  contributoryNegligencePercent: number;
  reductions: ReductionForNet[];
};

const clampPct = (x: number): number => Math.max(0, Math.min(100, x));

/** NII = תגמולי מל"ל. Sum of enabled reductions with type === 'nii' and numeric positive value only. */
export function getNiiAmount(reductions: ReductionForNet[]): number {
  return reductions
    .filter((r) => r.enabled && r.type === 'nii')
    .reduce((sum, r) => {
      const v = r.value;
      if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return sum;
      return sum + v;
    }, 0);
}

/** Risk %: first enabled reduction with type === 'risk', else fallback to label-based (backward compat). */
export function getRiskPctFromSheet(reductions: ReductionForNet[]): number {
  const byType = reductions.find((r) => r.enabled && r.type === 'risk');
  if (byType != null) return clampPct(Number(byType.percent) || 0);
  const label = (r: ReductionForNet) => (r.label || '').toLowerCase();
  const byLabel = reductions.find(
    (r) => r.enabled && /סיכוי|חלמה|loss|chance|risk/i.test(label(r))
  );
  if (!byLabel) return 0;
  return clampPct(Number(byLabel.percent) || 0);
}

export interface CalcNetTotalsResult {
  before: number;
  afterContrib: number;
  afterNii: number;
  afterRisk: number;
  after: number;
}

/** Effective contributory negligence %: first enabled reduction with type 'contrib', else sheet field. */
export function getContribPctFromSheet(sheet: SheetForNet): number {
  const byContrib = sheet.reductions.find((r) => r.enabled && r.type === 'contrib');
  if (byContrib != null) return clampPct(Number(byContrib.percent) || 0);
  return clampPct(sheet.contributoryNegligencePercent);
}

/**
 * Calc net in fixed order: before → afterContrib → afterNii (minus NII amount) → afterRisk (minus risk %) → after.
 * @param baseTotal - Total Before (net from rows)
 * @param sheet - contributoryNegligencePercent + reductions (type 'contrib' overrides field; 'nii', 'risk')
 * @param params - riskPct overrides sheet loss-of-chance (e.g. for scenarios)
 */
export function calcNetTotals(
  baseTotal: number,
  sheet: SheetForNet,
  params?: { riskPct?: number }
): CalcNetTotalsResult {
  const before = baseTotal;
  const contribPct = getContribPctFromSheet(sheet);
  const contribFactor = 1 - contribPct / 100;
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
