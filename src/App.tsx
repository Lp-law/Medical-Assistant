import React, { useState } from 'react';
import { Calculator, LogOut, Book } from 'lucide-react';
import { LangProvider } from './context/LangContext';
import { useAuth } from './context/AuthContext';
import DamagesCalculator from './components/DamagesCalculator';
import BotAssistantWidget from './components/BotAssistantWidget';
import BookChaptersModal from './components/BookChaptersModal';

const App: React.FC = () => {
  const [botOpen, setBotOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const { user, logout } = useAuth();

  return (
    <LangProvider>
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
            {user && (
              <>
                <button
                  type="button"
                  onClick={() => setBookOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-gold hover:bg-gold/10 transition"
                  aria-label="ספר תחשיבי נזק"
                >
                  <Book className="w-5 h-5" />
                  <span className="hidden sm:inline">תחשיבי נזק</span>
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-gold hover:bg-gold/10 transition"
                  aria-label="התנתקות"
                >
                  <LogOut className="w-4 h-4" />
                  התנתקות
                </button>
              </>
            )}
          </div>
        </header>
        <BookChaptersModal open={bookOpen} onClose={() => setBookOpen(false)} />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 py-6 md:px-6 md:py-8">
            <DamagesCalculator />
          </div>
        </main>
      </div>

      <BotAssistantWidget mode="calculator" open={botOpen} onOpenChange={setBotOpen} />
    </div>
    </LangProvider>
  );
};

export default App;
