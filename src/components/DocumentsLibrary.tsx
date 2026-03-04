import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, UploadCloud, FileText, AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { CategoryRecord, DocumentRecord, DocumentTypeKey } from '../types';
import {
  createCategory,
  listCategories,
  searchDocuments,
  updateDocumentTags,
  uploadDocument,
  getFieldSuggestions,
  getExpertSuggestions,
  deleteAllDocuments,
  DOC_TYPES,
} from '../services/documentsApi';
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

/** Max file size for upload (MB). Server allows up to 500MB; lower limit improves UX. */
const MAX_UPLOAD_FILE_MB = 100;
const MAX_UPLOAD_FILE_BYTES = MAX_UPLOAD_FILE_MB * 1024 * 1024;

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
  const [uploadDocType, setUploadDocType] = useState<DocumentTypeKey>('פסק דין');
  const [uploadCategoryId, setUploadCategoryId] = useState<string>('');
  const [uploadField, setUploadField] = useState('');
  const [uploadExpertName, setUploadExpertName] = useState('');
  const [uploadArticleAuthor, setUploadArticleAuthor] = useState('');
  const [uploadArticleTitle, setUploadArticleTitle] = useState('');
  const [uploadBookAuthor, setUploadBookAuthor] = useState('');
  const [uploadBookName, setUploadBookName] = useState('');
  const [uploadBookChapter, setUploadBookChapter] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadSummary, setUploadSummary] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [fieldSuggestions, setFieldSuggestions] = useState<string[]>([]);
  const [expertSuggestions, setExpertSuggestions] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [deleteAllLoading, setDeleteAllLoading] = useState(false);
  const [deleteAllError, setDeleteAllError] = useState<string | null>(null);

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
        const [items, fields, experts] = await Promise.all([
          listCategories(),
          getFieldSuggestions(),
          getExpertSuggestions(),
        ]);
        if (!cancelled) {
          setCategories(items);
          setFieldSuggestions(fields);
          setExpertSuggestions(experts);
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

  const hasSyncedInitialCategory = useRef(false);
  useEffect(() => {
    const name = (initialCategoryName ?? '').trim();
    if (!name || !categories.length || hasSyncedInitialCategory.current) return;
    const match = categories.find((c) => c.name === name);
    if (match) {
      setCategoryId(match.id);
      hasSyncedInitialCategory.current = true;
    }
  }, [initialCategoryName, categories]);

  useEffect(() => {
    if (!initialTab) return;
    setActiveTab(initialTab);
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

  const runSearchRef = useRef(runSearch);
  runSearchRef.current = runSearch;

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

    runSearchRef.current({ q: nextQ, categoryId: nextCategoryId });
  }, [autoSearchOnMount, initialQuery, initialCategoryName, initialTab, categories]);

  const QUICK_CATEGORY_LABELS = useMemo(
    () => (['פסק דין', 'חוות דעת', 'תחשיב נזק', 'סיכומים', 'מאמר', 'ספר'] as const),
    [],
  );

  const quickCategoryId = (name: (typeof QUICK_CATEGORY_LABELS)[number]): string | undefined => {
    return categories.find((c) => c.name === name)?.id;
  };

  const handleDeleteAllDocuments = async () => {
    setDeleteAllLoading(true);
    setDeleteAllError(null);
    try {
      const { deleted } = await deleteAllDocuments();
      setResults([]);
      setDeleteAllConfirm(false);
      setSearchError(null);
    } catch (err: any) {
      setDeleteAllError(err?.message ?? 'מחיקה נכשלה');
    } finally {
      setDeleteAllLoading(false);
    }
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
    if (!uploadFile) {
      setUploadError('חובה לבחור קובץ (PDF או Word).');
      return;
    }
    const ext = (uploadFile.name ?? '').toLowerCase().split('.').pop();
    if (ext !== 'pdf' && ext !== 'docx') {
      setUploadError('ניתן להעלות רק קבצי PDF או Word (DOCX).');
      return;
    }
    if (uploadFile.size > MAX_UPLOAD_FILE_BYTES) {
      setUploadError(`גודל הקובץ חורג מהמותר (עד ${MAX_UPLOAD_FILE_MB} MB).`);
      return;
    }
    const titleFromFile = (uploadFile.name || 'document').replace(/\.(pdf|docx)$/i, '').trim() || 'מסמך';
    setUploadLoading(true);
    setUploadProgress(0);
    setUploadError(null);
    setUploadSuccess(null);
    try {
      const doc = await uploadDocument({
        title: titleFromFile,
        docType: uploadDocType,
        categoryId: uploadCategoryId || undefined,
        field: uploadField.trim() || undefined,
        expertName: uploadExpertName.trim() || undefined,
        articleAuthor: uploadArticleAuthor.trim() || undefined,
        articleTitle: uploadArticleTitle.trim() || undefined,
        bookAuthor: uploadBookAuthor.trim() || undefined,
        bookName: uploadBookName.trim() || undefined,
        bookChapter: uploadBookChapter.trim() || undefined,
        notes: uploadNotes.trim() || undefined,
        summary: uploadSummary.trim() || undefined,
        file: uploadFile,
        onProgress: setUploadProgress,
      });
      setUploadSuccess(`המסמך "${doc.title}" נשמר בהצלחה.`);
      setUploadField('');
      setUploadExpertName('');
      setUploadArticleAuthor('');
      setUploadArticleTitle('');
      setUploadBookAuthor('');
      setUploadBookName('');
      setUploadBookChapter('');
      setUploadNotes('');
      setUploadSummary('');
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      // Refresh suggestions for next time
      const [fields, experts] = await Promise.all([getFieldSuggestions(), getExpertSuggestions()]);
      setFieldSuggestions(fields);
      setExpertSuggestions(experts);
      if (activeTab === 'search') {
        await runSearch();
      }
    } catch (err: any) {
      setUploadError(err?.message ?? 'upload_failed');
    } finally {
      setUploadLoading(false);
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
              aria-busy={searchLoading}
            >
              {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Search className="w-4 h-4" aria-hidden="true" />}
              {searchLoading ? 'מחפש...' : 'חפש'}
            </button>
          </div>
          {!canSearch && !searchLoading && (
            <div className="state-block text-sm">
              <AlertTriangle className="state-block__icon" aria-hidden="true" />
              <p className="state-block__title">נא להזין מילת חיפוש או לבחור מסנן</p>
              <p className="state-block__description">הזן טקסט לחיפוש, בחר קטגוריה, או הגדר טווח תאריכים</p>
            </div>
          )}
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
                                          const url = doc.attachmentUrl;
                                          if (!url) return;
                                          setOpeningAttachmentId(doc.id);
                                          try {
                                            await openAttachment(url, doc.title);
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
    </div>
  );

  const uploadView = (
    <div className="space-y-6">
      <div className="card-shell">
        <div className="card-accent" />
        <div className="card-head">
          <div>
            <p className="text-sm font-semibold">העלאת מסמך</p>
            <p className="text-xs text-slate-light">רק קבצי PDF ו-Word (DOCX), עד {MAX_UPLOAD_FILE_MB} MB. גרור קובץ או בחר מהמחשב. מלא סוג, תחום ופרטים לפי סוג המסמך.</p>
          </div>
        </div>
        <div className="card-underline" />
        <div className="card-body space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-light">סוג *</label>
            <select
              className="mt-1 w-full rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
              value={uploadDocType}
              onChange={(e) => setUploadDocType(e.target.value as DocumentTypeKey)}
            >
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-light">תחום (אורטופדיה, נוירולוגיה וכו׳)</label>
            <input
              className="mt-1 w-full rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
              list="field-suggestions"
              value={uploadField}
              onChange={(e) => setUploadField(e.target.value)}
              placeholder="הקלד או בחר מהאפשרויות"
            />
            <datalist id="field-suggestions">
              {fieldSuggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          {uploadDocType === 'חוות דעת' && (
            <div>
              <label className="text-xs font-semibold text-slate-light">מומחה שכתב את חוות הדעת</label>
              <input
                className="mt-1 w-full rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                list="expert-suggestions"
                value={uploadExpertName}
                onChange={(e) => setUploadExpertName(e.target.value)}
                placeholder="לדוגמה: ד״ר גרוסמן"
              />
              <datalist id="expert-suggestions">
                {expertSuggestions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
          )}

          {uploadDocType === 'מאמר' && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-light">שם כותב המאמר</label>
                <input
                  className="mt-1 w-full rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                  value={uploadArticleAuthor}
                  onChange={(e) => setUploadArticleAuthor(e.target.value)}
                  placeholder="שם הכותב"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-light">שם המאמר</label>
                <input
                  className="mt-1 w-full rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                  value={uploadArticleTitle}
                  onChange={(e) => setUploadArticleTitle(e.target.value)}
                  placeholder="כותרת המאמר"
                />
              </div>
            </div>
          )}

          {uploadDocType === 'ספר' && (
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-xs font-semibold text-slate-light">כותב הספר</label>
                <input
                  className="mt-1 w-full rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                  value={uploadBookAuthor}
                  onChange={(e) => setUploadBookAuthor(e.target.value)}
                  placeholder="מי כותב הספר"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-light">שם הספר</label>
                <input
                  className="mt-1 w-full rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                  value={uploadBookName}
                  onChange={(e) => setUploadBookName(e.target.value)}
                  placeholder="שם הספר"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-light">פרק (מעלים כל פרק בנפרד)</label>
                <input
                  className="mt-1 w-full rounded-card border border-pearl bg-white p-2 text-sm focus:border-gold"
                  value={uploadBookChapter}
                  onChange={(e) => setUploadBookChapter(e.target.value)}
                  placeholder="מספר/שם הפרק"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-light">הערות (אופציונלי, עד 2,000 תווים)</label>
            <textarea
              className="mt-1 w-full rounded-card border border-pearl bg-white p-3 text-sm focus:border-gold"
              rows={2}
              maxLength={2000}
              value={uploadNotes}
              onChange={(e) => setUploadNotes(e.target.value)}
              placeholder="הערות כלליות על המסמך"
              aria-describedby="upload-notes-hint"
            />
            <p id="upload-notes-hint" className="text-[11px] text-slate-light mt-0.5">{uploadNotes.length}/2000</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-light">תמצית (אופציונלי, עד 5,000 תווים)</label>
            <textarea
              className="mt-1 w-full rounded-card border border-pearl bg-white p-3 text-sm focus:border-gold"
              rows={2}
              maxLength={5000}
              value={uploadSummary}
              onChange={(e) => setUploadSummary(e.target.value)}
              placeholder="אם ריק – המערכת תנסה לחלץ תמצית אוטומטית מהקובץ."
              aria-describedby="upload-summary-hint"
            />
            <p id="upload-summary-hint" className="text-[11px] text-slate-light mt-0.5">{uploadSummary.length}/5000</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-light">קובץ (PDF או Word בלבד) *</label>
            <div
              className={`mt-1 rounded-card border-2 border-dashed border-pearl bg-pearl/30 p-6 text-center text-sm ${
                uploadLoading ? 'opacity-70' : 'hover:bg-pearl/50'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const f = e.dataTransfer?.files?.[0];
                if (!f) return;
                const ext = (f.name ?? '').toLowerCase().split('.').pop();
                if (ext === 'pdf' || ext === 'docx') setUploadFile(f);
              }}
            >
              <p className="font-semibold text-navy">גרור קובץ PDF או DOCX לכאן</p>
              <p className="text-xs text-slate-light mt-1">או</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="mt-2 block w-full text-sm text-slate file:mr-2 file:rounded file:border-0 file:bg-navy file:px-4 file:py-2 file:text-gold file:text-sm"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {uploadFile && (
              <p className="mt-1 text-[11px] text-slate-light">
                נבחר: {uploadFile.name} ({Math.round(uploadFile.size / 1024)} KB)
              </p>
            )}
            {uploadLoading && (
              <div className="mt-2" role="progressbar" aria-valuenow={uploadProgress} aria-valuemin={0} aria-valuemax={100} aria-label="התקדמות העלאה">
                <div className="h-2 w-full rounded-full bg-pearl overflow-hidden">
                  <div className="h-full bg-gold transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
                <p className="text-[11px] text-slate-light mt-1">{Math.round(uploadProgress)}%</p>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button className="btn-primary px-5" onClick={submitUpload} disabled={uploadLoading} aria-busy={uploadLoading}>
              {uploadLoading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <UploadCloud className="w-4 h-4" aria-hidden="true" />}
              {uploadLoading ? 'מעלה...' : 'שמור מסמך'}
            </button>
          </div>

          {categoriesError && (
            <div className="state-block state-block--error text-sm">
              <AlertTriangle className="state-block__icon" aria-hidden="true" />
              <p className="state-block__title">שגיאה בטעינת קטגוריות</p>
              <p className="state-block__description">{categoriesError}</p>
            </div>
          )}
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
          {user?.role === 'admin' && (
            <button
              type="button"
              className="rounded-full px-4 py-2 text-sm font-semibold flex items-center gap-2 border border-red-300 text-red-700 hover:bg-red-50 transition"
              onClick={() => setDeleteAllConfirm(true)}
              title="מחיקת כל המסמכים ממאגר הידע (אדמין בלבד)"
            >
              <Trash2 className="w-4 h-4" /> מחק את כל המסמכים
            </button>
          )}
        </div>
      </div>

      {activeTab === 'search' ? searchView : uploadView}

      {deleteAllConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="card-shell max-w-md w-full">
            <div className="card-accent bg-red-600" />
            <div className="card-head">
              <h4 className="text-base font-semibold text-navy">מחיקת כל המסמכים</h4>
              <button type="button" onClick={() => !deleteAllLoading && setDeleteAllConfirm(false)} className="text-xs text-slate-light hover:text-navy">
                סגור
              </button>
            </div>
            <div className="card-underline" />
            <div className="card-body space-y-3 text-sm text-slate">
              <p>האם למחוק את <strong>כל</strong> המסמכים ממאגר הידע? לא ניתן לשחזר. אחרי המחיקה תוכל להעלות מסמכים מחדש לפי הקטגוריות החדשות.</p>
              {deleteAllError && <p className="text-red-600 font-semibold">{deleteAllError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="btn-outline px-4 py-2"
                  onClick={() => setDeleteAllConfirm(false)}
                  disabled={deleteAllLoading}
                >
                  ביטול
                </button>
                <button
                  type="button"
                  className="rounded-full px-4 py-2 text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                  onClick={handleDeleteAllDocuments}
                  disabled={deleteAllLoading}
                >
                  {deleteAllLoading ? 'מוחק...' : 'מחק הכל'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                <div className="max-h-96 overflow-y-auto rounded-card border border-pearl bg-white p-3">
                  <p className="whitespace-pre-wrap text-navy">{selectedDoc.summary || selectedDoc.content || 'ללא תמצית'}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-pearl">
                {selectedDoc.attachmentUrl ? (
                  <button
                    type="button"
                    className="btn-primary text-[11px] px-4 py-2"
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


