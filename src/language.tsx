import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { ReplyLanguage } from './api';

/** The app's UI + reply language. Shared by every screen. */
export type AppLanguage = ReplyLanguage; // 'en' | 'ur' | 'fa' | 'ps' | 'sd'

const STORAGE_KEY = 'tahaffuz.language.v1';
const DEFAULT_LANGUAGE: AppLanguage = 'en';

const isAppLanguage = (v: unknown): v is AppLanguage =>
  v === 'en' || v === 'ur' || v === 'fa' || v === 'ps' || v === 'sd';

/** True when the language is written right-to-left (Urdu, Farsi, Pashto, Sindhi). */
export const isRtl = (lang: AppLanguage): boolean =>
  lang === 'ur' || lang === 'fa' || lang === 'ps' || lang === 'sd';

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
};

const LanguageContext = createContext<LanguageContextValue>({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(DEFAULT_LANGUAGE);

  // Restore the persisted choice on launch.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (isAppLanguage(saved)) setLanguageState(saved);
      })
      .catch(() => {});
  }, []);

  const setLanguage = useCallback((lang: AppLanguage) => {
    setLanguageState(lang);
    AsyncStorage.setItem(STORAGE_KEY, lang).catch(() => {});
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({ language, setLanguage }),
    [language, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** Read and change the app-wide language. */
export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
