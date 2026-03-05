/**
 * Three scenarios (Conservative / Reasonable / Aggressive): compute totals before/after
 * using the same logic as the calculator. No LLM; deterministic.
 */

const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));

export interface ScenarioDefendant {
  name: string;
  percent: number;
}

export interface ScenarioParams {
  contribNegPct: number;
  lossOfChancePct: number;
  defendants: ScenarioDefendant[];
}

export interface ScenarioResult {
  labelKey: 'conservative' | 'reasonable' | 'aggressive';
  params: ScenarioParams;
  /** Net totals (before reductions) - same for all scenarios, from base sheet */
  before: { plaintiff: number; defendant: number; avg: number };
  /** After contrib + reductions (loss of chance only for this scenario) */
  after: { plaintiff: number; defendant: number; avg: number };
}

function applyContribAndLossOfChance(
  net: number,
  contribPct: number,
  lossOfChancePct: number
): number {
  const afterContrib = net * (1 - clamp(contribPct, 0, 100) / 100);
  const afterLoss = afterContrib * (1 - clamp(lossOfChancePct, 0, 100) / 100);
  return afterLoss;
}

/**
 * Compute before/after for one scenario. Base totals come from the current sheet.
 */
export function computeScenarioResult(
  baseNets: { plaintiffNet: number; defendantNet: number; avgNet: number },
  params: ScenarioParams
): Omit<ScenarioResult, 'labelKey'> {
  const before = {
    plaintiff: baseNets.plaintiffNet,
    defendant: baseNets.defendantNet,
    avg: baseNets.avgNet,
  };
  const after = {
    plaintiff: applyContribAndLossOfChance(baseNets.plaintiffNet, params.contribNegPct, params.lossOfChancePct),
    defendant: applyContribAndLossOfChance(baseNets.defendantNet, params.contribNegPct, params.lossOfChancePct),
    avg: applyContribAndLossOfChance(baseNets.avgNet, params.contribNegPct, params.lossOfChancePct),
  };
  return { params, before, after };
}

/**
 * Default params for the three scenarios (can be overwritten by user).
 */
export function defaultScenarioParams(): Record<'conservative' | 'reasonable' | 'aggressive', ScenarioParams> {
  return {
    conservative: {
      contribNegPct: 20,
      lossOfChancePct: 30,
      defendants: [{ name: 'נתבע 1', percent: 100 }],
    },
    reasonable: {
      contribNegPct: 10,
      lossOfChancePct: 15,
      defendants: [{ name: 'נתבע 1', percent: 100 }],
    },
    aggressive: {
      contribNegPct: 0,
      lossOfChancePct: 0,
      defendants: [{ name: 'נתבע 1', percent: 100 }],
    },
  };
}

/**
 * Sum of defendant percents (must be 100 for valid allocation).
 */
export function sumDefendantPct(defendants: ScenarioDefendant[]): number {
  return defendants.reduce((a, d) => a + clamp(d.percent, 0, 100), 0);
}
