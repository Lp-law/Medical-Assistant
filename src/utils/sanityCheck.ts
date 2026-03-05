/**
 * Deterministic sanity checks for the damages calculator.
 * Pure functions only; no LLM. Fix actions produce a new sheet state (patch).
 */

export type Severity = 'P0' | 'P1' | 'P2';

export type FixActionId =
  | 'NORMALIZE_DEFENDANTS_PERCENT'
  | 'REMOVE_EXACT_DUPLICATE_REDUCTION'
  | 'FIX_ROUNDING';

export interface CheckResult {
  id: string;
  severity: Severity;
  titleKey: string;
  detailsKey: string;
  detailsVars?: Record<string, string | number>;
  canAutoFix: boolean;
  fixActionId?: FixActionId;
  /** For REMOVE_EXACT_DUPLICATE_REDUCTION: reduction id to remove */
  fixPayload?: { reductionId?: string };
}

export interface SheetSnapshot {
  rows: Array<{ id: string; enabled: boolean; name: string; kind: string; plaintiff: number; defendant: number }>;
  reductions: Array<{ id: string; enabled: boolean; label: string; percent: number }>;
  defendants: Array<{ id: string; enabled: boolean; name: string; percent: number }>;
  contributoryNegligencePercent: number;
}

export interface TotalsSnapshot {
  plaintiffNet: number;
  defendantNet: number;
  avgNet: number;
  plaintiffAdd: number;
  defendantAdd: number;
  avgAdd: number;
}

export interface AfterSnapshot {
  plaintiff: { afterAll: number };
  defendant: { afterAll: number };
  avg: { afterAll: number };
}

const sum = (vals: number[]): number => vals.reduce((a, v) => a + (Number.isFinite(v) ? v : 0), 0);
const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));

export function runSanityChecks(
  sheet: SheetSnapshot,
  totals: TotalsSnapshot,
  after: AfterSnapshot
): CheckResult[] {
  const results: CheckResult[] = [];
  const activeDefendants = sheet.defendants.filter((d) => d.enabled);
  const defSum = sum(activeDefendants.map((d) => d.percent));

  // DEF_PCT_NOT_100
  if (Math.abs(defSum - 100) > 0.01 && activeDefendants.length > 0) {
    results.push({
      id: 'DEF_PCT_NOT_100',
      severity: 'P1',
      titleKey: 'defPctNot100',
      detailsKey: 'defPctNot100Detail',
      detailsVars: { sum: defSum.toFixed(1) },
      canAutoFix: true,
      fixActionId: 'NORMALIZE_DEFENDANTS_PERCENT',
    });
  }

  // DUPLICATE_REDUCTION (exact same label + percent)
  const reds = sheet.reductions.filter((r) => r.enabled);
  const seen = new Map<string, string>();
  for (const r of reds) {
    const key = `${(r.label || '').trim()}|${r.percent}`;
    if (seen.has(key)) {
      results.push({
        id: 'DUPLICATE_REDUCTION',
        severity: 'P2',
        titleKey: 'duplicateReduction',
        detailsKey: 'duplicateReductionDetail',
        canAutoFix: true,
        fixActionId: 'REMOVE_EXACT_DUPLICATE_REDUCTION',
        fixPayload: { reductionId: r.id },
      });
      break;
    }
    seen.set(key, r.id);
  }

  // AFTER_GT_BEFORE
  const scenarios = [
    { key: 'claimant', before: totals.plaintiffNet, afterVal: after.plaintiff.afterAll },
    { key: 'defendant', before: totals.defendantNet, afterVal: after.defendant.afterAll },
    { key: 'average', before: totals.avgNet, afterVal: after.avg.afterAll },
  ];
  for (const s of scenarios) {
    if (s.afterVal > s.before + 0.01) {
      results.push({
        id: 'AFTER_GT_BEFORE',
        severity: 'P0',
        titleKey: 'afterGtBefore',
        detailsKey: 'afterGtBeforeDetail',
        detailsVars: { scenario: s.key },
        canAutoFix: false,
      });
    }
  }

  // NEGATIVE_VALUES
  const hasNegative =
    sheet.rows.some((r) => r.plaintiff < 0 || r.defendant < 0) ||
    sheet.reductions.some((r) => r.percent < 0) ||
    sheet.defendants.some((d) => d.percent < 0) ||
    sheet.contributoryNegligencePercent < 0;
  if (hasNegative) {
    results.push({
      id: 'NEGATIVE_VALUES',
      severity: 'P0',
      titleKey: 'negativeValues',
      detailsKey: 'negativeValuesDetail',
      canAutoFix: false,
    });
  }

  // ROW_OUTLIER
  const maxRow = Math.max(
    ...sheet.rows.map((r) => Math.max(r.plaintiff, r.defendant)),
    0
  );
  if (maxRow > 50_000_000) {
    results.push({
      id: 'ROW_OUTLIER',
      severity: 'P2',
      titleKey: 'rowOutlier',
      detailsKey: 'rowOutlierDetail',
      canAutoFix: false,
    });
  }

  // TOTAL_MISMATCH: recompute add/deduct from rows and compare to totals
  const addRows = sheet.rows.filter((r) => r.enabled && r.kind === 'add');
  const deductRows = sheet.rows.filter((r) => r.enabled && r.kind === 'deduct');
  const plaintiffAdd = sum(addRows.map((r) => r.plaintiff));
  const defendantAdd = sum(addRows.map((r) => r.defendant));
  const avgAdd = sum(addRows.map((r) => (r.plaintiff + r.defendant) / 2));
  const plaintiffDeduct = sum(deductRows.map((r) => r.plaintiff));
  const defendantDeduct = sum(deductRows.map((r) => r.defendant));
  const avgDeduct = sum(deductRows.map((r) => (r.plaintiff + r.defendant) / 2));
  const expectedNetP = plaintiffAdd - plaintiffDeduct;
  const expectedNetD = defendantAdd - defendantDeduct;
  const expectedNetA = avgAdd - avgDeduct;
  const tol = 0.01;
  if (
    Math.abs(totals.plaintiffNet - expectedNetP) > tol ||
    Math.abs(totals.defendantNet - expectedNetD) > tol ||
    Math.abs(totals.avgNet - expectedNetA) > tol
  ) {
    results.push({
      id: 'TOTAL_MISMATCH',
      severity: 'P0',
      titleKey: 'totalMismatch',
      detailsKey: 'totalMismatchDetail',
      canAutoFix: false,
    });
  }

  return results;
}

