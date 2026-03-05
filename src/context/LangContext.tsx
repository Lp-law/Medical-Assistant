import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Lang } from '../utils/calcI18n';

const LangContext = createContext<{
  lang: Lang;
  setLang: (lang: Lang) => void;
} | null>(null);

export const LangProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Lang>('he');
  const value = { lang, setLang: useCallback((l: Lang) => setLang(l), []) };
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
};

export function useLang(): { lang: Lang; setLang: (lang: Lang) => void } {
  const ctx = useContext(LangContext);
  if (!ctx) {
    return {
      lang: 'he',
      setLang: () => {},
    };
  }
  return ctx;
}
