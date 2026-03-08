import React, { useMemo, useState } from 'react';
import { Bot, Send, X, Search, ExternalLink } from 'lucide-react';
import { assistantAnswer, AssistantDocumentHit } from '../services/assistantApi';
import { openAttachment } from '../utils/openAttachment';

type Props = {
  mode?: 'documents' | 'calculator';
  onOpenDocumentsWithQuery?: (query: string, categoryName?: string) => void;
  onReLogin?: () => void;
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

type AssistantErrorType = 'session_expired' | 'rate_limited' | 'server_error' | 'network_error' | 'timeout' | 'unknown';
const getAssistantErrorInfo = (e: unknown): { type: AssistantErrorType; message: string; retryAfterSeconds?: number } => {
  const err = e as { status?: number; message?: string; retryAfterSeconds?: number };
  const status = err?.status;
  const msg = (err?.message ?? '').toString();
  if (status === 401 || status === 403) {
    return { type: 'session_expired', message: 'ההתחברות פגה. נא להתחבר מחדש.' };
  }
  if (status === 429 || msg === 'rate_limited') {
    const sec = err?.retryAfterSeconds ?? 60;
    return { type: 'rate_limited', message: `יותר מדי בקשות. נא לנסות שוב בעוד ${sec} שניות.`, retryAfterSeconds: sec };
  }
  if (status === 408 || msg === 'timeout') {
    return { type: 'timeout', message: 'הבקשה ארכה יותר מדי. נא לנסות שוב.' };
  }
  if (status && status >= 500) {
    return { type: 'server_error', message: 'שגיאה בשרת. נא לנסות שוב.' };
  }
  if (msg === 'Failed to fetch' || msg.includes('NetworkError') || msg.includes('network')) {
    return { type: 'network_error', message: 'בעיית רשת. וודא את החיבור ונסה שוב.' };
  }
  return { type: 'unknown', message: msg || 'החיפוש נכשל. נא לנסות שוב.' };
};

const BotAssistantWidget: React.FC<Props> = ({ mode = 'documents', onOpenDocumentsWithQuery, onReLogin, open: controlledOpen, onOpenChange }) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryKey, setCategoryKey] = useState<BotCategoryKey>('all');
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [expandedDocId] = useState<string | null>(null);
  const [openingAttachmentId, setOpeningAttachmentId] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<AssistantDocumentHit | null>(null);

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

      const res = await assistantAnswer(q, { limit, categoryName });
      const assistantTurn: ChatTurn = {
        id: `${Date.now()}-a`,
        role: 'assistant',
        text: res.answer ?? 'לא התקבלה תשובה. הנה המסמכים הרלוונטיים.',
        createdAt: new Date().toISOString(),
        queries: res.queries ?? [],
        documents: res.documents ?? [],
        categoryName,
        limit,
      };
      setHistory((prev) => [...prev, assistantTurn]);
      setQuestion('');
    } catch (e: unknown) {
      const info = getAssistantErrorInfo(e);
      setError(info.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    const lastUser = [...history].reverse().find((t) => t.role === 'user');
    if (lastUser && lastUser.role === 'user') {
      ask({ question: lastUser.text });
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

  if (mode === 'calculator') {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 rounded-full bg-navy text-gold shadow-card-xl px-5 py-3 hover:bg-navy/90 transition inline-flex items-center gap-3 animate-bot-float"
          aria-label="פתח עוזר"
        >
          <Bot className="w-5 h-5" />
          <span className="text-sm font-semibold">עוזר</span>
        </button>
        {isOpen && (
          <div className="fixed inset-0 z-50 bg-black/30 flex items-end md:items-center justify-center p-4" dir="rtl">
            <div className="w-full max-w-md rounded-card bg-white shadow-card-xl border border-pearl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-pearl">
                <div className="inline-flex items-center gap-3">
                  <div className="bot-mascot bot-mascot--idle" aria-hidden="true">
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
                  <span className="text-sm font-semibold text-navy">עוזר למחשבון הנזק</span>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="text-slate hover:text-navy transition" aria-label="סגור">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-5 py-6 text-slate text-sm">
                <p className="mb-3">בגרסאות הבאות תוכל לשאול כאן שאלות על חישובים, הפחתות, אשם תורם ואחוזי שכ&quot;ט.</p>
                <p className="text-xs text-slate-light">המחשבון עצמו נמצא למעלה – הוסף שורות, הזן סכומים וייצא ל-CSV או JSON.</p>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

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

              {error && (
                <div className="rounded-card border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
                  <p className="font-semibold">{error}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="rounded-full bg-navy text-gold px-4 py-2 text-xs font-semibold hover:bg-navy/90 transition"
                    >
                      נסה שוב
                    </button>
                    {(error.includes('התחברות') || error.includes('פגה')) && (
                      <button
                        type="button"
                        onClick={() => { setError(null); onReLogin?.(); setOpen(false); }}
                        className="rounded-full border border-navy text-navy px-4 py-2 text-xs font-semibold hover:bg-navy/5 transition"
                      >
                        התחבר מחדש
                      </button>
                    )}
                  </div>
                </div>
              )}

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
                                        onClick={() => onOpenDocumentsWithQuery?.(q, t.categoryName)}
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
                                      <div
                                        key={d.id}
                                        className="rounded-card border border-pearl bg-white p-3 hover:shadow-card-xl transition cursor-pointer"
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setSelectedDoc(d)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' || e.key === ' ') setSelectedDoc(d);
                                        }}
                                        title="פתח פרטי מסמך"
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div>
                                            <button
                                              type="button"
                                              className="text-sm font-semibold text-navy hover:underline text-right"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedDoc(d);
                                              }}
                                              title="לחץ להצגת תקציר וקישור לקובץ"
                                            >
                                              {d.title}
                                            </button>
                                            <p className="text-xs text-slate mt-1">
                                              {[d.bookChapter, d.categoryName, formatDate(d.createdAt), d.source]
                                                .filter(Boolean)
                                                .join(' • ')}
                                            </p>
                                          </div>
                                          <div className="flex flex-col items-end gap-2">
                                            <button
                                              type="button"
                                              className="text-xs text-slate hover:text-navy transition inline-flex items-center gap-1"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onOpenDocumentsWithQuery?.(d.title, d.categoryName);
                                              }}
                                              title="פתח במסך מסמכים"
                                            >
                                              <Search className="w-4 h-4" />
                                              מסמכים
                                            </button>
                                            {d.attachmentUrl ? (
                                              <button
                                                type="button"
                                                onClick={async () => {
                                                  // prevent opening the modal when clicking the button
                                                  // (the parent card is clickable)
                                                  if (!d.attachmentUrl) return;
                                                  setOpeningAttachmentId(d.id);
                                                  try {
                                                    await openAttachment(d.attachmentUrl, d.title);
                                                  } finally {
                                                    setOpeningAttachmentId((prev) => (prev === d.id ? null : prev));
                                                  }
                                                }}
                                                className="rounded-full bg-navy text-gold px-3 py-1.5 text-xs font-semibold hover:bg-navy/90 transition inline-flex items-center gap-1"
                                                title="פתח קובץ מצורף"
                                                onClickCapture={(e) => e.stopPropagation()}
                                              >
                                                <ExternalLink className="w-4 h-4" />
                                                {openingAttachmentId === d.id ? 'פותח…' : 'פתח קובץ'}
                                              </button>
                                            ) : (
                                              <span className="text-[11px] text-slate-light">אין קובץ</span>
                                            )}
                                          </div>
                                        </div>
                                        <p className="text-xs text-slate mt-2">
                                          {expandedDocId === d.id ? (d.summary || 'ללא תקציר') : previewText(d.summary || 'ללא תקציר')}
                                        </p>
                                        {d.contentSnippet?.trim() && (
                                          <p className="text-[11px] text-slate-light mt-1.5 pr-2 border-r-2 border-gold/40" title="קטע מתוך המסמך">
                                            <span className="font-semibold text-slate">קטע מתוך המסמך: </span>
                                            {expandedDocId === d.id ? (d.contentSnippet.trim().slice(0, 800) + (d.contentSnippet.length > 800 ? '…' : '')) : previewText(d.contentSnippet.trim(), 220)}
                                          </p>
                                        )}
                                        {isLongText(d.summary || '', 180) && (
                                          <div className="mt-1 flex justify-end">
                                            <button
                                              type="button"
                                              className="text-[11px] text-navy hover:underline"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedDoc(d);
                                              }}
                                            >
                                              הצג תקציר מלא
                                            </button>
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

      {selectedDoc && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          dir="rtl"
          onClick={() => setSelectedDoc(null)}
        >
          <div
            className="w-full max-w-2xl rounded-card bg-white shadow-card-xl border border-pearl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-pearl">
              <div className="space-y-1">
                <p className="text-base font-semibold text-navy">{selectedDoc.title}</p>
                <p className="text-xs text-slate">
                  {selectedDoc.categoryName} • {formatDate(selectedDoc.createdAt)} • {selectedDoc.source}
                </p>
              </div>
              <button
                type="button"
                className="text-slate hover:text-navy transition"
                onClick={() => setSelectedDoc(null)}
                aria-label="סגור"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-light mb-2">תקציר מלא</p>
                <p className="text-sm text-slate whitespace-pre-wrap">
                  {selectedDoc.summary?.trim()
                    ? selectedDoc.summary
                    : selectedDoc.contentSnippet?.trim()
                      ? selectedDoc.contentSnippet
                      : 'ללא תקציר'}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-pearl">
                <button
                  type="button"
                  className="btn-outline text-[11px] px-4 py-2 inline-flex items-center gap-2"
                    onClick={() => {
                    onOpenDocumentsWithQuery?.(selectedDoc.title, selectedDoc.categoryName);
                    setSelectedDoc(null);
                    setOpen(false);
                  }}
                >
                  <Search className="w-4 h-4" />
                  פתח במסך מסמכים
                </button>

                {selectedDoc.attachmentUrl ? (
                  <button
                    type="button"
                    className="btn-primary text-[11px] px-4 py-2 inline-flex items-center gap-2"
                    onClick={async () => {
                      const url = selectedDoc.attachmentUrl;
                      if (!url) return;
                      setOpeningAttachmentId(selectedDoc.id);
                      try {
                        await openAttachment(url, selectedDoc.title);
                      } finally {
                        setOpeningAttachmentId((prev) => (prev === selectedDoc.id ? null : prev));
                      }
                    }}
                  >
                    <ExternalLink className="w-4 h-4" />
                    {openingAttachmentId === selectedDoc.id ? 'פותח…' : 'פתח קובץ מצורף'}
                  </button>
                ) : (
                  <span className="text-xs text-slate-light">אין קובץ מצורף למסמך זה</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BotAssistantWidget;


