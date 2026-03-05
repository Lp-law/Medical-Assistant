import React, { useState, useMemo } from 'react';
import { ShieldCheck, Wrench, ChevronDown, ChevronUp } from 'lucide-react';
import { runSanityChecks, buildFixPatch, buildFixAllSafePatch, type CheckResult, type SheetSnapshot, type TotalsSnapshot, type AfterSnapshot, type SheetPatch } from '../utils/sanityCheck';
import { t, tReplace, type Lang } from '../utils/calcI18n';

type Props = {
  lang: Lang;
  sheet: SheetSnapshot;
  totals: TotalsSnapshot;
  after: AfterSnapshot;
  onApplyPatch: (patch: SheetPatch) => void;
};

const severityOrder: CheckResult['severity'][] = ['P0', 'P1', 'P2'];
const severityLabelKey: Record<CheckResult['severity'], string> = {
  P0: 'p0',
  P1: 'p1',
  P2: 'p2',
};

const SanityCheckPanel: React.FC<Props> = ({ lang, sheet, totals, after, onApplyPatch }) => {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<CheckResult[] | null>(null);

  const runCheck = () => {
    const list = runSanityChecks(sheet, totals, after);
    setResults(list);
    setOpen(true);
  };

  const sortedResults = useMemo(() => {
    if (!results) return [];
    return [...results].sort(
      (a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
    );
  }, [results]);

  const fixableCount = results?.filter((r) => r.canAutoFix && r.severity !== 'P0').length ?? 0;

  const handleFix = (result: CheckResult) => {
    const patch = buildFixPatch(sheet, result);
    if (patch) onApplyPatch(patch);
  };

  const handleFixAllSafe = () => {
    const patch = buildFixAllSafePatch(sheet, results ?? []);
    if (patch) onApplyPatch(patch);
  };

  return (
    <div className="rounded-card border border-pearl bg-white p-4 shadow-card-xl" dir={lang === 'he' ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-navy" aria-hidden />
          <span className="font-semibold text-navy">{t('sanityCheckTitle', lang)}</span>
        </div>
        <button
          type="button"
          onClick={runCheck}
          className="btn-outline text-sm px-4 py-2 inline-flex items-center gap-2"
        >
          <ShieldCheck className="w-4 h-4" />
          {t('sanityCheck', lang)}
        </button>
      </div>

      {results !== null && (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="mt-3 flex items-center gap-2 text-sm text-slate hover:text-navy"
          >
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {results.length === 0 ? t('noIssues', lang) : `${results.length} ${t('severity', lang).toLowerCase()}`}
          </button>

          {open && (
            <div className="mt-3 space-y-3">
              {sortedResults.length === 0 ? (
                <p className="text-sm text-slate">{t('noIssues', lang)}</p>
              ) : (
                <>
                  {fixableCount > 0 && (
                    <button
                      type="button"
                      onClick={handleFixAllSafe}
                      className="btn-primary text-sm px-3 py-1.5 inline-flex items-center gap-2"
                    >
                      <Wrench className="w-4 h-4" />
                      {t('fixAllSafe', lang)}
                    </button>
                  )}
                  <ul className="space-y-2">
                    {sortedResults.map((r) => (
                      <li
                        key={r.id}
                        className="rounded-card border border-pearl bg-pearl/20 p-3 text-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <span
                              className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                                r.severity === 'P0'
                                  ? 'bg-red-100 text-red-800'
                                  : r.severity === 'P1'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {t(severityLabelKey[r.severity], lang)}
                            </span>
                            <p className="font-medium text-navy mt-1">{t(r.titleKey, lang)}</p>
                            <p className="text-slate mt-0.5">
                              {r.detailsVars
                                ? tReplace(r.detailsKey, lang, r.detailsVars)
                                : t(r.detailsKey, lang)}
                            </p>
                          </div>
                          {r.canAutoFix && (
                            <button
                              type="button"
                              onClick={() => handleFix(r)}
                              className="btn-outline text-xs px-3 py-1.5 shrink-0"
                            >
                              {t('fix', lang)}
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SanityCheckPanel;
