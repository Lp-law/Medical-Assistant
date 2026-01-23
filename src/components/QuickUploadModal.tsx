import React, { useMemo, useState } from 'react';
import { UploadCloud, X } from 'lucide-react';
import { uploadDocument } from '../services/documentsApi';

type Props = {
  isOpen: boolean;
  categoryName: string;
  onClose: () => void;
  onUploaded?: () => void;
};

const QuickUploadModal: React.FC<Props> = ({ isOpen, categoryName, onClose, onUploaded }) => {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canSubmit = useMemo(() => Boolean(title.trim()) && Boolean(file) && !loading, [file, loading, title]);

  if (!isOpen) return null;

  const submit = async () => {
    if (!canSubmit || !file) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const created = await uploadDocument({
        title: title.trim(),
        categoryName,
        summary: summary.trim() || undefined,
        file,
      });
      setSuccess(`המסמך "${created.title}" הועלה בהצלחה.`);
      setTitle('');
      setSummary('');
      setFile(null);
      onUploaded?.();
    } catch (e: any) {
      setError(e?.message ?? 'upload_failed');
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    if (loading) return;
    setError(null);
    setSuccess(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" dir="rtl">
      <div className="w-full max-w-lg rounded-card bg-white shadow-card-xl border border-pearl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-pearl">
          <div>
            <p className="text-sm font-semibold text-navy">העלאת מסמך</p>
            <p className="text-xs text-slate mt-1">קטגוריה: {categoryName}</p>
          </div>
          <button onClick={close} className="text-slate hover:text-navy transition" aria-label="סגור">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-light">שם מסמך</label>
            <input
              className="mt-1 w-full rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold outline-none"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="למשל: סיכומים בתיק X / תחשיב נזק / חוות דעת..."
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-light">תיאור קצר (אופציונלי)</label>
            <textarea
              className="mt-1 w-full rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold outline-none h-24"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="כמה שורות שיעזרו בחיפוש..."
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-light">קובץ (PDF / Word)</label>
            <input
              className="mt-1 w-full text-sm"
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => {
                const next = e.target.files?.[0] ?? null;
                setFile(next);
                if (next && !title.trim()) {
                  setTitle(next.name.replace(/\.(pdf|docx|doc)$/i, ''));
                }
              }}
            />
          </div>

          {error && <div className="text-danger text-sm font-semibold">{String(error)}</div>}
          {success && <div className="text-emerald-700 text-sm font-semibold">{success}</div>}
        </div>

        <div className="px-5 py-4 border-t border-pearl flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={close}
            className="rounded-full border border-pearl px-4 py-2 text-sm text-slate hover:bg-pearl/60 transition"
            disabled={loading}
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={submit}
            className="btn-primary px-5 py-2 text-sm font-bold disabled:opacity-50"
            disabled={!canSubmit}
          >
            <span className="inline-flex items-center gap-2">
              <UploadCloud className="w-4 h-4" />
              {loading ? 'מעלה...' : 'העלה למסד הידע'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickUploadModal;


