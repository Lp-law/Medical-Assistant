/**
 * Single source of truth for "After" (net) calculation order.
 * Order: A) Total Before → B) Contributory Negligence → C) NII/others → D) Risk (Loss of chance) → E) Defendants on final.
 * All calculations are local and deterministic.
 */

export type ReductionLike = { label: string; percent: number; enabled: boolean };

const clampPct = (x: number): number => Math.max(0, Math.min(100, x));

/** Classify: loss-of-chance / risk reduction by label. */
export function isLossOfChanceReduction(r: ReductionLike): boolean {
  const label = (r.label || '').toLowerCase();
  return /סיכוי|חלמה|loss|chance|risk/i.test(label);
}

export interface AdjustmentResult {
  before: number;
  afterContrib: number;
  afterNii: number;
  afterRisk: number;
  after: number;
  contribFactor: number;
  niiFactor: number;
  riskFactor: number;
}

/**
 * Apply adjustments in fixed order.
 * @param baseTotal - Total Before (net from rows)
 * @param contribPct - Contributory negligence %
 * @param reductions - Sheet reductions (label + percent, enabled)
 * @param riskPctOverride - If set (e.g. for scenarios), use this for risk step instead of risk reductions from sheet
 */
export function applyAdjustmentsInOrder(
  baseTotal: number,
  contribPct: number,
  reductions: ReductionLike[],
  riskPctOverride?: number
): AdjustmentResult {
  const before = baseTotal;
  const contribFactor = 1 - clampPct(contribPct) / 100;
  const afterContrib = before * contribFactor;

  const enabled = reductions.filter((r) => r.enabled);
  const riskReductions = enabled.filter(isLossOfChanceReduction);
  const nonRiskReductions = enabled.filter((r) => !isLossOfChanceReduction(r));

  const niiFactor = nonRiskReductions.reduce(
    (acc, r) => acc * (1 - clampPct(r.percent) / 100),
    1
  );
  const afterNii = afterContrib * niiFactor;

  let riskFactor: number;
  if (riskPctOverride !== undefined && riskPctOverride !== null) {
    riskFactor = 1 - clampPct(riskPctOverride) / 100;
  } else {
    riskFactor = riskReductions.reduce(
      (acc, r) => acc * (1 - clampPct(r.percent) / 100),
      1
    );
  }
  const afterRisk = afterNii * riskFactor;

  return {
    before,
    afterContrib,
    afterNii,
    afterRisk,
    after: afterRisk,
    contribFactor,
    niiFactor,
    riskFactor,
  };
}
