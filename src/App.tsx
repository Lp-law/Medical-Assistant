import React, { ReactNode, useMemo, useState } from 'react';
import { useAuth } from './context/AuthContext';
import LoginScreen from './components/LoginScreen';
import {
  Library,
  FileText,
  Scale,
  Stethoscope,
  Calculator,
  Search,
  Bot,
  Bell,
  UserCircle,
  Mail,
} from 'lucide-react';
import ContextRibbon from './components/ContextRibbon';
import LegalDisclaimer from './components/LegalDisclaimer';
import DocumentsLibrary from './components/DocumentsLibrary';
import QuickUploadModal from './components/QuickUploadModal';
import { runEmailIngestNow } from './services/adminApi';
import BotAssistantWidget from './components/BotAssistantWidget';
import DamagesCalculator from './components/DamagesCalculator';

type Page = 'home' | 'documents' | 'calculator';

type UploadCategoryKey = 'judgments' | 'damages' | 'opinions' | 'summaries';

const CATEGORY_NAME: Record<UploadCategoryKey, string> = {
  judgments: 'פסקי דין',
  damages: 'תחשיבי נזק',
  opinions: 'חוות דעת',
  summaries: 'סיכומים',
};

const App: React.FC = () => {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [pageStack, setPageStack] = useState<Page[]>(['home']);
  const [uploadCategory, setUploadCategory] = useState<UploadCategoryKey | null>(null);
  const [homeSearch, setHomeSearch] = useState('');
  const [homeCategoryName, setHomeCategoryName] = useState<string | undefined>(undefined);
  const [homeIngestLoading, setHomeIngestLoading] = useState(false);
  const [homeIngestResult, setHomeIngestResult] = useState<string | null>(null);

  const handleLogout = () => {
    logout();
    setPageStack(['home']);
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

  const currentPage = pageStack[pageStack.length - 1] ?? 'home';
  const canGoBack = useMemo(() => pageStack.length > 1, [pageStack.length]);
  const pushPage = (page: Page) => setPageStack((prev) => [...prev, page]);
  const popPage = () => setPageStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));

  const handleManualEmailIngest = async () => {
    setHomeIngestLoading(true);
    setHomeIngestResult(null);
    try {
      const result = await runEmailIngestNow();
      if (result.success) {
        setHomeIngestResult(`הושלם: נמצאו ${result.processedMessages}, נוצרו ${result.documentsCreated}.`);
      } else {
        setHomeIngestResult(`נכשל: ${result.error ?? 'email_ingest_failed'}`);
      }
    } catch (e: any) {
      setHomeIngestResult(e?.message ?? 'email_ingest_failed');
    } finally {
      setHomeIngestLoading(false);
    }
  };

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-pearl text-navy" dir="rtl">
      <div className="flex flex-col min-h-screen">
        <header className="h-16 bg-navy text-gold flex items-center justify-between px-6 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="text-xl font-semibold brand-mark">LexMedical</span>
            <span className="text-xs text-gold-light hidden md:inline">מרכז ידע משרדי - Lp-Law</span>
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
          mode="מרכז ידע משרדי"
          caseName={
            currentPage === 'documents' ? 'מסמכים וחיפוש' : currentPage === 'calculator' ? 'מחשבון נזק' : 'דף הבית'
          }
          isReadOnly={false}
          onBack={canGoBack ? popPage : undefined}
        />
        <main className="flex-1 bg-pearl overflow-y-auto">
          <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
            {currentPage === 'home' && (
              <>
                <SectionCard title="מרכז ידע משרדי" subtitle="העלאה מהירה + חיפוש">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-card border border-pearl bg-white p-4">
                      <label className="text-xs font-semibold text-slate-light">חיפוש מהיר</label>
                      <div className="mt-2 flex gap-2">
                        <div className="relative flex-1">
                          <Search className="w-4 h-4 absolute top-3 right-3 text-slate-light" />
                          <input
                            className="w-full rounded-full border border-pearl bg-pearl/60 pr-10 pl-3 py-2 text-sm focus:border-gold focus:ring-1 focus:ring-gold outline-none transition"
                            value={homeSearch}
                            onChange={(e) => setHomeSearch(e.target.value)}
                            placeholder="לדוגמה: שם מומחה / אבחנה / הלכה / מונח רפואי..."
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => pushPage('documents')}
                          className="rounded-full bg-navy text-gold px-4 py-2 text-sm font-semibold hover:bg-navy/90 transition"
                        >
                          חפש
                        </button>
                      </div>
                      <p className="mt-3 text-xs text-slate">
                        החיפוש המלא נמצא במסך “מסמכים”. כאן זה קיצור דרך.
                      </p>
                    </div>

                    <div className="rounded-card border border-pearl bg-white p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-navy">עוזר חיפוש (AI)</p>
                        <p className="text-xs text-slate mt-1">בקרוב: בוט שמציע חיפושים ותוצאות בתוך המערכת.</p>
                      </div>
                      <div className="rounded-full border border-pearl text-slate px-4 py-2 text-sm font-semibold inline-flex items-center gap-2">
                        <Bot className="w-4 h-4 text-gold" />
                        פתח דרך כפתור הבוט הצף
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-card border border-pearl bg-white p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-navy">משיכת מסמכים מהמייל</p>
                      <p className="text-xs text-slate mt-1">
                        כפתור ידני שמריץ את משיכת המסמכים מה־IMAP (אדמין בלבד).
                      </p>
                      {homeIngestResult && <p className="text-xs mt-2 text-slate">{homeIngestResult}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={handleManualEmailIngest}
                      disabled={!isAdmin || homeIngestLoading}
                      className="rounded-full bg-navy text-gold px-4 py-2 text-sm font-semibold hover:bg-navy/90 transition disabled:opacity-50 inline-flex items-center gap-2"
                      title={!isAdmin ? 'נדרש משתמש Admin' : undefined}
                    >
                      <Mail className="w-4 h-4" />
                      {homeIngestLoading ? 'מושך...' : 'משוך פסקי דין מהמייל'}
                    </button>
                  </div>
                </SectionCard>

                <SectionCard title="הזנת ידע (4 קטגוריות)" subtitle="PDF / Word">
                  <div className="grid gap-4 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setUploadCategory('judgments')}
                      className="rounded-card border border-pearl bg-white p-5 text-right hover:shadow-card-xl transition"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-lg font-semibold text-navy">פסקי דין</p>
                          <p className="text-xs text-slate mt-1">העלה פסקי דין למאגר הידע.</p>
                        </div>
                        <Scale className="w-6 h-6 text-gold" />
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setUploadCategory('damages')}
                      className="rounded-card border border-pearl bg-white p-5 text-right hover:shadow-card-xl transition"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-lg font-semibold text-navy">תחשיבי נזק</p>
                          <p className="text-xs text-slate mt-1">מסמכי חישוב/אקסלים כ‑PDF/Word.</p>
                        </div>
                        <Calculator className="w-6 h-6 text-gold" />
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setUploadCategory('opinions')}
                      className="rounded-card border border-pearl bg-white p-5 text-right hover:shadow-card-xl transition"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-lg font-semibold text-navy">חוות דעת</p>
                          <p className="text-xs text-slate mt-1">חוות דעת מומחים (PDF/Word).</p>
                        </div>
                        <Stethoscope className="w-6 h-6 text-gold" />
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setUploadCategory('summaries')}
                      className="rounded-card border border-pearl bg-white p-5 text-right hover:shadow-card-xl transition"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-lg font-semibold text-navy">סיכומים</p>
                          <p className="text-xs text-slate mt-1">סיכומים שהוכנו בתיקים אחרים.</p>
                        </div>
                        <FileText className="w-6 h-6 text-gold" />
                      </div>
                    </button>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => pushPage('documents')}
                      className="rounded-full bg-gold text-navy px-5 py-2 text-sm font-semibold hover:bg-gold-light transition inline-flex items-center gap-2"
                    >
                      <Library className="w-4 h-4" />
                      עבור למסך מסמכים (חיפוש/תיוג)
                    </button>
                  </div>
                </SectionCard>

                <SectionCard title="כלים" subtitle="חישוב מהיר בתוך המערכת">
                  <div className="grid gap-4 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => pushPage('calculator')}
                      className="rounded-card border border-pearl bg-white p-5 text-right hover:shadow-card-xl transition"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-lg font-semibold text-navy">מחשבון נזק</p>
                          <p className="text-xs text-slate mt-1">טבלת ראשי נזק עם תרחישי תובע/נתבע/ממוצע והפחתות.</p>
                        </div>
                        <Calculator className="w-6 h-6 text-gold" />
                      </div>
                    </button>
                  </div>
                </SectionCard>
              </>
            )}

            {currentPage === 'documents' && (
              <SectionCard title="מסמכים" subtitle="חיפוש, העלאה, תיוג">
                <DocumentsLibrary initialQuery={homeSearch} initialCategoryName={homeCategoryName} autoSearchOnMount />
              </SectionCard>
            )}

            {currentPage === 'calculator' && (
              <SectionCard title="מחשבון נזק" subtitle="טבלה דינמית + שמירה מקומית">
                <DamagesCalculator />
              </SectionCard>
            )}
          </div>
          <LegalDisclaimer />
        </main>
      </div>

      <QuickUploadModal
        isOpen={uploadCategory !== null}
        categoryName={uploadCategory ? CATEGORY_NAME[uploadCategory] : ''}
        onClose={() => setUploadCategory(null)}
        onUploaded={() => undefined}
      />

      <BotAssistantWidget
        onOpenDocumentsWithQuery={(q, categoryName) => {
          setHomeSearch(q);
          setHomeCategoryName(categoryName);
          setPageStack(['home', 'documents']);
        }}
      />
    </div>
  );
};

export default App;