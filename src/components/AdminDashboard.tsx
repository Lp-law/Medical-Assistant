import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  BookChapter,
  GlobalPrecedent,
  CaseData,
  CaseRecord,
  CaseSummaryRecord,
  NotificationRecord,
  AIInsight,
  KnowledgeDocumentSummary,
  KnowledgeDocumentDetail,
} from '../types';
import { saveBookChapter, saveGlobalPrecedent, getKnowledgeBase } from '../services/knowledgeBase';
import {
  uploadChapterPdf,
  isApiConfigured,
  listCases as apiListCases,
  getCase as apiGetCase,
  renewCase as apiRenewCase,
  archiveCase as apiArchiveCase,
  deleteCase as apiDeleteCase,
  exportCaseFile as apiExportCaseFile,
  updateCaseMetadata as apiUpdateCaseMetadata,
  listNotifications as apiListNotifications,
  markNotificationRead as apiMarkNotificationRead,
} from '../services/api';
import { listKnowledgeDocuments, getKnowledgeDocument } from '../services/knowledgeApi';
import {
  Book,
  Gavel,
  LogOut,
  Save,
  Layout,
  UploadCloud,
  Loader2,
  Activity,
  AlertTriangle,
  Bell,
} from 'lucide-react';
import QualityBadge from './QualityBadge';
import KnowledgeClaimsPanel from './KnowledgeClaimsPanel';
import KnowledgeFlags from './KnowledgeFlags';
import MedicalTimeline from './MedicalTimeline';
import MedicalQualityBox from './MedicalQualityBox';
import LiteraturePanel from './LiteraturePanel';
import ContextRibbon from './ContextRibbon';
import LegalDisclaimer from './LegalDisclaimer';

interface Props {
  currentUserName: string;
  onEditCase: (caseData: CaseData) => void;
  onLogout: () => void;
}

type ConfirmAction =
  | { kind: 'export'; format: 'pdf' | 'json'; caseId: string; caseTitle?: string }
  | { kind: 'renew'; caseId: string; caseTitle?: string }
  | { kind: 'archive'; caseRecord: CaseRecord }
  | { kind: 'delete'; caseId: string; caseTitle?: string };

