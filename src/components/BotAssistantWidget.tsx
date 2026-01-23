import React, { useMemo, useState } from 'react';
import { Bot, Send, X, Search, ExternalLink } from 'lucide-react';
import { assistantSearch, AssistantDocumentHit } from '../services/assistantApi';

type Props = {
  onOpenDocumentsWithQuery: (query: string) => void;
};

const formatDate = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('he-IL');
};

const BotAssistantWidget: React.FC<Props> = ({ onOpenDocumentsWithQuery }) => {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queries, setQueries] = useState<string[]>([]);
  const [docs, setDocs] = useState<AssistantDocumentHit[]>([]);

  const canAsk = useMemo(() => question.trim().length >= 3 && !loading, [loading, question]);

  const ask = async () => {
    if (!canAsk) return;
    setLoading(true);
    setError(null);
    try {
      const res = await assistantSearch(question.trim(), 10);
      setQueries(res.queries ?? []);
      setDocs(res.documents ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'assistant_failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating launcher */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 left-5 z-40 rounded-full bg-navy text-gold shadow-card-xl px-4 py-3 hover:bg-navy/90 transition inline-flex items-center gap-2"
        aria-label="פתח עוזר חיפוש"
      >
        <Bot className="w-5 h-5 animate-pulse" />
        <span className="text-sm font-semibold hidden md:inline">עוזר חיפוש</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-end md:items-center justify-center p-4" dir="rtl">
          <div className="w-full max-w-2xl rounded-card bg-white shadow-card-xl border border-pearl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-pearl">
              <div>
                <p className="text-sm font-semibold text-navy">עוזר חיפוש (AI)</p>
                <p className="text-xs text-slate mt-1">שאל שאלה, ואקפיץ חיפושים ותוצאות ממאגר המסמכים.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate hover:text-navy transition"
                aria-label="סגור"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-full border border-pearl bg-pearl/60 px-4 py-2 text-sm focus:border-gold focus:ring-1 focus:ring-gold outline-none transition"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="לדוגמה: חוות דעת נוירולוגית על תאונת דרכים + כאב וסבל"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      ask();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={ask}
                  disabled={!canAsk}
                  className="rounded-full bg-gold text-navy px-4 py-2 text-sm font-semibold hover:bg-gold-light transition disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {loading ? 'מחפש...' : 'חפש'}
                </button>
              </div>

              {error && <div className="text-danger text-sm font-semibold">{error}</div>}

              {queries.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-light mb-2">שאילתות מוצעות</p>
                  <div className="flex flex-wrap gap-2">
                    {queries.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => onOpenDocumentsWithQuery(q)}
                        className="rounded-full border border-pearl bg-white px-3 py-1 text-xs text-navy hover:bg-pearl/50 transition inline-flex items-center gap-1"
                        title="פתח במסך מסמכים"
                      >
                        <Search className="w-3 h-3" />
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {docs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-light">תוצאות מובילות</p>
                  <div className="max-h-[45vh] overflow-auto space-y-2 pr-1">
                    {docs.map((d) => (
                      <div key={d.id} className="rounded-card border border-pearl bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-navy">{d.title}</p>
                            <p className="text-xs text-slate mt-1">
                              {d.categoryName} • {formatDate(d.createdAt)} • {d.source}
                            </p>
                          </div>
                          {d.attachmentUrl && (
                            <a
                              href={d.attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-gold hover:text-gold-light transition inline-flex items-center gap-1 text-xs"
                            >
                              <ExternalLink className="w-4 h-4" />
                              קובץ
                            </a>
                          )}
                        </div>
                        {d.summary && <p className="text-xs text-slate mt-2 line-clamp-3">{d.summary}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {queries.length === 0 && docs.length === 0 && (
                <p className="text-xs text-slate">
                  טיפ: כתוב משפט אחד עם המילים המרכזיות (אבחנה/מומחה/סוג מסמך/הליך) ולחץ “חפש”.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BotAssistantWidget;


