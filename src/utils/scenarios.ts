/**
 * Three scenarios (Conservative / Reasonable / Aggressive): compute totals before/after
 * using the same order as the calculator. No LLM; deterministic.
 * Order: Before → contrib → NII (absolute from sheet) → risk (scenario lossOfChancePct).
 */

import { calcNetTotals, type SheetForNet } from './netCalc';

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
  /** Total Before (net from sheet) - same for all scenarios */
  before: { plaintiff: number; defendant: number; avg: number };
  /** Total After: contrib → NII (sheet) → risk (scenario) */
  after: { plaintiff: number; defendant: number; avg: number };
}

/** Reductions from sheet (id optional for netCalc). */
export type ScenarioSheetReductions = Array<{
  enabled: boolean;
  type?: 'percent' | 'contrib' | 'nii' | 'risk';
  percent?: number;
  value?: number;
  label?: string;
}>;

/**
 * Compute before/after for one scenario. NII from sheet; contrib and risk from scenario params.
 */
export function computeScenarioResult(
  baseNets: { plaintiffNet: number; defendantNet: number; avgNet: number },
  params: ScenarioParams,
  sheetReductions: ScenarioSheetReductions
): Omit<ScenarioResult, 'labelKey'> {
  const sheetForNet: SheetForNet = {
    contributoryNegligencePercent: params.contribNegPct,
    reductions: sheetReductions.map((r) => ({
      enabled: r.enabled,
      type: r.type,
      percent: r.percent,
      value: r.value,
      label: r.label,
    })),
  };
  const plaintiffRes = calcNetTotals(baseNets.plaintiffNet, sheetForNet, { riskPct: params.lossOfChancePct });
  const defendantRes = calcNetTotals(baseNets.defendantNet, sheetForNet, { riskPct: params.lossOfChancePct });
  const avgRes = calcNetTotals(baseNets.avgNet, sheetForNet, { riskPct: params.lossOfChancePct });
  const before = {
    plaintiff: baseNets.plaintiffNet,
    defendant: baseNets.defendantNet,
    avg: baseNets.avgNet,
  };
  const after = {
    plaintiff: plaintiffRes.after,
    defendant: defendantRes.after,
    avg: avgRes.after,
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