const AdminDashboard: React.FC<Props> = ({ currentUserName, onEditCase: _onEditCase, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'cases' | 'knowledge' | 'medical'>('knowledge');
  const [brain, setBrain] = useState(getKnowledgeBase());
  const [newChapter, setNewChapter] = useState<Partial<BookChapter>>({ title: '', content: '', tags: [], rules: [] });
  const [newPrecedent, setNewPrecedent] = useState<Partial<GlobalPrecedent>>({ caseName: '', keyTakeaway: '', tags: [] });
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [importInsights, setImportInsights] = useState<AIInsight[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [medicalDocs, setMedicalDocs] = useState<KnowledgeDocumentSummary[]>([]);
  const [selectedMedicalId, setSelectedMedicalId] = useState<string>('');
  const [medicalDetail, setMedicalDetail] = useState<KnowledgeDocumentDetail | null>(null);
  const [medicalInitialized, setMedicalInitialized] = useState(false);
  const [medicalListLoading, setMedicalListLoading] = useState(false);
  const [medicalDetailLoading, setMedicalDetailLoading] = useState(false);
  const [medicalError, setMedicalError] = useState<string | null>(null);
  const [caseLists, setCaseLists] = useState<{ ownCases: CaseRecord[]; otherCases: CaseSummaryRecord[] }>({
    ownCases: [],
    otherCases: [],
  });
  const [caseListLoading, setCaseListLoading] = useState(false);
  const [caseListError, setCaseListError] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<CaseRecord | null>(null);
  const [subjectDraft, setSubjectDraft] = useState('');
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const handleSaveChapter = () => {
    if (!newChapter.title || !newChapter.content) {
      setImportMessage('חובה למלא כותרת ותוכן לפרק.');
      return;
    }
    const chapter: BookChapter = {
      id: Date.now().toString(),
      title: newChapter.title!,
      content: newChapter.content!,
      tags: newChapter.tags || [],
      rules: newChapter.rules || [],
    };
    saveBookChapter(chapter);
    setBrain(getKnowledgeBase());
    setNewChapter({ title: '', content: '', tags: [], rules: [] });
    setImportMessage('הפרק נשמר בהצלחה במאגר הפנימי.');
  };

  const handleSavePrecedent = () => {
    if (!newPrecedent.caseName || !newPrecedent.keyTakeaway) {
      setImportMessage('חובה למלא שם ותובנה לפני שמירת תקדים.');
      return;
    }
    const precedent: GlobalPrecedent = {
      id: Date.now().toString(),
      caseName: newPrecedent.caseName!,
      keyTakeaway: newPrecedent.keyTakeaway!,
      citation: newPrecedent.citation || '',
      tags: newPrecedent.tags || [],
      relevantIssues: [],
    };
    saveGlobalPrecedent(precedent);
    setBrain(getKnowledgeBase());
    setNewPrecedent({ caseName: '', keyTakeaway: '', tags: [] });
    setImportMessage('התקדים נשמר בהצלחה במאגר הפנימי.');
  };

  const importChapterFile = async (file: File) => {
    setImporting(true);
    setImportMessage(`מעלה את "${file.name}" לעיבוד...`);
    setImportInsights([]);
    try {
      if (!isApiConfigured()) {
        setImportMessage('שרת העיבוד לא הוגדר. עדכן את REACT_APP_API_BASE_URL.');
        return;
      }
      const backendResult = await uploadChapterPdf(file, { docType: 'chapter' });
      const chapter: BookChapter = {
        id: backendResult.id,
        title: backendResult.title,
        content: backendResult.content || backendResult.summary,
        tags: backendResult.tags || [],
        rules: backendResult.rules || [],
      };
      saveBookChapter(chapter);
      setBrain(getKnowledgeBase());
      setNewChapter(chapter);
      setImportInsights(backendResult.insights || []);
      setImportMessage(`הפרק "${chapter.title}" עוּבד בהצלחה דרך השרת ונשמר במאגר.`);
    } catch (error) {
      console.error(error);
      setImportMessage('אירעה שגיאה בקריאת או עיבוד הקובץ. ודא שהקובץ PDF תקין ושה-API זמין.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePdfSelection = (files: FileList | null) => {
    if (!files || !files.length) return;
    const file = files[0];
    if (file.type !== 'application/pdf') {
      setImportMessage('נא לבחור קובץ PDF בלבד.');
      return;
    }
    importChapterFile(file);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    handlePdfSelection(event.dataTransfer.files);
  };

  const handleDrag = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.type === 'dragover') {
      setDragActive(true);
    } else if (event.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const triggerFilePicker = () => fileInputRef.current?.click();

  const refreshCaseLists = useCallback(async () => {
    setCaseListLoading(true);
    setCaseListError(null);
    try {
      const payload = await apiListCases();
      setCaseLists(payload);
      if (selectedCase && !payload.ownCases.find((entry) => entry.id === selectedCase.id)) {
        setSelectedCase(null);
      }
      if (!selectedCase && payload.ownCases.length > 0) {
        setSelectedCase(payload.ownCases[0]);
        setSubjectDraft(payload.ownCases[0].topicSummary ?? '');
      }
    } catch (error) {
      console.error(error);
      setCaseListError('טעינת התיקים נכשלה.');
    } finally {
      setCaseListLoading(false);
    }
  }, [selectedCase]);

  const refreshNotifications = useCallback(async () => {
    try {
      const items = await apiListNotifications();
      setNotifications(items);
      setNotificationsError(null);
    } catch (error) {
      console.error(error);
      setNotificationsError('טעינת ההתראות נכשלה.');
    }
  }, []);

  const handleSelectCaseDetail = useCallback(
    async (caseId: string) => {
      setCaseListLoading(true);
      setCaseListError(null);
      try {
        const detail = await apiGetCase(caseId);
        setSelectedCase(detail);
        setSubjectDraft(detail.topicSummary ?? '');
      } catch (error) {
        console.error(error);
        setCaseListError('טעינת פרטי התיק נכשלה.');
      } finally {
        setCaseListLoading(false);
      }
    },
    [],
  );

  const performExportCase = async (caseId: string, format: 'pdf' | 'json') => {
    try {
      const blob = await apiExportCaseFile(caseId, format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `case-${caseId}.${format === 'pdf' ? 'pdf' : 'json'}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      setCaseListError('ייצוא התיק נכשל.');
    }
  };

  const performRenewCase = async (caseId: string) => {
    try {
      await apiRenewCase(caseId);
      await refreshCaseLists();
      if (selectedCase?.id === caseId) {
        const detail = await apiGetCase(caseId);
        setSelectedCase(detail);
        setSubjectDraft(detail.topicSummary ?? '');
      }
    } catch (error) {
      console.error(error);
      setCaseListError('חידוש התיק נכשל.');
    }
  };

  const performArchiveCase = async (caseRecord: CaseRecord) => {
    try {
      if (caseRecord.status === 'ARCHIVED') {
        await apiRenewCase(caseRecord.id);
      } else {
        await apiArchiveCase(caseRecord.id);
      }
      await refreshCaseLists();
      if (selectedCase?.id === caseRecord.id) {
        const detail = await apiGetCase(caseRecord.id);
        setSelectedCase(detail);
      }
    } catch (error) {
      console.error(error);
      setCaseListError('עדכון מצב הארכיון נכשל.');
    }
  };

  const performDeleteCase = async (caseId: string) => {
    try {
      await apiDeleteCase(caseId);
      if (selectedCase?.id === caseId) {
        setSelectedCase(null);
      }
      await refreshCaseLists();
    } catch (error) {
      console.error(error);
      setCaseListError('מחיקת התיק נכשלה.');
    }
  };

  const handleSaveMetadata = async () => {
    if (!selectedCase) return;
    try {
      const updated = await apiUpdateCaseMetadata(selectedCase.id, { topicSummary: subjectDraft.trim() || undefined });
      setSelectedCase(updated);
      await refreshCaseLists();
    } catch (error) {
      console.error(error);
      setCaseListError('עדכון הנושא נכשל.');
    }
  };

  const closeConfirmDialog = () => {
    if (confirmLoading) return;
    setConfirmAction(null);
  };

  const handleConfirmDangerAction = async () => {
    if (!confirmAction) return;
    setConfirmLoading(true);
    try {
      switch (confirmAction.kind) {
        case 'export':
          await performExportCase(confirmAction.caseId, confirmAction.format);
          break;
        case 'renew':
          await performRenewCase(confirmAction.caseId);
          break;
        case 'archive':
          await performArchiveCase(confirmAction.caseRecord);
          break;
        case 'delete':
          await performDeleteCase(confirmAction.caseId);
          break;
        default:
          break;
      }
      setConfirmAction(null);
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleMarkNotification = async (notificationId: string) => {
    try {
      await apiMarkNotificationRead(notificationId);
      await refreshNotifications();
    } catch (error) {
      console.error(error);
      setNotificationsError('סימון ההתראה נכשל.');
    }
  };

  useEffect(() => {
    if (activeTab !== 'medical' || medicalInitialized) return;
    let cancelled = false;
    const loadDocuments = async () => {
      setMedicalListLoading(true);
      setMedicalError(null);
      try {
        const docs = await listKnowledgeDocuments({ docType: 'chapter', limit: 25 });
        if (!cancelled) {
          setMedicalDocs(docs);
          setSelectedMedicalId(docs[0]?.id ?? '');
          setMedicalInitialized(true);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setMedicalError('טעינת מסמכי ניתוח רפואי נכשלה.');
        }
      } finally {
        if (!cancelled) {
          setMedicalListLoading(false);
        }
      }
    };
    loadDocuments();
    return () => {
      cancelled = true;
    };
  }, [activeTab, medicalInitialized]);

  useEffect(() => {
    if (activeTab !== 'cases') return;
    refreshCaseLists();
    refreshNotifications();
  }, [activeTab, refreshCaseLists, refreshNotifications]);

  useEffect(() => {
    if (activeTab !== 'medical') return;
    if (!selectedMedicalId) {
      setMedicalDetail(null);
      return;
    }
    let cancelled = false;
    setMedicalDetailLoading(true);
    setMedicalError(null);
    const loadDetail = async () => {
      try {
        const doc = await getKnowledgeDocument(selectedMedicalId);
        if (!cancelled) {
          setMedicalDetail(doc);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setMedicalError('טעינת ניתוח רפואי נכשלה.');
          setMedicalDetail(null);
        }
      } finally {
        if (!cancelled) {
          setMedicalDetailLoading(false);
        }
      }
    };
    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [activeTab, selectedMedicalId]);

  const refreshMedicalDetail = useCallback(async () => {
    if (!selectedMedicalId) return;
    try {
      const doc = await getKnowledgeDocument(selectedMedicalId);
      setMedicalDetail(doc);
    } catch (error) {
      console.error(error);
      setMedicalError('טעינת הניתוח הרפואי נכשלה.');
    }
  }, [selectedMedicalId]);

  const requiresHumanExpert = medicalDetail?.flags?.some((flag) => flag.code === 'HUMAN_EXPERT_REQUIRED');
  const hasAssertionConflict =
    Boolean(medicalDetail?.claims?.some((claim) => claim.assertionType === 'FACT')) &&
    Boolean(medicalDetail?.flags?.some((flag) => flag.severity === 'critical'));

  const knowledgeView = (
    <div className="space-y-6">
      <div
        className={`border-2 border-dashed rounded-card p-6 text-center transition ${
          dragActive ? 'border-gold bg-gold/5' : 'border-pearl bg-pearl/40'
        }`}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="application/pdf"
          onChange={(event) => handlePdfSelection(event.target.files)}
        />
        <UploadCloud className="w-10 h-10 text-slate-light mx-auto mb-3" />
        <p className="text-lg font-semibold text-navy">גררו קובץ PDF של פרק "תחשיבי נזק"</p>
        <p className="text-sm text-slate mt-2">הקבצים מעובדים ומנוסחים בשרת המאובטח – כולל רישום Audit אוטומטי.</p>
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button type="button" onClick={triggerFilePicker} className="btn-secondary px-6" disabled={importing}>
            בחר קובץ PDF
          </button>
          {importing && (
            <div className="loader-inline">
              <Loader2 className="loader-inline__icon" aria-hidden="true" />
              מעבד קובץ...
            </div>
          )}
        </div>
        {importMessage && <p className="text-sm text-slate mt-3">{importMessage}</p>}
        {importInsights.length > 0 && (
          <div className="mt-4 text-left">
            <p className="text-xs font-bold text-slate-light mb-2">תובנות שהופקו:</p>
            <ul className="space-y-1 text-sm text-slate">
              {importInsights.map((insight) => (
                <li key={insight.title} className="rounded-card border border-pearl bg-white px-3 py-2">
                  <span className="font-semibold">{insight.title}: </span>
                  {insight.content}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <form
          className="card-shell"
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveChapter();
          }}
        >
          <div className="card-accent" />
          <div className="card-head">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Book className="w-5 h-5 text-gold" /> הוסף פרק חדש
            </h2>
          </div>
          <div className="card-underline" />
          <div className="card-body space-y-4">
            <input
              className="w-full rounded-card border border-pearl bg-white p-3 text-sm focus:border-gold"
              placeholder="כותרת הפרק"
              value={newChapter.title || ''}
              onChange={(e) => setNewChapter((prev) => ({ ...prev, title: e.target.value }))}
            />
            <textarea
              className="w-full rounded-card border border-pearl bg-white p-3 text-sm h-24 focus:border-gold"
              placeholder="תוכן / תקציר"
              value={newChapter.content || ''}
              onChange={(e) => setNewChapter((prev) => ({ ...prev, content: e.target.value }))}
            />
            <input
              className="w-full rounded-card border border-pearl bg-white p-3 text-sm focus:border-gold"
              placeholder="תגיות (מופרדות בפסיק)"
              value={(newChapter.tags || []).join(', ')}
              onChange={(e) =>
                setNewChapter((prev) => ({
                  ...prev,
                  tags: e.target.value
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                }))
              }
            />
            <textarea
              className="w-full rounded-card border border-pearl bg-white p-3 text-sm h-20 focus:border-gold"
              placeholder="כללים (כל שורה כלל חדש)"
              value={(newChapter.rules || []).join('\n')}
              onChange={(e) =>
                setNewChapter((prev) => ({
                  ...prev,
                  rules: e.target.value
                    .split('\n')
                    .map((rule) => rule.trim())
                    .filter(Boolean),
                }))
              }
            />
            <button type="submit" className="btn-secondary w-full justify-center">
              <Save className="w-4 h-4" /> שמור פרק
            </button>
          </div>
        </form>

        <form
          className="card-shell"
          onSubmit={(e) => {
            e.preventDefault();
            handleSavePrecedent();
          }}
        >
          <div className="card-accent" />
          <div className="card-head">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Gavel className="w-5 h-5 text-gold" /> הוסף תקדים חדש
            </h2>
          </div>
          <div className="card-underline" />
          <div className="card-body space-y-4">
            <input
              className="w-full rounded-card border border-pearl bg-white p-3 text-sm focus:border-gold"
              placeholder="שם ההליך / תקדים"
              value={newPrecedent.caseName || ''}
              onChange={(e) => setNewPrecedent((prev) => ({ ...prev, caseName: e.target.value }))}
            />
            <textarea
              className="w-full rounded-card border border-pearl bg-white p-3 text-sm h-24 focus:border-gold"
              placeholder="תובנה מרכזית"
              value={newPrecedent.keyTakeaway || ''}
              onChange={(e) => setNewPrecedent((prev) => ({ ...prev, keyTakeaway: e.target.value }))}
            />
            <input
              className="w-full rounded-card border border-pearl bg-white p-3 text-sm focus:border-gold"
              placeholder="ציון / מקור"
              value={newPrecedent.citation || ''}
              onChange={(e) => setNewPrecedent((prev) => ({ ...prev, citation: e.target.value }))}
            />
            <input
              className="w-full rounded-card border border-pearl bg-white p-3 text-sm focus:border-gold"
              placeholder="תגיות (מופרדות בפסיק)"
              value={(newPrecedent.tags || []).join(', ')}
              onChange={(e) =>
                setNewPrecedent((prev) => ({
                  ...prev,
                  tags: e.target.value
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                }))
              }
            />
            <button type="submit" className="btn-secondary w-full justify-center">
              <Save className="w-4 h-4" /> שמור תקדים
            </button>
          </div>
        </form>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card-shell">
          <div className="card-accent" />
          <div className="card-head">
            <h3 className="font-semibold flex items-center gap-2">
              <Book className="w-4 h-4 text-gold" /> פרקים קיימים ({brain.book.length})
            </h3>
          </div>
          <div className="card-underline" />
          <div className="card-body space-y-3">
            {brain.book.length === 0 ? (
              <div className="state-block text-sm">
                <Book className="state-block__icon" aria-hidden="true" />
                <p className="state-block__title">אין פרקים שמורים</p>
                <p className="state-block__description">כשיוזנו פרקים חדשים הם יתווספו אוטומטית לרשימה.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {brain.book.slice(0, 4).map((chapter) => (
                  <li key={chapter.id} className="mini-card space-y-1">
                    <p className="font-semibold text-navy">{chapter.title}</p>
                    <p className="text-xs text-slate-light overflow-hidden text-ellipsis whitespace-nowrap">
                      {chapter.content}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="card-shell">
          <div className="card-accent" />
          <div className="card-head">
            <h3 className="font-semibold flex items-center gap-2">
              <Gavel className="w-4 h-4 text-gold" /> תקדימים ({brain.precedents.length})
            </h3>
          </div>
          <div className="card-underline" />
          <div className="card-body space-y-3">
            {brain.precedents.length === 0 ? (
              <div className="state-block text-sm">
                <Gavel className="state-block__icon" aria-hidden="true" />
                <p className="state-block__title">אין תקדימים שמורים</p>
                <p className="state-block__description">הוסף תקדים חדש כדי להתחיל לבנות ספרייה משפטית פנימית.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {brain.precedents.slice(0, 4).map((precedent) => (
                  <li key={precedent.id} className="mini-card space-y-1">
                    <p className="font-semibold text-navy">{precedent.caseName}</p>
                    <p className="text-xs text-slate-light overflow-hidden text-ellipsis whitespace-nowrap">
                      {precedent.keyTakeaway}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const caseStatusLabel: Record<'ACTIVE' | 'ARCHIVED' | 'PENDING_DELETE', string> = {
    ACTIVE: 'פעיל',
    ARCHIVED: 'בארכיון',
    PENDING_DELETE: 'ממתין למחיקה',
  };

  const caseStatusStyle: Record<'ACTIVE' | 'ARCHIVED' | 'PENDING_DELETE', string> = {
    ACTIVE: 'bg-gold/20 text-navy',
    ARCHIVED: 'bg-slate-light/30 text-navy',
    PENDING_DELETE: 'bg-danger/10 text-danger',
  };

  const renderStatusBadge = (status: 'ACTIVE' | 'ARCHIVED' | 'PENDING_DELETE') => (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${caseStatusStyle[status]}`}>
      {caseStatusLabel[status]}
    </span>
  );

  const renderDaysIndicator = (days?: number) => {
    if (days === undefined) return <span className="text-xs text-slate-500">ללא מידע</span>;
    if (days === 0) {
      return <span className="text-xs text-danger font-semibold">פחות מ-24 שעות למחיקה</span>;
    }
    const tone =
      days <= 3 ? 'text-danger font-semibold' : days <= 15 ? 'text-gold font-semibold' : 'text-slate-light';
    return (
      <span className={`text-xs ${tone}`} dir="ltr">
        נותרו {days} ימים
      </span>
    );
  };

  const CaseCard = ({
    item,
    variant,
  }: {
    item: CaseSummaryRecord;
    variant: 'owner' | 'readonly';
  }) => (
    <div
      className={`card-shell transition hover:shadow-2xl ${variant === 'owner' ? 'cursor-pointer' : ''}`}
      onClick={variant === 'owner' ? () => handleSelectCaseDetail(item.id) : undefined}
    >
      <div className="card-accent" />
      <div className="card-head">
        <div className="space-y-1">
          <p className="text-base font-semibold">{item.title}</p>
          <p className="text-sm text-slate-light truncate">{item.topicSummary}</p>
        </div>
        <span className={variant === 'owner' ? 'badge-owner' : 'badge-readonly'}>
          {variant === 'owner' ? 'שלי' : 'קריאה בלבד'}
        </span>
      </div>
      <div className="card-underline" />
      <div className="card-body space-y-2 text-sm text-slate">
        {variant === 'owner' ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {renderStatusBadge(item.status as any)}
              {renderDaysIndicator(item.daysRemaining)}
            </div>
            <div className="flex flex-wrap gap-4 text-xs">
              <span>נוצר: {new Date(item.createdAt).toLocaleDateString('he-IL')}</span>
              {item.lastAccessedAt && <span>עודכן: {new Date(item.lastAccessedAt).toLocaleDateString('he-IL')}</span>}
            </div>
          </>
        ) : (
          <span className="text-xs text-slate-light">
            עודכן: {new Date(item.createdAt).toLocaleDateString('he-IL')}
          </span>
        )}
      </div>
    </div>
  );

  const casesView = (
    <div className="space-y-6">
      <section className="card-shell">
        <div className="card-accent" />
        <div className="card-head">
          <div>
            <p className="text-lg font-semibold flex items-center gap-2">
              <Layout className="w-5 h-5 text-gold" /> ניהול תיקים
            </p>
            <p className="text-sm text-slate-light">
              תצוגה משרדית פנימית – תיקים אישיים לצד תיקים ללימוד והשוואה.
            </p>
          </div>
          <AlertTriangle className="w-5 h-5 text-gold-light" />
        </div>
        <div className="card-underline" />
        <div className="card-body text-sm text-slate">
          מחיקה אוטומטית מתבצעת לאחר 90 יום. מומלץ לתייק או לייצא מסמכים טרם המחיקה.
        </div>
      </section>

      {caseListError && (
        <div className="state-block state-block--error text-sm">
          <AlertTriangle className="state-block__icon" aria-hidden="true" />
          <p className="state-block__title">טעינת התיקים נכשלה</p>
          <p className="state-block__description">{caseListError}</p>
        </div>
      )}
      {caseListLoading && (
        <div className="loader-inline">
          <Loader2 className="loader-inline__icon" aria-hidden="true" />
          טוען נתוני תיקים...
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-slate">התיקים שלי ({caseLists.ownCases.length})</h3>
          {caseLists.ownCases.length === 0 ? (
            <div className="card-shell">
              <div className="card-accent" />
              <div className="card-body">
                <div className="state-block text-sm">
                  <Layout className="state-block__icon" aria-hidden="true" />
                  <p className="state-block__title">אין תיקים בבעלותך כרגע</p>
                  <p className="state-block__description">צור תיק חדש או יבוא תיק קיים כדי להתחיל בעבודה.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {caseLists.ownCases.map((item) => (
                <CaseCard key={item.id} item={item} variant="owner" />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-slate">תיקים אחרים ({caseLists.otherCases.length})</h3>
          {caseLists.otherCases.length === 0 ? (
            <div className="card-shell">
              <div className="card-accent" />
              <div className="card-body">
                <div className="state-block text-sm">
                  <Layout className="state-block__icon" aria-hidden="true" />
                  <p className="state-block__title">אין תיקים חיצוניים להשוואה</p>
                  <p className="state-block__description">כשתוקצה גישה לתיקי לימוד, הם יופיעו באזור זה.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {caseLists.otherCases.map((item) => (
                <CaseCard key={item.id} item={item} variant="readonly" />
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card-shell lg:col-span-2">
          <div className="card-accent" />
          <div className="card-head">
            <p className="text-base font-semibold">פרטי תיק נבחר</p>
            {selectedCase && <span className="badge-status">{selectedCase.title}</span>}
          </div>
          <div className="card-underline" />
          <div className="card-body text-sm text-slate space-y-3">
            {selectedCase ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {renderStatusBadge(selectedCase.status)}
                  {renderDaysIndicator(selectedCase.daysRemaining)}
                </div>
                <div>
                  <p className="text-xs text-slate-light mb-1">נושא בטוח</p>
                  <textarea
                    className="w-full rounded-2xl border border-pearl bg-pearl/60 p-3 text-sm focus:border-gold focus:ring-1 focus:ring-gold outline-none transition"
                    rows={3}
                    value={subjectDraft}
                    onChange={(e) => setSubjectDraft(e.target.value)}
                    placeholder="תיאור מילולי קצר של התיק..."
                  />
                  <div className="mt-2 flex justify-end">
                    <button onClick={handleSaveMetadata} className="btn-primary text-xs px-4 py-1.5">
                      שמור נושא
                    </button>
                  </div>
                </div>
                <div className="text-xs text-slate-light flex flex-wrap gap-4">
                  <span>נוצר: {new Date(selectedCase.createdAt).toLocaleString('he-IL')}</span>
                  {selectedCase.lastAccessedAt && (
                    <span>גישה אחרונה: {new Date(selectedCase.lastAccessedAt).toLocaleString('he-IL')}</span>
                  )}
                </div>
                <div className="pt-4 flex flex-wrap gap-2 border-t border-pearl/60">
                  <button
                    className="btn-primary text-xs px-4 py-1.5"
                    onClick={() =>
                      setConfirmAction({
                        kind: 'export',
                        format: 'pdf',
                        caseId: selectedCase.id,
                        caseTitle: selectedCase.title,
                      })
                    }
                  >
                    ייצא PDF
                  </button>
                  <button
                    className="btn-secondary text-xs px-4 py-1.5"
                    onClick={() =>
                      setConfirmAction({
                        kind: 'export',
                        format: 'json',
                        caseId: selectedCase.id,
                        caseTitle: selectedCase.title,
                      })
                    }
                  >
                    ייצא JSON
                  </button>
                  <button
                    className="btn-outline text-xs px-4 py-1.5"
                    onClick={() =>
                      setConfirmAction({
                        kind: 'renew',
                        caseId: selectedCase.id,
                        caseTitle: selectedCase.title,
                      })
                    }
                  >
                    חדש תיק
                  </button>
                  <button
                    className="btn-outline text-xs px-4 py-1.5"
                    onClick={() =>
                      setConfirmAction({
                        kind: 'archive',
                        caseRecord: selectedCase,
                      })
                    }
                  >
                    {selectedCase.status === 'ARCHIVED' ? 'בטל ארכיון' : 'העבר לארכיון'}
                  </button>
                  <button
                    className="btn-outline text-xs px-4 py-1.5 border-danger text-danger hover:bg-danger/10"
                    onClick={() =>
                      setConfirmAction({
                        kind: 'delete',
                        caseId: selectedCase.id,
                        caseTitle: selectedCase.title,
                      })
                    }
                  >
                    מחיקה
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate">בחר תיק מהרשימה להצגת פרטים.</p>
            )}
          </div>
        </div>

        <div className="card-shell">
          <div className="card-accent" />
          <div className="card-head">
            <p className="text-base font-semibold flex items-center gap-2">
              <Bell className="w-4 h-4 text-gold" />
              התראות שמירה
            </p>
          </div>
          <div className="card-underline" />
          <div className="card-body space-y-2 text-sm text-slate">
            {notificationsError && (
              <div className="state-block state-block--error text-xs">
                <AlertTriangle className="state-block__icon" aria-hidden="true" />
                <p className="state-block__title text-sm">שגיאה בטעינת התראות</p>
                <p className="state-block__description">{notificationsError}</p>
              </div>
            )}
            {notifications.length === 0 ? (
              <p className="text-sm text-slate">אין התראות פעילות.</p>
            ) : (
              <ul className="space-y-2">
                {notifications.map((notification) => (
                  <li key={notification.id} className="rounded-2xl border border-pearl bg-pearl/40 p-3">
                    <p className="text-slate">{notification.message}</p>
                    <p className="text-[11px] text-slate-light mt-1">
                      {new Date(notification.createdAt).toLocaleString('he-IL')}
                    </p>
                    {!notification.readAt && (
                      <button
                        className="mt-2 text-xs text-gold hover:text-gold-light"
                        onClick={() => handleMarkNotification(notification.id)}
                      >
                        סמן כנקרא
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const medicalView = (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex-1">
          <label className="text-xs font-semibold text-slate-500">בחר מסמך רפואי</label>
          <select
            className="mt-1 w-full rounded border border-slate-300 p-2 text-sm"
            value={selectedMedicalId}
            onChange={(e) => setSelectedMedicalId(e.target.value)}
            disabled={!medicalDocs.length || medicalListLoading}
          >
            {medicalDocs.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.title}
              </option>
            ))}
            {!medicalDocs.length && <option value="">אין מסמכים</option>}
          </select>
        </div>
        <div className="md:w-1/3">
          <QualityBadge score={medicalDetail?.score} />
        </div>
      </div>

      {(requiresHumanExpert || hasAssertionConflict) && (
        <div className="state-block state-block--error text-sm">
          <AlertTriangle className="state-block__icon" aria-hidden="true" />
          <p className="state-block__title">
            {requiresHumanExpert ? 'נדרש מומחה אנושי' : 'זוהתה סתירה בין הטענות לדגלים'}
          </p>
          <p className="state-block__description">
            {requiresHumanExpert
              ? 'קיים דגל HUMAN_EXPERT_REQUIRED. יש לערב מומחה רפואי לפני פעולה נוספת.'
              : 'זוהו טענות מסווגות כעובדה לצד דגלים קריטיים. מומלץ לעבור שוב על הממצאים לפני הסתמכות.'}
          </p>
        </div>
      )}

      {medicalError && (
        <div className="state-block state-block--error text-sm">
          <AlertTriangle className="state-block__icon" aria-hidden="true" />
          <p className="state-block__title">טעינת המסמך הרפואי נכשלה</p>
          <p className="state-block__description">{medicalError}</p>
        </div>
      )}

      {(medicalListLoading || medicalDetailLoading) && (
        <div className="loader-inline">
          <Loader2 className="loader-inline__icon" aria-hidden="true" />
          טוען נתוני ניתוח רפואי...
        </div>
      )}

      {!medicalListLoading && !medicalDetail && !medicalError && (
        <div className="state-block text-sm">
          <Book className="state-block__icon" aria-hidden="true" />
          <p className="state-block__title">אין ניתוחים רפואיים להצגה</p>
          <p className="state-block__description">בחר מסמך רפואי מהרשימה או העלה מסמך חדש כדי להתחיל בניתוח.</p>
        </div>
      )}

      {medicalDetail && (
        <>
          <MedicalQualityBox
            score={medicalDetail.medicalQualityScore}
            findings={medicalDetail.qualityFindings ?? []}
            reasoningFindings={medicalDetail.reasoningFindings ?? []}
          />
          <KnowledgeFlags flags={medicalDetail.flags || []} />
          <KnowledgeClaimsPanel claims={medicalDetail.claims || []} limit={5} />
          <MedicalTimeline events={medicalDetail.timeline || []} />
          <LiteraturePanel
            knowledgeId={medicalDetail.id}
            resources={medicalDetail.literatureResources ?? []}
            onRefresh={refreshMedicalDetail}
          />
        </>
      )}
      <LegalDisclaimer />
    </div>
  );

  const contextModeLabel =
    activeTab === 'cases'
      ? 'ניהול תיקים משרדיים'
      : activeTab === 'knowledge'
      ? 'מרכז הידע הפנימי'
      : 'בקרה רפואית ותחקור';
  const ribbonStatus = activeTab === 'cases' ? selectedCase?.status : undefined;
  const ribbonCaseName = activeTab === 'cases' ? selectedCase?.title : undefined;
  const ribbonReadOnly = activeTab === 'cases' ? !(selectedCase?.isOwner ?? true) : false;

  const confirmTitle = (() => {
    if (!confirmAction) return '';
    switch (confirmAction.kind) {
      case 'export':
        return 'אישור ייצוא תיק';
      case 'renew':
        return 'אישור חידוש תיק';
      case 'archive':
        return confirmAction.caseRecord.status === 'ARCHIVED' ? 'אישור ביטול ארכיון' : 'אישור העברה לארכיון';
      case 'delete':
        return 'אישור מחיקה סופית';
      default:
        return 'אישור פעולה';
    }
  })();

  const confirmDescription = (() => {
    if (!confirmAction) return '';
    const base = confirmAction.kind === 'archive' ? confirmAction.caseRecord.title : confirmAction.caseTitle;
    switch (confirmAction.kind) {
      case 'export':
        return `פעולה זו תייצא את התיק ${base ?? ''} בפורמט ${confirmAction.format.toUpperCase()} ותבוצע על ידי ${currentUserName}.`;
      case 'renew':
        return `פעולה זו תאפס את מועד המחיקה לתיק ${base ?? ''}. ${currentUserName} מאשר את ביצועה.`;
      case 'archive':
        return confirmAction.caseRecord.status === 'ARCHIVED'
          ? `התיק ${confirmAction.caseRecord.title} יחזור ממצב ארכיון. הפעולה מאושרת על ידי ${currentUserName}.`
          : `התיק ${confirmAction.caseRecord.title} יעבור לארכיון ויהיה לקריאה בלבד. הפעולה מאושרת על ידי ${currentUserName}.`;
      case 'delete':
        return `פעולה זו תמחק את התיק ${base ?? ''} לצמיתות ואינה ניתנת לשחזור. ${currentUserName} מאשר שהבין את המשמעות.`;
      default:
        return '';
    }
  })();

  return (
    <div className="min-h-screen bg-pearl text-navy" dir="rtl">
      <header className="h-16 bg-navy text-gold flex items-center justify-between px-6 shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-xl font-semibold brand-mark">LexMedical Admin</span>
          <span className="text-xs text-gold-light hidden md:inline">
            שליטה משרדית בחומר הרפואי־משפטי
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-pearl">מחובר: {currentUserName}</span>
          <button onClick={onLogout} className="flex items-center gap-2 rounded-full border border-gold px-3 py-1 text-gold hover:bg-gold/10 transition">
            <LogOut className="w-4 h-4" /> יציאה
          </button>
        </div>
      </header>
      <ContextRibbon
        mode={contextModeLabel}
        caseName={ribbonCaseName}
        status={ribbonStatus}
        isReadOnly={ribbonReadOnly}
        onBack={() => window.history.back()}
      />
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="rounded-card border border-pearl bg-white p-6 shadow-card-xl flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate">עודכן לאחרונה: {new Date(brain.lastUpdated).toLocaleString('he-IL')}</p>
            <p className="text-xs text-slate-light">ממשק פנימי לשימוש עורכי דין בלבד</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setActiveTab('knowledge')}
              className={`rounded-full px-4 py-2 text-sm font-semibold flex items-center gap-2 ${
                activeTab === 'knowledge' ? 'bg-navy text-gold' : 'bg-pearl border border-pearl text-slate'
              }`}
            >
              <Book className="w-4 h-4" /> ידע
            </button>
            <button
              onClick={() => setActiveTab('cases')}
              className={`rounded-full px-4 py-2 text-sm font-semibold flex items-center gap-2 ${
                activeTab === 'cases' ? 'bg-navy text-gold' : 'bg-pearl border border-pearl text-slate'
              }`}
            >
              <Layout className="w-4 h-4" /> תיקים
            </button>
            <button
              onClick={() => setActiveTab('medical')}
              className={`rounded-full px-4 py-2 text-sm font-semibold flex items-center gap-2 ${
                activeTab === 'medical' ? 'bg-navy text-gold' : 'bg-pearl border border-pearl text-slate'
              }`}
            >
              <Activity className="w-4 h-4" /> Medical Analysis
            </button>
          </div>
        </div>
        {activeTab === 'knowledge' && knowledgeView}
        {activeTab === 'cases' && casesView}
        {activeTab === 'medical' && medicalView}
      </main>
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="card-shell max-w-md w-full">
            <div className="card-accent" />
            <div className="card-head">
              <h4 className="text-base font-semibold">{confirmTitle}</h4>
              <button
                type="button"
                onClick={closeConfirmDialog}
                className="text-xs text-slate-light hover:text-navy"
                aria-label="בטל פעולה"
              >
                ביטול
              </button>
            </div>
            <div className="card-underline" />
            <div className="card-body space-y-3 text-sm text-slate">
              <p>{confirmDescription}</p>
              <p className="text-xs text-slate-light">הפעולה תרשם בלוג האודיט המשרדי.</p>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-outline text-xs px-4 py-1.5" onClick={closeConfirmDialog} disabled={confirmLoading}>
                  ביטול
                </button>
                <button
                  type="button"
                  className="btn-primary text-xs px-4 py-1.5"
                  onClick={handleConfirmDangerAction}
                  disabled={confirmLoading}
                >
                  {confirmLoading ? 'מבצע...' : 'אישור פעולה'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;

