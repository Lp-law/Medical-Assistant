import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, UploadCloud, FileText, AlertTriangle } from 'lucide-react';
import { CategoryRecord, DocumentRecord } from '../types';
import { createCategory, listCategories, searchDocuments, updateDocumentTags, uploadDocument, uploadEml, uploadEmlBatch } from '../services/documentsApi';
import LegalDisclaimer from './LegalDisclaimer';
import { useAuth } from '../context/AuthContext';
import { openAttachment } from '../utils/openAttachment';

const badgeForCategory = (name?: string): string => {
  if (!name) return 'badge-muted';
  if (name.includes('פסק')) return 'badge-warning';
  if (name.includes('נזק')) return 'badge-strong';
  if (name.includes('חוות')) return 'badge-info';
  if (name.includes('סיכום')) return 'badge-muted';
  return 'badge-muted';
};

const formatDate = (value?: string | null): string => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('he-IL');
};

type Props = {
  initialQuery?: string;
  initialCategoryName?: string;
  initialTab?: 'search' | 'upload';
  autoSearchOnMount?: boolean;
};

const DocumentsLibrary: React.FC<Props> = ({ initialQuery, initialCategoryName, initialTab, autoSearchOnMount = true }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'search' | 'upload'>('search');

  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);

  // Search state
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<DocumentRecord[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord | null>(null);
  const [openingAttachmentId, setOpeningAttachmentId] = useState<string | null>(null);

  // Upload state
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategoryId, setUploadCategoryId] = useState<string>('');
  const [uploadSummary, setUploadSummary] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // EML import state
  const [emlFile, setEmlFile] = useState<File | null>(null);
  const [emlLoading, setEmlLoading] = useState(false);
  const [emlError, setEmlError] = useState<string | null>(null);
  const [emlSuccess, setEmlSuccess] = useState<string | null>(null);
  const [emlBatch, setEmlBatch] = useState<Array<{ name: string; status: 'pending' | 'uploading' | 'done' | 'error'; error?: string }>>([]);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [topicsDraft, setTopicsDraft] = useState('');
  const [keywordsDraft, setKeywordsDraft] = useState('');
  const [tagsSaving, setTagsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setCategoriesLoading(true);
      setCategoriesError(null);
      try {
        const items = await listCategories();
        if (!cancelled) {
          setCategories(items);
          if (!uploadCategoryId && items[0]?.id) {
            setUploadCategoryId(items[0].id);
          }
        }
      } catch (err: any) {
        if (!cancelled) setCategoriesError(err?.message ?? 'categories_failed');
      } finally {
        if (!cancelled) setCategoriesLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const name = (initialCategoryName ?? '').trim();
    if (!name) return;
    if (!categories.length) return;
    const match = categories.find((c) => c.name === name);
    if (match && !categoryId) {
      setCategoryId(match.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCategoryName, categories]);

  useEffect(() => {
    if (!initialTab) return;
    setActiveTab(initialTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab]);

  const canSearch = useMemo(() => Boolean(q.trim() || categoryId || from || to), [q, categoryId, from, to]);

  const runSearch = async (override?: { q?: string; categoryId?: string }) => {
    setSearchLoading(true);
    setSearchError(null);
    try {
      const qValue = (override?.q ?? q).trim();
      const categoryValue = override?.categoryId ?? categoryId;
      const payload = await searchDocuments({
        q: qValue || undefined,
        categoryId: categoryValue || undefined,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
        limit: 50,
        offset: 0,
      });
      setResults(payload.documents ?? []);
    } catch (err: any) {
      setSearchError(err?.message ?? 'search_failed');
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    if (!autoSearchOnMount) return;
    const nextQ = (initialQuery ?? '').trim();
    const nextCategoryName = (initialCategoryName ?? '').trim();

    if (!nextQ && !nextCategoryName) return;
    if (!categories.length) return;
    if (initialTab === 'upload') return;

    const nextCategoryId = nextCategoryName ? categories.find((c) => c.name === nextCategoryName)?.id : undefined;

    setActiveTab('search');
    setQ(nextQ);
    if (nextCategoryId) setCategoryId(nextCategoryId);

    // Run immediately with overrides to avoid state timing issues.
    runSearch({ q: nextQ, categoryId: nextCategoryId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSearchOnMount, initialQuery, initialCategoryName, initialTab, categories]);

  const QUICK_CATEGORY_LABELS = useMemo(
    () => (['פסקי דין', 'תחשיבי נזק', 'חוות דעת', 'סיכומים'] as const),
    [],
  );

  const quickCategoryId = (name: (typeof QUICK_CATEGORY_LABELS)[number]): string | undefined => {
    return categories.find((c) => c.name === name)?.id;
  };

  const openEditTags = (doc: DocumentRecord) => {
    setEditingId(doc.id);
    setTopicsDraft((doc.topics ?? []).join(', '));
    setKeywordsDraft((doc.keywords ?? []).join(', '));
  };

  const closeEditTags = () => {
    if (tagsSaving) return;
    setEditingId(null);
    setTopicsDraft('');
    setKeywordsDraft('');
  };

  const saveTags = async () => {
    if (!editingId) return;
    setTagsSaving(true);
    try {
      const topics = topicsDraft
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const keywords = keywordsDraft
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const updated = await updateDocumentTags(editingId, { topics, keywords });
      setResults((prev) => prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
      closeEditTags();
    } catch (err: any) {
      setSearchError(err?.message ?? 'update_tags_failed');
    } finally {
      setTagsSaving(false);
    }
  };

  const submitUpload = async () => {
    if (!uploadTitle.trim() || !uploadFile) {
      setUploadError('חובה למלא שם מסמך ולבחור קובץ.');
      return;
    }
    setUploadLoading(true);
    setUploadError(null);
    setUploadSuccess(null);
    try {
      const doc = await uploadDocument({
        title: uploadTitle.trim(),
        categoryId: uploadCategoryId || undefined,
        summary: uploadSummary.trim() || undefined,
        file: uploadFile,
      });
      setUploadSuccess(`המסמך "${doc.title}" נשמר בהצלחה.`);
      setUploadTitle('');
      setUploadSummary('');
      setUploadFile(null);
      // Optional: refresh search results
      if (activeTab === 'search') {
        await runSearch();
      }
    } catch (err: any) {
      setUploadError(err?.message ?? 'upload_failed');
    } finally {
      setUploadLoading(false);
    }
  };

  const submitEml = async (file: File) => {
    setEmlLoading(true);
    setEmlError(null);
    setEmlSuccess(null);
    try {
      const result = await uploadEml(file);
      setEmlSuccess(`הושלם: עובדו ${result.attachmentsProcessed} מצורפים ונוצרו ${result.documents?.length ?? 0} מסמכים.`);
      setEmlFile(null);
      // Optional: refresh search results if already in search tab
      if (activeTab === 'search') {
        await runSearch();
      }
    } catch (err: any) {
      setEmlError(err?.message ?? 'upload_eml_failed');
    } finally {
      setEmlLoading(false);
    }
  };

  const submitEmlBatch = async (files: File[]) => {
    const emls = files.filter((f) => (f.name ?? '').toLowerCase().endsWith('.eml'));
    if (!emls.length) {
      setEmlError('לא נמצאו קבצי .eml בתיקייה שנבחרה');
      return;
    }

    setEmlLoading(true);
    setEmlError(null);
    setEmlSuccess(null);
    setEmlBatch(emls.map((f) => ({ name: f.name, status: 'uploading' as const })));

    try {
      const result = await uploadEmlBatch(emls);
      const byName = new Map((result.results ?? []).map((r) => [r.fileName, r]));
      setEmlBatch((prev) =>
        prev.map((row) => {
          const r = byName.get(row.name);
          if (!r) return row;
          if (r.status === 'ok') return { ...row, status: 'done' as const };
          return { ...row, status: 'error' as const, error: r.error ?? 'upload_eml_failed' };
        }),
      );
      const ok = (result.results ?? []).filter((r) => r.status === 'ok').length;
      setEmlSuccess(
        `הושלם: ${ok}/${emls.length} קבצי .eml עובדו. נוצרו ${result.documentsCreated} מסמכים מתוך ${result.attachmentsProcessed} מצורפים.`,
      );
      if (activeTab === 'search') {
        await runSearch();
      }
    } catch (err: any) {
      setEmlError(err?.message ?? 'upload_eml_batch_failed');
    } finally {
      setEmlLoading(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    setCreatingCategory(true);
    try {
      const created = await createCategory(newCategoryName.trim());
      const next = [...categories.filter((c) => c.id !== created.id), created].sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      setCategories(next);
      setNewCategoryName('');
      if (!uploadCategoryId) setUploadCategoryId(created.id);
    } catch (err: any) {
      setCategoriesError(err?.message ?? 'create_category_failed');
    } finally {
      setCreatingCategory(false);
    }
  };

  const searchView = (
    <div className="space-y-6">
      <div className="card-shell">
        <div className="card-accent" />
        <div className="card-head">
          <div>
            <p className="text-sm font-semibold">חיפוש חופשי</p>
            <p className="text-xs text-slate-light">חיפוש לפי תמצית, נושאים, מילות מפתח ותוכן שחולץ</p>
          </div>
        </div>
        <div className="card-underline" />
        <div className="card-body space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold text-slate-light">פילטר מהיר (4 קטגוריות)</p>
            <div className="segmented-control">
              <button type="button" data-active={categoryId === ''} onClick={() => setCategoryId('')}>
                הכל
              </button>
              {QUICK_CATEGORY_LABELS.map((label) => {
                const id = quickCategoryId(label);
                if (!id) return null;
                return (
                  <button
                    key={`quick-${label}`}
                    type="button"
                    data-active={categoryId === id}
                    onClick={() => setCategoryId(id)}
                    title={label}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-slate-light">טקסט חופשי</label>
              <input
                className="mt-1 w-full rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="לדוגמה: הולדה בעוולה / לחץ דם / תיקון כתב תביעה..."
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-light">קטגוריה</label>
              <select
                className="mt-1 w-full rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={categoriesLoading}
              >
                <option value="">הכל</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-slate-light">מתאריך</label>
              <input
                type="date"
                className="mt-1 w-full rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-light">עד תאריך</label>
              <input
                type="date"
                className="mt-1 w-full rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              className="btn-primary px-5"
              onClick={() => runSearch()}
              disabled={!canSearch || searchLoading}
            >
              <Search className="w-4 h-4" />
              {searchLoading ? 'מחפש...' : 'חפש'}
            </button>
          </div>
          {searchError && (
            <div className="state-block state-block--error text-sm">
              <AlertTriangle className="state-block__icon" aria-hidden="true" />
              <p className="state-block__title">שגיאה בחיפוש</p>
              <p className="state-block__description">{searchError}</p>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">תוצאות ({results.length})</p>
        </div>
        {results.length === 0 ? (
          <div className="state-block">
            <FileText className="state-block__icon" aria-hidden="true" />
            <p className="state-block__title">אין תוצאות</p>
            <p className="state-block__description">נסה לשנות מילות חיפוש או מסננים.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {results.map((doc) => (
              <article key={doc.id} className="card-shell">
                <div className="card-accent" />
                <div className="card-head">
                  <div className="space-y-1">
                    <button
                      type="button"
                      className="text-base font-semibold text-right hover:underline"
                      onClick={() => setSelectedDoc(doc)}
                      title="פתח תקציר מלא וקובץ"
                    >
                      {doc.title}
                    </button>
                    <p className="text-xs text-slate-light">
                      מקור: {doc.source === 'EMAIL' ? 'מייל' : 'ידני'} · נוצר: {formatDate(doc.createdAt)}{' '}
                      {doc.emailDate ? `· תאריך מייל: ${formatDate(doc.emailDate)}` : ''}
                    </p>
                  </div>
                  <span className={badgeForCategory(doc.category?.name)}>
                    {doc.category?.name ?? 'ללא קטגוריה'}
                  </span>
                </div>
                <div className="card-underline" />
                <div className="card-body space-y-2 text-sm text-navy">
                  <p className="text-slate">{doc.summary || 'ללא תמצית'}</p>
                  {doc.topics?.length > 0 && (
                    <div className="flex flex-wrap gap-1 text-[11px] text-slate-light">
                      {doc.topics.map((t) => (
                        <span key={`${doc.id}-topic-${t}`} className="rounded-full bg-pearl px-2 py-0.5">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {doc.keywords?.length > 0 && (
                    <div className="flex flex-wrap gap-1 text-[11px] text-slate-light">
                      {doc.keywords.slice(0, 10).map((k) => (
                        <span key={`${doc.id}-kw-${k}`} className="rounded-full bg-pearl px-2 py-0.5">
                          {k}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 text-xs">
                    {doc.attachmentUrl && (
                      <button
                        type="button"
                        className="btn-outline text-[11px] px-4 py-1.5"
                        onClick={async () => {
                          setOpeningAttachmentId(doc.id);
                          try {
                            await openAttachment(doc.attachmentUrl as string, doc.title);
                          } finally {
                            setOpeningAttachmentId((prev) => (prev === doc.id ? null : prev));
                          }
                        }}
                      >
                        {openingAttachmentId === doc.id ? 'פותח…' : 'פתח קובץ'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-outline text-[11px] px-4 py-1.5"
                      onClick={() => openEditTags(doc)}
                    >
                      ערוך תגיות
                    </button>
                    <button
                      type="button"
                      className="btn-outline text-[11px] px-4 py-1.5"
                      onClick={() => setSelectedDoc(doc)}
                    >
                      תקציר מלא
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      <LegalDisclaimer />
    </div>
  );

  const uploadView = (
    <div className="space-y-6">
      <div className="card-shell">
        <div className="card-accent" />
        <div className="card-head">
          <div>
            <p className="text-sm font-semibold">ייבוא מייל ידני (.eml)</p>
            <p className="text-xs text-slate-light">
              גרור קובץ מייל מהמחשב – או בחר תיקייה (למשל: <span className="font-mono">CASES</span>) והמערכת תעבד את כל ה־.eml שבתוכה.
            </p>
          </div>
        </div>
        <div className="card-underline" />
        <div className="card-body space-y-3">
          <div
            className={`rounded-card border border-pearl bg-pearl/40 p-6 text-center text-sm text-slate ${
              emlLoading ? 'opacity-70' : 'hover:bg-pearl/60'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const f = e.dataTransfer?.files?.[0] ?? null;
              if (!f) return;
              setEmlFile(f);
              submitEml(f).catch(() => undefined);
            }}
          >
            <p className="font-semibold text-navy">גרור ושחרר כאן קובץ .eml</p>
            <p className="text-xs text-slate-light mt-2">או בחר קובץ מהמחשב</p>
            <div className="mt-3">
              <input
                type="file"
                accept=".eml,message/rfc822"
                disabled={emlLoading}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (!f) return;
                  setEmlFile(f);
                  submitEml(f).catch(() => undefined);
                  e.target.value = '';
                }}
              />
            </div>
            {emlFile && <p className="mt-2 text-[11px] text-slate-light">נבחר: {emlFile.name}</p>}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold text-slate-light">ייבוא תיקייה (מומלץ ל־CASES)</p>
            <div className="flex items-center gap-2">
              <input
                ref={folderInputRef}
                type="file"
                multiple
                // @ts-ignore - supported in Chromium browsers (Edge/Chrome)
                webkitdirectory=""
                className="hidden"
                disabled={emlLoading}
                onChange={(e) => {
                  const list = Array.from(e.target.files ?? []);
                  if (!list.length) return;
                  submitEmlBatch(list).catch(() => undefined);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                className="btn-outline text-sm px-4 py-2"
                onClick={() => folderInputRef.current?.click()}
                disabled={emlLoading}
              >
                בחר תיקייה ולעבד הכל
              </button>
            </div>
          </div>

          {emlBatch.length > 0 && (
            <div className="rounded-card border border-pearl bg-white p-3">
              <p className="text-xs font-semibold text-slate-light mb-2">סטטוס עיבוד ({emlBatch.length})</p>
              <div className="max-h-56 overflow-auto space-y-1 text-xs">
                {emlBatch.map((row) => (
                  <div key={`eml-${row.name}`} className="flex items-center justify-between gap-3">
                    <span className="truncate">{row.name}</span>
                    <span className="shrink-0">
                      {row.status === 'pending' && 'ממתין'}
                      {row.status === 'uploading' && 'מעלה/מעבד...'}
                      {row.status === 'done' && 'הושלם'}
                      {row.status === 'error' && `שגיאה${row.error ? `: ${row.error}` : ''}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {emlError && (
            <div className="state-block state-block--error text-sm">
              <AlertTriangle className="state-block__icon" aria-hidden="true" />
              <p className="state-block__title">ייבוא מייל נכשל</p>
              <p className="state-block__description">{emlError}</p>
            </div>
          )}
          {emlSuccess && (
            <div className="state-block text-sm">
              <UploadCloud className="state-block__icon" aria-hidden="true" />
              <p className="state-block__title">ייבוא הושלם</p>
              <p className="state-block__description">{emlSuccess}</p>
            </div>
          )}
        </div>
      </div>

      <div className="card-shell">
        <div className="card-accent" />
        <div className="card-head">
          <div>
            <p className="text-sm font-semibold">העלאה ידנית</p>
            <p className="text-xs text-slate-light">PDF / DOCX עם קטגוריה ותמצית (אופציונלי)</p>
          </div>
        </div>
        <div className="card-underline" />
        <div className="card-body space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold text-slate-light">קטגוריה מהירה</p>
            <div className="segmented-control">
              {QUICK_CATEGORY_LABELS.map((label) => {
                const id = quickCategoryId(label);
                if (!id) return null;
                return (
                  <button
                    key={`upload-quick-${label}`}
                    type="button"
                    data-active={uploadCategoryId === id}
                    onClick={() => setUploadCategoryId(id)}
                    title={label}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-slate-light">שם המסמך</label>
              <input
                className="mt-1 w-full rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="לדוגמה: פלוני נ׳ אלמוני (מחוזי ת״א, 2022)"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-light">קטגוריה</label>
              <select
                className="mt-1 w-full rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                value={uploadCategoryId}
                onChange={(e) => setUploadCategoryId(e.target.value)}
                disabled={categoriesLoading}
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {categoriesError && (
            <div className="state-block state-block--error text-sm">
              <AlertTriangle className="state-block__icon" aria-hidden="true" />
              <p className="state-block__title">שגיאה בטעינת קטגוריות</p>
              <p className="state-block__description">{categoriesError}</p>
            </div>
          )}
          {user?.role === 'admin' && (
            <div className="rounded-card border border-pearl bg-pearl/40 p-4 space-y-2">
              <p className="text-xs font-semibold text-slate-light">הוסף קטגוריה חדשה</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  className="flex-1 rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder='לדוגמה: "תקדימים"'
                />
                <button
                  type="button"
                  className="btn-outline text-sm px-4 py-2"
                  onClick={handleCreateCategory}
                  disabled={creatingCategory || !newCategoryName.trim()}
                >
                  {creatingCategory ? 'שומר...' : 'צור'}
                </button>
              </div>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-slate-light">תמצית (אופציונלי)</label>
            <textarea
              className="mt-1 w-full rounded-card border border-pearl bg-white p-3 text-sm focus:border-gold"
              rows={4}
              value={uploadSummary}
              onChange={(e) => setUploadSummary(e.target.value)}
              placeholder="אם ריק – המערכת תנסה לחלץ תמצית אוטומטית מהקובץ."
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-light">קובץ מצורף</label>
            <input
              className="mt-1 w-full rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
            />
            {uploadFile && (
              <p className="mt-1 text-[11px] text-slate-light">
                נבחר: {uploadFile.name} ({Math.round(uploadFile.size / 1024)}KB)
              </p>
            )}
          </div>
          <div className="flex justify-end">
            <button className="btn-primary px-5" onClick={submitUpload} disabled={uploadLoading}>
              <UploadCloud className="w-4 h-4" />
              {uploadLoading ? 'מעלה...' : 'שמור מסמך'}
            </button>
          </div>
          {uploadError && (
            <div className="state-block state-block--error text-sm">
              <AlertTriangle className="state-block__icon" aria-hidden="true" />
              <p className="state-block__title">העלאה נכשלה</p>
              <p className="state-block__description">{uploadError}</p>
            </div>
          )}
          {uploadSuccess && (
            <div className="state-block text-sm">
              <UploadCloud className="state-block__icon" aria-hidden="true" />
              <p className="state-block__title">העלאה הושלמה</p>
              <p className="state-block__description">{uploadSuccess}</p>
            </div>
          )}
        </div>
      </div>
      <LegalDisclaimer />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="rounded-card border border-pearl bg-white p-4 shadow-card-xl flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-navy">מאגר ידע פנימי</p>
          <p className="text-xs text-slate-light">קטגוריות דינמיות · מסמכים ממייל/ידני · חיפוש חופשי</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className={`rounded-full px-4 py-2 text-sm font-semibold flex items-center gap-2 ${
              activeTab === 'search' ? 'bg-navy text-gold' : 'bg-pearl border border-pearl text-slate'
            }`}
            onClick={() => setActiveTab('search')}
          >
            <Search className="w-4 h-4" /> חיפוש
          </button>
          <button
            className={`rounded-full px-4 py-2 text-sm font-semibold flex items-center gap-2 ${
              activeTab === 'upload' ? 'bg-navy text-gold' : 'bg-pearl border border-pearl text-slate'
            }`}
            onClick={() => setActiveTab('upload')}
          >
            <UploadCloud className="w-4 h-4" /> העלאה
          </button>
        </div>
      </div>

      {activeTab === 'search' ? searchView : uploadView}

      {selectedDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedDoc(null)}
        >
          <div className="card-shell max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="card-accent" />
            <div className="card-head">
              <div className="space-y-1">
                <p className="text-base font-semibold">{selectedDoc.title}</p>
                <p className="text-xs text-slate-light">
                  מקור: {selectedDoc.source === 'EMAIL' ? 'מייל' : 'ידני'} · נוצר: {formatDate(selectedDoc.createdAt)}{' '}
                  {selectedDoc.emailDate ? `· תאריך מייל: ${formatDate(selectedDoc.emailDate)}` : ''}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedDoc(null)} className="text-xs text-slate-light hover:text-navy">
                סגור
              </button>
            </div>
            <div className="card-underline" />
            <div className="card-body space-y-3 text-sm text-slate">
              <div>
                <p className="text-xs font-semibold text-slate-light mb-2">תקציר מלא</p>
                <p className="whitespace-pre-wrap text-navy">{selectedDoc.summary || selectedDoc.content || 'ללא תמצית'}</p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-pearl">
                {selectedDoc.attachmentUrl ? (
                  <button
                    type="button"
                    className="btn-primary text-[11px] px-4 py-2"
                    onClick={async () => {
                      setOpeningAttachmentId(selectedDoc.id);
                      try {
                        await openAttachment(selectedDoc.attachmentUrl as string, selectedDoc.title);
                      } finally {
                        setOpeningAttachmentId((prev) => (prev === selectedDoc.id ? null : prev));
                      }
                    }}
                  >
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

      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="card-shell max-w-lg w-full">
            <div className="card-accent" />
            <div className="card-head">
              <h4 className="text-base font-semibold">עריכת תגיות</h4>
              <button type="button" onClick={closeEditTags} className="text-xs text-slate-light hover:text-navy">
                ביטול
              </button>
            </div>
            <div className="card-underline" />
            <div className="card-body space-y-3 text-sm text-slate">
              <div>
                <label className="text-xs font-semibold text-slate-light">Topics (מופרדים בפסיק)</label>
                <input
                  className="mt-1 w-full rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                  value={topicsDraft}
                  onChange={(e) => setTopicsDraft(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-light">Keywords (מופרדים בפסיק)</label>
                <input
                  className="mt-1 w-full rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                  value={keywordsDraft}
                  onChange={(e) => setKeywordsDraft(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-outline text-xs px-4 py-1.5" onClick={closeEditTags} disabled={tagsSaving}>
                  ביטול
                </button>
                <button type="button" className="btn-primary text-xs px-4 py-1.5" onClick={saveTags} disabled={tagsSaving}>
                  {tagsSaving ? 'שומר...' : 'שמור'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentsLibrary;


