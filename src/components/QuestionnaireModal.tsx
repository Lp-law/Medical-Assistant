import React, { useState } from 'react';
import { X, FileQuestion, Check, AlertCircle } from 'lucide-react';
import { getGapQuestions, buildProposal, type Question, type QuestionnairePatch, type SheetLike } from '../utils/questionnaire';
import { t, type Lang } from '../utils/calcI18n';

type Props = {
  lang: Lang;
  sheet: SheetLike;
  onApplyPatch: (patch: QuestionnairePatch) => void;
  onClose: () => void;
};

const QuestionnaireModal: React.FC<Props> = ({ lang, sheet, onApplyPatch, onClose }) => {
  const questions = getGapQuestions(sheet);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [preview, setPreview] = useState<QuestionnairePatch | null>(null);
  const [error, setError] = useState<string | null>(null);

  const questionText = (q: Question): string => (lang === 'he' ? q.text_he : q.text_en);

  const handleBuildProposal = () => {
    setError(null);
    const requiredIds = questions.map((q) => q.id);
    const missing = requiredIds.filter((id) => answers[id] === undefined || answers[id] === '');
    if (missing.length > 0) {
      setError(t('answersRequired', lang));
      return;
    }
    const patch = buildProposal(answers, sheet);
    setPreview(patch);
  };

  const handleApply = () => {
    if (preview && Object.keys(preview).length > 0) {
      onApplyPatch(preview);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="questionnaire-title"
      dir={lang === 'he' ? 'rtl' : 'ltr'}
    >
      <div className="bg-white rounded-card shadow-card-xl border border-pearl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-pearl">
          <h2 id="questionnaire-title" className="text-lg font-semibold text-navy flex items-center gap-2">
            <FileQuestion className="w-5 h-5" />
            {t('questionnaire', lang)}
          </h2>
          <button type="button" onClick={onClose} className="text-slate hover:text-navy" aria-label={t('cancel', lang)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto space-y-4">
          {questions.length === 0 ? (
            <p className="text-slate">{t('noQuestions', lang)}</p>
          ) : (
            <>
              {error && (
                <div className="rounded-card border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900 flex items-center gap-2" role="alert">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
              {!preview ? (
                <>
                  {questions.map((q) => (
                    <div key={q.id} className="space-y-1">
                      <label className="block text-sm font-medium text-navy">{questionText(q)}</label>
                      {q.type === 'percent' || q.type === 'number' ? (
                        <input
                          type="number"
                          min={q.min ?? 0}
                          max={q.max ?? 100}
                          value={answers[q.id] ?? ''}
                          onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value === '' ? '' : Number(e.target.value) }))}
                          className="w-full rounded-card border border-pearl bg-white p-2 text-sm"
                        />
                      ) : (
                        <input
                          type="text"
                          value={String(answers[q.id] ?? '')}
                          onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                          className="w-full rounded-card border border-pearl bg-white p-2 text-sm"
                        />
                      )}
                    </div>
                  ))}
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-navy">{t('previewChanges', lang)}</p>
                  <ul className="text-sm text-slate list-disc list-inside">
                    {preview.contributoryNegligencePercent !== undefined && (
                      <li>{t('contribNegPct', lang)}: {preview.contributoryNegligencePercent}%</li>
                    )}
                    {preview.attorneyFeePercent !== undefined && (
                      <li>{t('attorneyFee', lang)}: {preview.attorneyFeePercent}%</li>
                    )}
                    {preview.plaintiffExpenses !== undefined && (
                      <li>{t('plaintiffExpenses', lang)}: ₪ {preview.plaintiffExpenses}</li>
                    )}
                    {preview.reductions && preview.reductions.length > sheet.reductions.length && (
                      <li>{t('reductionsSection', lang)}: +1</li>
                    )}
                    {preview.defendants && (
                      <li>{t('defendantsSection', lang)}: {preview.defendants.length} {t('defendantName', lang)}s</li>
                    )}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-pearl flex justify-end gap-2">
          {!preview ? (
            <>
              <button type="button" onClick={onClose} className="btn-outline px-4 py-2 text-sm">
                {t('cancel', lang)}
              </button>
              <button type="button" onClick={handleBuildProposal} className="btn-primary px-4 py-2 text-sm inline-flex items-center gap-2">
                {t('buildProposal', lang)}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setPreview(null)} className="btn-outline px-4 py-2 text-sm">
                {t('cancel', lang)}
              </button>
              <button type="button" onClick={handleApply} className="btn-primary px-4 py-2 text-sm inline-flex items-center gap-2">
                <Check className="w-4 h-4" />
                {t('apply', lang)}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuestionnaireModal;
