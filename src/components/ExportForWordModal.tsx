import React, { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import type { ExportPayload } from '../utils/exportForWordHtml';
import { exportForWord } from '../utils/exportForWord';
import type { ExportLang } from '../utils/exportForWordI18n';

type Props = {
  payload: ExportPayload;
  onClose: () => void;
};

type ContentMode = 'tableOnly' | 'tableAndChart';

const ExportForWordModal: React.FC<Props> = ({ payload, onClose }) => {
  const [lang, setLang] = useState<ExportLang>('he');
  const [contentMode, setContentMode] = useState<ContentMode>('tableAndChart');
  const [includeReductions, setIncludeReductions] = useState(true);
  const [includeDefendants, setIncludeDefendants] = useState(true);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);

  const handleCopy = async () => {
    setLoading(true);
    setCopied(false);
    setFallbackMessage(null);
    try {
      const result = await exportForWord(payload, {
        lang,
        includeChart: contentMode === 'tableAndChart',
        includeReductions,
        includeDefendants,
      });
      setCopied(result.success);
      if (result.fallbackMessage) setFallbackMessage(result.fallbackMessage);
    } catch (e) {
      setFallbackMessage(
        lang === 'he'
          ? 'ההעתקה נכשלה. נסה שוב או ייצוא לקובץ DOCX.'
          : 'Copy failed. Try again or export to DOCX.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-word-title"
      dir={lang === 'he' ? 'rtl' : 'ltr'}
    >
      <div className="bg-white rounded-card shadow-card-xl border border-pearl max-w-md w-full overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-pearl">
          <h2 id="export-word-title" className="text-lg font-semibold text-navy">
            {lang === 'he' ? 'יצוא ל-Word' : 'Export for Word'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate hover:text-navy transition"
            aria-label={lang === 'he' ? 'סגור' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-navy mb-2">
              {lang === 'he' ? 'שפה' : 'Language'}
            </label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="export-lang"
                  checked={lang === 'he'}
                  onChange={() => setLang('he')}
                  className="rounded-full"
                />
                <span>עברית</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="export-lang"
                  checked={lang === 'en-GB'}
                  onChange={() => setLang('en-GB')}
                  className="rounded-full"
                />
                <span>English (UK)</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-navy mb-2">
              {lang === 'he' ? 'תוכן' : 'Content'}
            </label>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="export-content"
                  checked={contentMode === 'tableOnly'}
                  onChange={() => setContentMode('tableOnly')}
                  className="rounded-full"
                />
                <span>{lang === 'he' ? 'טבלה בלבד' : 'Table only'}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="export-content"
                  checked={contentMode === 'tableAndChart'}
                  onChange={() => setContentMode('tableAndChart')}
                  className="rounded-full"
                />
                <span>{lang === 'he' ? 'טבלה + תרשים' : 'Table + chart'}</span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeReductions}
                onChange={(e) => setIncludeReductions(e.target.checked)}
                className="rounded"
              />
              <span>
                {lang === 'he'
                  ? 'כלול הפחתות והתאמות'
                  : 'Include reductions & adjustments'}
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeDefendants}
                onChange={(e) => setIncludeDefendants(e.target.checked)}
                className="rounded"
              />
              <span>
                {lang === 'he'
                  ? 'כלול חלוקת נתבעים'
                  : 'Include defendants allocation'}
              </span>
            </label>
          </div>

          {fallbackMessage && (
            <div
              className="rounded-card border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900"
              role="alert"
            >
              {fallbackMessage}
            </div>
          )}

          {copied && !fallbackMessage && (
            <p className="text-sm text-green-700 font-medium flex items-center gap-2">
              <Check className="w-4 h-4" />
              {lang === 'he' ? 'הועתק ללוח' : 'Copied to clipboard'}
            </p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-pearl flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-outline px-4 py-2 text-sm"
          >
            {lang === 'he' ? 'ביטול' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={loading}
            className="btn-primary px-4 py-2 text-sm inline-flex items-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <span>{lang === 'he' ? 'מעתיק…' : 'Copying…'}</span>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>{lang === 'he' ? 'העתק ללוח' : 'Copy to clipboard'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportForWordModal;
