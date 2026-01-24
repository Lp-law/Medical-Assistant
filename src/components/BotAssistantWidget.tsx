import React, { useMemo, useState } from 'react';
import { Bot, Send, X, Search, ExternalLink } from 'lucide-react';
import { assistantSearch, AssistantDocumentHit } from '../services/assistantApi';

type Props = {
  onOpenDocumentsWithQuery: (query: string, categoryName?: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const BotMascot: React.FC<{ loading: boolean; label: string }> = ({ loading, label }) => {
  return (
    <div className="inline-flex items-center gap-3">
      <div className={`bot-mascot ${loading ? 'bot-mascot--walk' : 'bot-mascot--idle'}`} aria-hidden="true">
        <div className="bot-mascot__head">
          <div className="bot-mascot__eye bot-mascot__eye--left" />
          <div className="bot-mascot__eye bot-mascot__eye--right" />
          <div className="bot-mascot__mouth" />
        </div>
        <div className="bot-mascot__legs">
          <div className="bot-mascot__leg bot-mascot__leg--left" />
          <div className="bot-mascot__leg bot-mascot__leg--right" />
        </div>
      </div>
      <div className="bot-bubble">
        <span className="text-xs font-semibold text-navy">{label}</span>
      </div>
    </div>
  );
};

const formatDate = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('he-IL');
};

const previewText = (text: string, max = 180): string => {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(20, max - 1))}…`;
};

const isLongText = (text: string, max = 180): boolean => {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  return t.length > max;
};

type BotCategoryKey = 'all' | 'judgments' | 'damages' | 'opinions' | 'summaries';
const CATEGORY_NAME: Record<Exclude<BotCategoryKey, 'all'>, string> = {
  judgments: 'פסקי דין',
  damages: 'תחשיבי נזק',
  opinions: 'חוות דעת',
  summaries: 'סיכומים',
};

type ChatTurn =
  | { id: string; role: 'user'; text: string; createdAt: string }
  | {
      id: string;
      role: 'assistant';
      text: string;
      createdAt: string;
      queries: string[];
      documents: AssistantDocumentHit[];
      categoryName?: string;
      limit: number;
    };

const BotAssistantWidget: React.FC<Props> = ({ onOpenDocumentsWithQuery, open: controlledOpen, onOpenChange }) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryKey, setCategoryKey] = useState<BotCategoryKey>('all');
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);

  const isOpen = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    if (onOpenChange) onOpenChange(next);
    else setInternalOpen(next);
  };

  const canAsk = useMemo(() => question.trim().length >= 3 && !loading, [loading, question]);

  const ask = async (override?: { question?: string; limit?: number }) => {
    const q = (override?.question ?? question).trim();
    if (q.length < 3 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const limit = override?.limit ?? 10;
      const categoryName = categoryKey === 'all' ? undefined : CATEGORY_NAME[categoryKey];

      const now = new Date().toISOString();
      setHistory((prev) => [
        ...prev,
        { id: `${Date.now()}-u`, role: 'user', text: q, createdAt: now },
      ]);

      const res = await assistantSearch(q, { limit, categoryName });
      const assistantTurn: ChatTurn = {
        id: `${Date.now()}-a`,
        role: 'assistant',
        text: 'הנה התוצאות שמצאתי במאגר הידע. אפשר ללחוץ על שאילתה כדי לפתוח במסך מסמכים.',
        createdAt: new Date().toISOString(),
        queries: res.queries ?? [],
        documents: res.documents ?? [],
        categoryName,
        limit,
      };
      setHistory((prev) => [...prev, assistantTurn]);
      setQuestion('');
    } catch (e: any) {
      setError(e?.message ?? 'assistant_failed');
    } finally {
      setLoading(false);
    }
  };

  const lastAssistant = useMemo(() => {
    for (let i = history.length - 1; i >= 0; i -= 1) {
      const t = history[i];
      if (t.role === 'assistant') return t;
    }
    return null;
  }, [history]);

  const loadMore = async () => {
    const lastUser = [...history].reverse().find((t) => t.role === 'user') as ChatTurn | undefined;
    if (!lastUser || lastUser.role !== 'user') return;
    const nextLimit = Math.min((lastAssistant?.limit ?? 10) + 10, 50);
    await ask({ question: lastUser.text, limit: nextLimit });
  };

  return (
    <>
      {/* Floating launcher */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 rounded-full bg-navy text-gold shadow-card-xl px-5 py-3 hover:bg-navy/90 transition inline-flex items-center gap-3 animate-bot-float"
        aria-label="פתח עוזר חיפוש"
      >
        <div className="hidden sm:block">
          <BotMascot loading={loading} label={loading ? 'מחפש…' : 'צריך עזרה?'} />
        </div>
        <div className="sm:hidden inline-flex items-center gap-2">
          <Bot className={`w-5 h-5 ${loading ? 'animate-spin' : 'animate-pulse'}`} />
          <span className="text-sm font-semibold">עוזר</span>
        </div>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-end md:items-center justify-center p-4" dir="rtl">
          <div className="w-full max-w-2xl rounded-card bg-white shadow-card-xl border border-pearl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-pearl">
              <div className="space-y-2">
                <BotMascot
                  loading={loading}
                  label={loading ? 'אני מחפש במאגר המסמכים…' : 'שאל שאלה ואני אמצא מסמכים רלוונטיים'}
                />
                <p className="text-xs text-slate">אפשר גם לבחור קטגוריה כדי לצמצם תוצאות.</p>
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
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCategoryKey('all')}
                  className={`rounded-full px-3 py-1 text-xs border transition ${
                    categoryKey === 'all' ? 'bg-navy text-gold border-navy' : 'bg-white border-pearl text-slate'
                  }`}
                >
                  הכל
                </button>
                {(Object.keys(CATEGORY_NAME) as Array<Exclude<BotCategoryKey, 'all'>>).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setCategoryKey(k)}
                    className={`rounded-full px-3 py-1 text-xs border transition ${
                      categoryKey === k ? 'bg-navy text-gold border-navy' : 'bg-white border-pearl text-slate'
                    }`}
                  >
                    {CATEGORY_NAME[k]}
                  </button>
                ))}
              </div>

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
                  onClick={() => ask()}
                  disabled={!canAsk}
                  className="rounded-full bg-gold text-navy px-4 py-2 text-sm font-semibold hover:bg-gold-light transition disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {loading ? 'מחפש...' : 'חפש'}
                </button>
              </div>

              {error && <div className="text-danger text-sm font-semibold">{error}</div>}

              {history.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-slate-light">שיחה</p>
                  <div className="max-h-[45vh] overflow-auto space-y-3 pr-1">
                    {history.map((t) => (
                      <div key={t.id} className={t.role === 'user' ? 'text-right' : 'text-right'}>
                        <div
                          className={`inline-block max-w-[92%] rounded-2xl px-4 py-3 text-sm ${
                            t.role === 'user' ? 'bg-pearl/70 text-navy border border-pearl' : 'bg-white text-navy border border-pearl'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{t.text}</p>

                          {t.role === 'assistant' && (
                            <>
                              {t.queries.length > 0 && (
                                <div className="mt-3">
                                  <p className="text-xs font-semibold text-slate-light mb-2">שאילתות מוצעות</p>
                                  <div className="flex flex-wrap gap-2">
                                    {t.queries.map((q) => (
                                      <button
                                        key={`${t.id}-${q}`}
                                        type="button"
                                        onClick={() => onOpenDocumentsWithQuery(q, t.categoryName)}
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

                              {t.documents.length > 0 && (
                                <div className="mt-3 space-y-2">
                                  <p className="text-xs font-semibold text-slate-light">תוצאות מובילות</p>
                                  <div className="space-y-2">
                                    {t.documents.map((d) => (
                                      <div key={d.id} className="rounded-card border border-pearl bg-white p-3">
                                        <div className="flex items-start justify-between gap-3">
                                          <div>
                                            <button
                                              type="button"
                                              className="text-sm font-semibold text-navy hover:underline text-right"
                                              onClick={() => setExpandedDocId((prev) => (prev === d.id ? null : d.id))}
                                              title="לחץ להצגת תקציר וקישור לקובץ"
                                            >
                                              {d.title}
                                            </button>
                                            <p className="text-xs text-slate mt-1">
                                              {d.categoryName} • {formatDate(d.createdAt)} • {d.source}
                                            </p>
                                          </div>
                                          <div className="flex flex-col items-end gap-2">
                                            <button
                                              type="button"
                                              className="text-xs text-slate hover:text-navy transition inline-flex items-center gap-1"
                                              onClick={() => onOpenDocumentsWithQuery(d.title, d.categoryName)}
                                              title="פתח במסך מסמכים"
                                            >
                                              <Search className="w-4 h-4" />
                                              מסמכים
                                            </button>
                                            {d.attachmentUrl ? (
                                              <a
                                                href={d.attachmentUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="rounded-full bg-navy text-gold px-3 py-1.5 text-xs font-semibold hover:bg-navy/90 transition inline-flex items-center gap-1"
                                                title="פתח קובץ מצורף"
                                              >
                                                <ExternalLink className="w-4 h-4" />
                                                פתח קובץ
                                              </a>
                                            ) : (
                                              <span className="text-[11px] text-slate-light">אין קובץ</span>
                                            )}
                                          </div>
                                        </div>
                                        <p className="text-xs text-slate mt-2">
                                          {expandedDocId === d.id ? (d.summary || 'ללא תקציר') : previewText(d.summary || 'ללא תקציר')}
                                        </p>
                                        {isLongText(d.summary || '', 180) && (
                                          <div className="mt-1 flex justify-end">
                                            <button
                                              type="button"
                                              className="text-[11px] text-navy hover:underline"
                                              onClick={() => setExpandedDocId((prev) => (prev === d.id ? null : d.id))}
                                            >
                                              {expandedDocId === d.id ? 'הצג פחות' : 'הצג תקציר מלא'}
                                            </button>
                                          </div>
                                        )}
                                        {expandedDocId === d.id && (
                                          <div className="mt-3 pt-3 border-t border-pearl">
                                            <p className="text-[11px] font-semibold text-slate-light mb-1">תקציר מלא</p>
                                            <p className="text-xs text-slate whitespace-pre-wrap">{d.summary || 'ללא תקציר'}</p>
                                            {d.attachmentUrl && (
                                              <div className="mt-3 flex justify-end">
                                                <a
                                                  href={d.attachmentUrl}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="rounded-full bg-gold text-navy px-4 py-2 text-xs font-semibold hover:bg-gold-light transition inline-flex items-center gap-2"
                                                >
                                                  <ExternalLink className="w-4 h-4" />
                                                  פתח קובץ מצורף
                                                </a>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {lastAssistant && lastAssistant.documents.length >= lastAssistant.limit && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={loadMore}
                        disabled={loading || (lastAssistant.limit ?? 10) >= 50}
                        className="rounded-full border border-gold text-gold px-4 py-2 text-sm font-semibold hover:bg-gold/10 transition disabled:opacity-50"
                      >
                        הצג עוד תוצאות
                      </button>
                    </div>
                  )}
                </div>
              )}

              {history.length === 0 && (
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


