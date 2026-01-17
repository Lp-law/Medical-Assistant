import React, { ReactNode, useState, useEffect, useRef, useCallback } from 'react';
import { CaseData, AttachedFile, CaseRecord } from './types';
import { useAuth } from './context/AuthContext';
import {
  createCase as apiCreateCase,
  listCases as apiListCases,
  updateCase as apiUpdateCase,
} from './services/api';
import LoginScreen from './components/LoginScreen';
import AdminDashboard from './components/AdminDashboard';
import LiabilityStep from './components/LiabilityStep';
import DamagesStep from './components/DamagesStep';
import ReasoningStep from './components/ReasoningStep';
import ReportStep from './components/ReportStep';
import CaseDashboard from './components/CaseDashboard';
import {
  FolderOpen,
  ChevronLeft,
  Shield,
  Activity,
  UploadCloud,
  FileText,
  LayoutDashboard,
  BookOpen,
  Download,
  Upload,
  Bell,
  UserCircle,
} from 'lucide-react';
import ContextRibbon from './components/ContextRibbon';
import LegalDisclaimer from './components/LegalDisclaimer';

const createEmptyCase = (attorney: string): CaseData => ({
  id: Date.now().toString(),
  name: 'תיק חדש ' + new Date().toLocaleDateString('he-IL'),
  attorney,
  lastUpdated: new Date().toISOString(),
  summary: '',
  summaryFiles: [],
  liability: {
    issues: [],
    medicalRecordQuality: 'Complete',
    doctrines: [],
    precedents: [],
    expertsPlaintiff: [],
    expertsDefense: [],
    expertCourtOpinions: [], 
    expertCourtStance: 'None', 
    aggravatingFactors: 2,
    mitigatingFactors: 2,
    probability: 50,
    probabilityRange: [40, 60],
    uncertainty: 'Medium',
    strengthsPlaintiff: [''],
    weaknessesPlaintiff: [''],
    strengthsDefense: [''],
    weaknessesDefense: ['']
  },
  damages: {
    dateOfBirth: '1990-01-01', 
    gender: 'Male',
    dateOfEvent: new Date(new Date().setFullYear(new Date().getFullYear() - 2)).toISOString().split('T')[0], 
    dateOfCalc: new Date().toISOString().split('T')[0],
    dateOfRetirement: '',
    ageAtInjury: 0, 
    currentAge: 0, 
    lifeExpectancy: 82, 
    wagePreInjury: 10000,
    wagePostInjury: 0,
    permanentDisabilityMedical: 10,
    permanentDisabilityFunctional: 10,
    daysOfHospitalization: 0,
    interestRate: 3,
    heads: [
      { id: '1', name: 'הפסד שכר לעבר', isActive: true, parameters: {}, calculatedAmount: 0, notes: '' },
      { id: '2', name: 'הפסד שכר לעתיד', isActive: true, parameters: {}, calculatedAmount: 0, notes: '' },
      { id: '3', name: 'הפסד פנסיה ותנאים סוציאליים', isActive: true, parameters: {}, calculatedAmount: 0, notes: '' },
      { id: '4', name: 'כאב וסבל', isActive: true, parameters: {}, calculatedAmount: 0, notes: '' },
      { id: '5', name: 'עזרת צד ג׳ לעבר', isActive: false, parameters: {}, calculatedAmount: 0, notes: '' },
      { id: '6', name: 'עזרת צד ג׳ לעתיד', isActive: false, parameters: {}, calculatedAmount: 0, notes: '' },
      { id: '7', name: 'הוצאות רפואיות', isActive: false, parameters: {}, calculatedAmount: 0, notes: '' },
      { id: '8', name: 'ניידות ונסיעות', isActive: false, parameters: {}, calculatedAmount: 0, notes: '' },
    ],
    precedents: []
  }
});

