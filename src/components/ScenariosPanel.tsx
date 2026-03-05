import React, { useState, useMemo } from 'react';
import { BarChart3, FileDown } from 'lucide-react';
import { defaultScenarioParams, computeScenarioResult, type ScenarioParams, type ScenarioResult } from '../utils/scenarios';
import { exportScenariosToWord } from '../utils/scenariosExport';
import { t, formatCurrency, type Lang } from '../utils/calcI18n';
type Props = {
  lang: Lang;
  baseNets: { plaintiffNet: number; defendantNet: number; avgNet: number };
};

const SCENARIO_KEYS: Array<'conservative' | 'reasonable' | 'aggressive'> = ['conservative', 'reasonable', 'aggressive'];

const ScenariosPanel: React.FC<Props> = ({ lang, baseNets }) => {
  const [params, setParams] = useState<Record<'conservative' | 'reasonable' | 'aggressive', ScenarioParams>>(
    defaultScenarioParams()
  );
  const [exporting, setExporting] = useState(false);

  const results: ScenarioResult[] = useMemo(() => {
    return SCENARIO_KEYS.map((key) => {
      const p = params[key];
      const res = computeScenarioResult(baseNets, p);
      return { ...res, labelKey: key };
    });
  }, [params, baseNets]);

  const updateParam = (key: 'conservative' | 'reasonable' | 'aggressive', field: keyof ScenarioParams, value: number) => {
    setParams((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportScenariosToWord(results, lang);
      // Could show toast "Copied"
    } finally {
      setExporting(false);
    }
  };

  const dir = lang === 'he' ? 'rtl' : 'ltr';

  return (
    <div className="rounded-card border border-pearl bg-white p-4 shadow-card-xl space-y-4" dir={dir}>
      <h3 className="text-lg font-semibold text-navy flex items-center gap-2">
        <BarChart3 className="w-5 h-5" />
        {t('scenariosTitle', lang)}
      </h3>

      <div className="grid gap-4 md:grid-cols-3">
        {SCENARIO_KEYS.map((key) => (
          <div key={key} className="rounded-card border border-pearl bg-pearl/20 p-4">
            <p className="font-semibold text-navy mb-3">{t(key, lang)}</p>
            <div className="space-y-2 text-sm">
              <label className="block">
                <span className="text-slate-light">{t('contribNegPct', lang)}</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={params[key].contribNegPct}
                  onChange={(e) => updateParam(key, 'contribNegPct', Number(e.target.value) || 0)}
                  className="w-full rounded border border-pearl p-2 mt-1"
                />
              </label>
              <label className="block">
                <span className="text-slate-light">{t('lossOfChancePct', lang)}</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={params[key].lossOfChancePct}
                  onChange={(e) => updateParam(key, 'lossOfChancePct', Number(e.target.value) || 0)}
                  className="w-full rounded border border-pearl p-2 mt-1"
                />
              </label>
            </div>
            <div className="mt-3 pt-3 border-t border-pearl">
              <p className="text-xs text-slate-light">{t('totalBefore', lang)}</p>
              <p className="font-semibold">{formatCurrency(lang, results.find((r) => r.labelKey === key)!.before.avg)}</p>
              <p className="text-xs text-slate-light mt-1">{t('totalAfter', lang)}</p>
              <p className="font-semibold">{formatCurrency(lang, results.find((r) => r.labelKey === key)!.after.avg)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="btn-primary px-4 py-2 text-sm inline-flex items-center gap-2 disabled:opacity-60"
        >
          <FileDown className="w-4 h-4" />
          {t('exportScenariosToWord', lang)}
        </button>
      </div>
    </div>
  );
};

export default ScenariosPanel;
