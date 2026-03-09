import React, { useEffect, useState } from 'react';
import { Book, X, FileText, Loader2 } from 'lucide-react';
import { fetchBookChapters, openChapterPdf, type BookChapter } from '../services/booksApi';

type Props = {
  open: boolean;
  onClose: () => void;
};

const BOOK_TITLE = 'תחשיבי נזק';

const BookChaptersModal: React.FC<Props> = ({ open, onClose }) => {
  const [chapters, setChapters] = useState<BookChapter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLoading(true);
    fetchBookChapters()
      .then((data) => setChapters(data.chapters ?? []))
      .catch((e) => setError((e as Error).message ?? 'שגיאה בטעינה'))
      .finally(() => setLoading(false));
  }, [open]);

  const handleOpenChapter = async (ch: BookChapter) => {
    if (openingId) return;
    setOpeningId(ch.id);
    try {
      await openChapterPdf(ch.id, ch.title);
      onClose();
    } catch (e) {
      setError((e as Error).message ?? 'לא ניתן לפתוח את הפרק');
    } finally {
      setOpeningId(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" dir="rtl" role="dialog" aria-modal="true" aria-labelledby="book-modal-title">
      <div className="bg-white rounded-card shadow-card-xl border border-pearl w-full max-w-md max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-pearl">
          <h2 id="book-modal-title" className="text-lg font-semibold text-navy flex items-center gap-2">
            <Book className="w-5 h-5 text-gold" aria-hidden="true" />
            {BOOK_TITLE}
          </h2>
          <button type="button" onClick={onClose} className="p-2 text-slate hover:text-navy rounded-full hover:bg-pearl/50 transition" aria-label="סגור">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-slate">
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
              <span>טוען פרקים…</span>
            </div>
          )}
          {error && (
            <p className="text-sm text-red-600 py-4" role="alert">
              {error}
            </p>
          )}
          {!loading && !error && chapters.length === 0 && (
            <div className="text-sm text-slate py-4 space-y-2">
              <p className="font-medium">טרם נטענו פרקים.</p>
              <p className="text-xs text-slate-light">כדי שהרשימה תופיע, יש להריץ בשרת את טעינת הספר (פקודה: <code className="bg-pearl/60 px-1 rounded">npm run ingest-book</code> מתוך תיקיית ה-API). אם הרשימה אמורה להיות זמינה – פנה למנהל המערכת.</p>
            </div>
          )}
          {!loading && chapters.length > 0 && (
            <ul className="space-y-1">
              {chapters.map((ch) => (
                <li key={ch.id}>
                  <button
                    type="button"
                    onClick={() => handleOpenChapter(ch)}
                    disabled={openingId !== null}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-card border border-pearl text-right text-navy hover:bg-pearl/40 hover:border-navy/20 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <FileText className="w-4 h-4 text-slate flex-shrink-0" aria-hidden="true" />
                    <span className="flex-1 font-medium">{ch.title}</span>
                    {openingId === ch.id && <Loader2 className="w-4 h-4 animate-spin text-slate flex-shrink-0" aria-hidden="true" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookChaptersModal;