/**
 * Normalize defendant percents to sum to 100%. Returns new defendants array.
 */
function normalizeDefendants(
  defendants: Array<{ id: string; enabled: boolean; name: string; percent: number }>
): Array<{ id: string; enabled: boolean; name: string; percent: number }> {
  const enabled = defendants.filter((d) => d.enabled);
  const total = sum(enabled.map((d) => d.percent));
  if (enabled.length === 0) return defendants;
  if (total <= 0) {
    let first = true;
    return defendants.map((d) => {
      if (!d.enabled) return d;
      const p = first ? 100 : 0;
      first = false;
      return { ...d, percent: p };
    });
  }
  const scale = 100 / total;
  const updated = new Map<string, number>();
  let firstEnabledId: string | null = null;
  let running = 0;
  enabled.forEach((d) => {
    const p = Math.round(clamp(d.percent, 0, 100) * scale * 100) / 100;
    updated.set(d.id, p);
    running += p;
    if (firstEnabledId === null) firstEnabledId = d.id;
  });
  const diff = 100 - running;
  if (firstEnabledId != null && Math.abs(diff) > 0.001) {
    updated.set(firstEnabledId, clamp((updated.get(firstEnabledId) ?? 0) + diff, 0, 100));
  }
  return defendants.map((d) =>
    d.enabled && updated.has(d.id) ? { ...d, percent: updated.get(d.id)! } : d
  );
}

export interface SheetPatch {
  defendants?: Array<{ id: string; enabled: boolean; name: string; percent: number }>;
  reductions?: Array<{ id: string; enabled: boolean; label: string; percent: number }>;
}

/**
 * Produce a patch for the given fix action. Caller applies patch to sheet (e.g. setSheetWithHistory).
 */
export function buildFixPatch(
  sheet: SheetSnapshot,
  result: CheckResult
): SheetPatch | null {
  if (!result.canAutoFix || !result.fixActionId) return null;
  switch (result.fixActionId) {
    case 'NORMALIZE_DEFENDANTS_PERCENT':
      return { defendants: normalizeDefendants(sheet.defendants) };
    case 'REMOVE_EXACT_DUPLICATE_REDUCTION':
      if (result.fixPayload?.reductionId) {
        const next = sheet.reductions.filter((r) => r.id !== result.fixPayload!.reductionId);
        return { reductions: next };
      }
      return null;
    default:
      return null;
  }
}

/**
 * Apply all safe (P1/P2) auto-fixable checks. Returns a single combined patch or null.
 */
export function buildFixAllSafePatch(
  sheet: SheetSnapshot,
  results: CheckResult[]
): SheetPatch | null {
  const fixable = results.filter((r) => r.canAutoFix && r.severity !== 'P0');
  if (fixable.length === 0) return null;
  let patch: SheetPatch = {};
  for (const r of fixable) {
    const p = buildFixPatch(sheet, r);
    if (p?.defendants) patch.defendants = p.defendants;
    if (p?.reductions) patch.reductions = p.reductions;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}