const App: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeStep, setActiveStep] = useState<number>(0);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [caseList, setCaseList] = useState<CaseRecord[]>([]);
  const [currentCaseId, setCurrentCaseId] = useState<string | null>(null);
  const [currentCase, setCurrentCase] = useState<CaseData | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isLoadingCases, setIsLoadingCases] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [caseBanner, setCaseBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratingRef = useRef(false);

  const isAdmin = user?.role === 'admin';

  const cleanupClientState = () => {
    setCaseList([]);
    setCurrentCaseId(null);
    setCurrentCase(null);
    setShowAdminDashboard(false);
    setActiveStep(0);
    setSaveStatus('idle');
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (resetStatusTimeoutRef.current) {
      clearTimeout(resetStatusTimeoutRef.current);
      resetStatusTimeoutRef.current = null;
    }
  };

  const normalizeCaseData = (record: CaseRecord, attorneyFallback: string): CaseData => {
    const safeData = (record.data as CaseData) || createEmptyCase(attorneyFallback);
    return {
      ...createEmptyCase(attorneyFallback),
      ...safeData,
      id: record.id,
      name: safeData.name || record.title || `תיק ${new Date().toLocaleDateString('he-IL')}`,
      attorney: safeData.attorney || attorneyFallback,
    };
  };

  const handleCreateNewCase = useCallback(async (attorneyName: string) => {
    if (!user) return;
    setIsLoadingCases(true);
    setLoadError(null);
    try {
      const template = createEmptyCase(attorneyName);
      const created = await apiCreateCase({ title: template.name, data: template });
      setCaseList((prev) => [created, ...prev]);
      const normalized = { ...template, id: created.id };
      setCurrentCaseId(created.id);
      hydratingRef.current = true;
      setCurrentCase(normalized);
      setActiveStep(0);
    } catch (error) {
      console.error(error);
      setLoadError('יצירת תיק חדש נכשלה.');
    } finally {
      setIsLoadingCases(false);
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      if (!user) {
        cleanupClientState();
        return;
      }
      setIsLoadingCases(true);
      setLoadError(null);
      try {
        const { ownCases } = await apiListCases();
        if (cancelled) return;
        setCaseList(ownCases);
        setShowAdminDashboard(isAdmin);
        if (!ownCases.length) {
          await handleCreateNewCase(user.username);
          return;
        }
        const sorted = [...ownCases].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
        const primary = sorted[0];
        setCurrentCaseId(primary.id);
        hydratingRef.current = true;
        setCurrentCase(normalizeCaseData(primary, user.username));
        setActiveStep(0);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setLoadError('טעינת התיקים נכשלה. נסה שוב בעוד רגע.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingCases(false);
        }
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [user, isAdmin, handleCreateNewCase]);

  const handleLogout = () => {
    logout();
    cleanupClientState();
  };

  const handleAdminEditCase = (caseData: CaseData) => {
    setCurrentCaseId(caseData.id);
    hydratingRef.current = true;
    setCurrentCase(caseData);
    setShowAdminDashboard(false);
    setActiveStep(0);
  };

  useEffect(() => {
    if (!user || !currentCaseId || !currentCase || showAdminDashboard) return;
    if (hydratingRef.current) {
      hydratingRef.current = false;
      return;
    }
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    setSaveStatus('saving');
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const updated = await apiUpdateCase(currentCaseId, {
          title: currentCase.name,
          data: currentCase,
        });
        setCaseList((prev) => {
          const filtered = prev.filter((c) => c.id !== updated.id);
          return [updated, ...filtered];
        });
        setSaveStatus('saved');
        if (resetStatusTimeoutRef.current) {
          clearTimeout(resetStatusTimeoutRef.current);
        }
        resetStatusTimeoutRef.current = setTimeout(() => setSaveStatus('idle'), 1500);
      } catch (error) {
        console.error(error);
        setSaveStatus('error');
      }
    }, 1200);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [currentCase, currentCaseId, user, showAdminDashboard]);

  const handleSummaryFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && currentCase) {
      const file = e.target.files[0];
      const newFile: AttachedFile = {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      };
      setCurrentCase({
        ...currentCase,
        summaryFiles: [...(currentCase.summaryFiles || []), newFile]
      });
    }
  };

  const removeSummaryFile = (fileName: string) => {
    if (currentCase) {
      setCurrentCase({
        ...currentCase,
        summaryFiles: currentCase.summaryFiles.filter((f: AttachedFile) => f.name !== fileName)
      });
    }
  };

  const handleExportCase = () => {
    if (!currentCase) return;
    const dataStr = JSON.stringify(currentCase, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lexmedical_${currentCase.name.replace(/\s+/g, '_')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.id && json.liability && json.damages) {
          hydratingRef.current = true;
          setCurrentCase(json);
          setCaseBanner({ type: 'success', message: 'התיק נטען בהצלחה. השינויים יישמרו אוטומטית.' });
          setActiveStep(0);
        } else {
          setCaseBanner({ type: 'error', message: 'קובץ לא תקין. אנא השתמש בקובץ שהופק מהמערכת.' });
        }
      } catch (err) {
        setCaseBanner({ type: 'error', message: 'שגיאה בטעינת הקובץ. נסה שוב או פנה לתמיכה.' });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const SectionCard: React.FC<{ title: string; subtitle?: string; children: ReactNode }> = ({
    title,
    subtitle,
    children,
  }) => (
    <section className="rounded-card border border-pearl bg-white shadow-card-xl">
      <div className="h-1.5 w-full rounded-t-card bg-navy" />
      <div className="p-6">
        <div className="flex items-center justify-between text-navy">
          <h2 className="text-lg font-semibold">{title}</h2>
          {subtitle && <span className="text-xs text-slate">{subtitle}</span>}
        </div>
        <div className="mt-2 w-12 border-b-2 border-gold rounded-full" />
        <div className="mt-6 text-slate">{children}</div>
      </div>
    </section>
  );

  const primaryNavigation = [
    { label: 'התיקים שלי', icon: FolderOpen, step: 0 },
    { label: 'ניתוח רפואי', icon: Shield, step: 1 },
    { label: 'תחשיבי נזק', icon: Activity, step: 2 },
    { label: 'נימוקים משפטיים', icon: BookOpen, step: 3 },
    { label: 'דוח מסכם', icon: FileText, step: 4 },
  ];

  const currentCaseRecord = caseList.find((record) => record.id === currentCaseId);
  const isCaseReadOnly = currentCaseRecord ? !(currentCaseRecord.isOwner ?? true) : false;

  if (!user) {
    return <LoginScreen />;
  }

  if (showAdminDashboard) {
    return (
      <AdminDashboard
        currentUserName={user.username}
        onEditCase={handleAdminEditCase}
        onLogout={handleLogout}
      />
    );
  }

  if (isLoadingCases || !currentCase) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pearl text-slate" dir="rtl">
        <div className="rounded-card border border-pearl bg-white px-6 py-4 shadow-card-xl text-sm">
          {loadError || 'טוען תיקים מהשרת...'}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pearl text-navy" dir="rtl">
      <div className="flex flex-col min-h-screen">
        <header className="h-16 bg-navy text-gold flex items-center justify-between px-6 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="text-xl font-semibold brand-mark">LexMedical</span>
            <span className="text-xs text-gold-light hidden md:inline">מערכת משפטית־רפואית פנימית</span>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <button className="relative text-gold-light hover:text-gold transition" aria-label="התראות מערכת">
              <Bell className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-pearl">
              <UserCircle className="w-6 h-6 text-gold-light" />
              <span>{user.username}</span>
            </div>
            <button onClick={handleLogout} className="text-gold hover:text-gold-light transition">
              התנתק
            </button>
          </div>
        </header>

        <ContextRibbon
          mode={isCaseReadOnly ? 'מצב קריאה בלבד' : 'מצב עריכת תיק פעיל'}
          caseName={currentCase?.name}
          status={currentCaseRecord?.status}
          isReadOnly={isCaseReadOnly}
          onBack={isAdmin ? () => setShowAdminDashboard(true) : () => window.history.back()}
        />
        <div className="flex flex-1">
          <aside className="hidden md:flex w-72 bg-navy-dark text-pearl flex-col border-l border-navy">
            <div className="px-6 py-6 border-b border-navy">
              <p className="text-xs uppercase tracking-widest text-slate-light">ניווט</p>
              <p className="text-2xl font-semibold text-white mt-2">שליטה מלאה בתיק</p>
            </div>
            <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
              <div>
                <p className="text-xs uppercase text-slate-light mb-3">ניהול תיק</p>
                <div className="space-y-2">
                  {primaryNavigation.map((item) => {
                    const isActive = activeStep === item.step;
                    return (
                      <button
                        key={item.label}
                        onClick={() => setActiveStep(item.step)}
                        className={`w-full flex items-center justify-between rounded-xl px-3 py-3 text-sm transition ${
                          isActive
                            ? 'bg-navy text-gold border-r-4 border-gold'
                            : 'bg-transparent text-pearl hover:bg-navy/60'
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <item.icon className="w-4 h-4" />
                          {item.label}
                        </span>
                        {isActive && <span className="text-[10px] uppercase tracking-widest text-gold-light">פעיל</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </nav>
            <div className="px-4 py-6 border-t border-navy space-y-3 text-sm">
              <button
                onClick={() => handleCreateNewCase(user.username)}
                className="w-full rounded-full bg-gold text-navy font-semibold py-2 hover:bg-gold-light transition flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4 rotate-180" />
                תיק חדש
              </button>
              <button
                onClick={handleExportCase}
                className="w-full rounded-full border border-gold text-gold py-2 hover:bg-gold/10 transition flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                שמור תיק
              </button>
              <button
                onClick={handleImportClick}
                className="w-full rounded-full bg-navy text-pearl py-2 hover:bg-navy/80 transition flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                טען תיק
              </button>
              <input type="file" ref={fileInputRef} onChange={handleImportFile} className="hidden" accept=".json" />
              {isAdmin && (
                <button
                  onClick={() => setShowAdminDashboard(true)}
                  className="w-full rounded-full bg-navy text-gold py-2 hover:bg-navy/70 transition flex items-center justify-center gap-2"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  דשבורד משרדי
                </button>
              )}
            </div>
          </aside>

          <main className="flex-1 bg-pearl overflow-y-auto">
            <div className="md:hidden px-6 py-4 space-y-3 border-b border-pearl">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {primaryNavigation.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => setActiveStep(item.step)}
                    className={`rounded-xl border px-3 py-2 flex items-center justify-center gap-2 ${
                      activeStep === item.step ? 'border-gold text-navy bg-white' : 'border-pearl text-slate'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            {caseBanner && (
              <div className="max-w-6xl mx-auto px-6">
                <div className={`mt-4 ${caseBanner.type === 'error' ? 'state-block state-block--error' : 'state-block'}`}>
                  <p className="state-block__title text-sm">
                    {caseBanner.type === 'error' ? 'ייבוא התיק נכשל' : 'ייבוא התיק הושלם'}
                  </p>
                  <p className="state-block__description">{caseBanner.message}</p>
                </div>
              </div>
            )}
            <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
              <SectionCard title="פרטי תיק" subtitle="שליטה מלאה בבסיס הנתונים">
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-slate">שם התיק</label>
                    <input
                      className="mt-2 w-full rounded-xl border border-pearl bg-pearl/60 px-3 py-2 text-sm focus:border-gold focus:ring-1 focus:ring-gold outline-none transition"
                      value={currentCase.name}
                      onChange={(e) => setCurrentCase({ ...currentCase, name: e.target.value })}
                    />
                  </div>
                  <div className="text-sm text-slate flex flex-col gap-2">
                    <span>עו"ד אחראי: {currentCase.attorney}</span>
                    {currentCase.attorney !== user.username && (
                      <span className="text-xs text-danger">
                        לצפייה בלבד – בבעלות {currentCase.attorney}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate">
                  <span>
                    {saveStatus === 'saving' && 'שומר...'}
                    {saveStatus === 'saved' && 'נשמר בהצלחה'}
                    {saveStatus === 'error' && 'שמירה נכשלה'}
                    {saveStatus === 'idle' && 'מוכן לעריכה'}
                  </span>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => setActiveStep((prev) => Math.max(0, prev - 1))}
                      disabled={activeStep === 0}
                      className="rounded-full border border-gold px-4 py-2 text-xs font-semibold text-gold hover:bg-gold/10 transition disabled:opacity-40"
                    >
                      חזרה
                    </button>
                    <button
                      onClick={() => setActiveStep((prev) => Math.min(4, prev + 1))}
                      disabled={activeStep === 4}
                      className="rounded-full bg-gold px-5 py-2 text-xs font-semibold text-navy flex items-center gap-2 hover:bg-gold-light transition disabled:opacity-40"
                    >
                      {activeStep === 0 ? 'התחל עבודה' : 'לשלב הבא'}
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </SectionCard>

              {activeStep === 0 && (
                <SectionCard title="לוח בקרה כללי">
                  <CaseDashboard caseData={currentCase} navigateToStep={setActiveStep} />
                </SectionCard>
              )}

              {activeStep === 1 && (
                <SectionCard title="ניתוח רפואי־משפטי" subtitle="רקע עובדתי ועיבוד חבות">
                  <div className="space-y-6">
                    <div className="rounded-card border border-pearl bg-pearl/50 p-4">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-semibold text-navy">רקע עובדתי / סיכום תיק</label>
                          <div>
                            <input
                              type="file"
                              id="summary-upload"
                              className="hidden"
                              accept=".pdf,.doc,.docx,.txt"
                              onChange={handleSummaryFileUpload}
                            />
                            <label
                              htmlFor="summary-upload"
                              className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-gold px-3 py-1 text-xs text-gold hover:bg-gold/10 transition"
                            >
                              <UploadCloud className="w-3 h-3" />
                              צרף קובץ
                            </label>
                          </div>
                        </div>
                        <textarea
                          className="w-full rounded-2xl border border-pearl bg-white p-4 text-sm text-navy focus:border-gold focus:ring-1 focus:ring-gold outline-none transition h-32"
                          placeholder="הזן כאן את העובדות המעובדות..."
                          value={currentCase.summary}
                          onChange={(e) => setCurrentCase({ ...currentCase, summary: e.target.value })}
                        />
                        {currentCase.summaryFiles && currentCase.summaryFiles.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {currentCase.summaryFiles.map((file: AttachedFile, idx: number) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2 rounded-full border border-pearl bg-white px-3 py-1 text-xs text-slate"
                              >
                                <FileText className="w-3 h-3" />
                                <span className="truncate max-w-[140px]">{file.name}</span>
                                <button
                                  onClick={() => removeSummaryFile(file.name)}
                                  className="text-danger hover:text-danger/80"
                                  aria-label={`הסר את הקובץ ${file.name}`}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="rounded-card border border-pearl bg-white p-4">
                      <LiabilityStep caseData={currentCase} updateCaseData={setCurrentCase} />
                    </div>
                  </div>
                </SectionCard>
              )}

              {activeStep === 2 && (
                <SectionCard title="תחשיבי נזק כספיים">
                  <DamagesStep caseData={currentCase} updateCaseData={setCurrentCase} />
                </SectionCard>
              )}

              {activeStep === 3 && (
                <SectionCard title="נימוקים משפטיים">
                  <ReasoningStep caseData={currentCase} />
                </SectionCard>
              )}

              {activeStep === 4 && (
                <SectionCard title="דוח מסכם">
                  <ReportStep caseData={currentCase} />
                </SectionCard>
              )}
            </div>
            <LegalDisclaimer />
          </main>
        </div>
      </div>
    </div>
  );
};

export default App;