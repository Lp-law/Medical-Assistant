import React, { useState } from 'react';
import { Calculator, LogOut, Book, FileText } from 'lucide-react';
import { LangProvider } from './context/LangContext';
import { useLang } from './context/LangContext';
import { useAuth } from './context/AuthContext';
import DamagesCalculator from './components/DamagesCalculator';
import BotAssistantWidget from './components/BotAssistantWidget';
import BookChaptersModal from './components/BookChaptersModal';
import DocumentsLibrary from './components/DocumentsLibrary';

type MainView = 'calculator' | 'documents';

const APP_I18N = {
  he: {
    documents: 'מסמכים',
    calculator: 'מחשבון נזק',
  },
  'en-GB': {
    documents: 'Documents',
    calculator: 'Damages Calculator',
  },
} as const;

const App: React.FC = () => {
  return (
    <LangProvider>
      <AppShell />
    </LangProvider>
  );
};

const AppShell: React.FC = () => {
  const [botOpen, setBotOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [mainView, setMainView] = useState<MainView>('calculator');
  const { user, logout } = useAuth();
  const { lang } = useLang();
  const t = APP_I18N[lang];

  return (
    <div className="min-h-screen bg-pearl text-navy" dir="rtl">
      <div className="flex flex-col min-h-screen">
        <header className="h-16 bg-navy text-gold flex items-center justify-between px-6 shadow-lg">
          <div className="flex items-center gap-3">
            <Calculator className="w-7 h-7 text-gold" aria-hidden="true" />
            <div>
              <span className="text-xl font-semibold brand-mark">LexMedical</span>
              <span className="text-xs text-gold-light block md:inline md:mr-3">מחשבון נזק – Lp-Law</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMainView('documents')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition ${
                mainView === 'documents' ? 'bg-gold/20 text-gold' : 'text-gold hover:bg-gold/10'
              }`}
              aria-label={t.documents}
            >
              <FileText className="w-5 h-5" />
              <span>{t.documents}</span>
            </button>
            <button
              type="button"
              onClick={() => setBookOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-gold hover:bg-gold/10 transition"
              aria-label="ספר תחשיבי נזק"
            >
              <Book className="w-5 h-5" />
              <span>תחשיבי נזק</span>
            </button>
            {user && (
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-gold hover:bg-gold/10 transition"
                aria-label="התנתקות"
              >
                <LogOut className="w-4 h-4" />
                התנתקות
              </button>
            )}
          </div>
        </header>
        <BookChaptersModal open={bookOpen} onClose={() => setBookOpen(false)} />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 py-6 md:px-6 md:py-8">
            {mainView === 'documents' ? <DocumentsLibrary autoSearchOnMount={false} /> : <DamagesCalculator />}
          </div>
        </main>
      </div>

      <BotAssistantWidget mode="documents" open={botOpen} onOpenChange={setBotOpen} />
    </div>
  );
};

export default App;
