
'use client';

import type React from 'react';
import { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import enTranslations from '@/locales/en.json';
import ptTranslations from '@/locales/pt.json';

type Locale = 'en' | 'pt';
type Translations = Record<string, string | Record<string, string>>;
type TranslationValues = Record<string, string | number>;

interface LocalizationContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, values?: TranslationValues, options?: { locale?: Locale }) => string;
  formatCurrency: (amount: number) => string;
  parseCurrency: (formattedAmount: string) => number;
  getLocale: () => Locale;
}

const translations: Record<Locale, Translations> = {
  en: enTranslations,
  pt: ptTranslations,
};

const DEFAULT_LOCALE: Locale = 'en';
const LOCAL_STORAGE_LANG_KEY = 'billBlissLanguage';

export const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

export const LocalizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize with DEFAULT_LOCALE to match server's initial render for hydration.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  // Effect to sync locale from localStorage on initial client mount.
  useEffect(() => {
    // This effect runs only on the client, after the initial render (which used DEFAULT_LOCALE).
    let clientPreferredLocale = DEFAULT_LOCALE;

    if (typeof window !== 'undefined' && window.localStorage) {
      const storedLang = localStorage.getItem(LOCAL_STORAGE_LANG_KEY) as Locale | null;
      if (storedLang && (storedLang === 'en' || storedLang === 'pt')) {
        clientPreferredLocale = storedLang; // Use stored preference if valid
      } else {
        // No valid preference in localStorage, so ensure localStorage is set to current default
        localStorage.setItem(LOCAL_STORAGE_LANG_KEY, DEFAULT_LOCALE);
      }
    }

    // If the determined clientLocale is different from the current state (which was DEFAULT_LOCALE initially),
    // update the state. This will cause a re-render with the client's preferred translations.
    if (clientPreferredLocale !== locale) {
      setLocaleState(clientPreferredLocale);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array: runs once on mount on the client.

  // Effect to update document's lang attribute whenever locale state changes.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(LOCAL_STORAGE_LANG_KEY, newLocale);
    }
  }, []);

  const getLocale = useCallback(() => locale, [locale]);

  const t = useCallback((key: string, values?: TranslationValues, options?: { locale?: Locale }): string => {
    const targetLocale = options?.locale || locale;
    let text: string | undefined;
    const currentLocaleTranslations = translations[targetLocale];
    if (currentLocaleTranslations) {
      text = currentLocaleTranslations[key] as string | undefined;
    }

    if (text === undefined && targetLocale !== DEFAULT_LOCALE) {
      // Fallback to default locale if translation not found in current non-default locale
      console.warn(`Translation key "${key}" not found for locale "${targetLocale}". Falling back to default locale ('${DEFAULT_LOCALE}').`);
      const defaultLocaleTranslations = translations[DEFAULT_LOCALE];
      if (defaultLocaleTranslations) {
        text = defaultLocaleTranslations[key] as string | undefined;
      }
    }
    
    if (text === undefined) {
        console.error(`Translation key "${key}" not found in default locale ('${DEFAULT_LOCALE}') or target locale ('${targetLocale}'). Returning key.`);
        return key; 
    }

    if (values) {
      Object.keys(values).forEach((placeholder) => {
        text = text!.replace(new RegExp(`{${placeholder}}`, 'g'), String(values[placeholder]));
      });
    }
    return text!;
  }, [locale]);

  const formatCurrency = useCallback((amount: number): string => {
    const options: Intl.NumberFormatOptions = {
      style: 'currency',
      currency: locale === 'pt' ? 'BRL' : 'USD',
    };
    return new Intl.NumberFormat(locale === 'pt' ? 'pt-BR' : 'en-US', options).format(amount);
  }, [locale]);

  const parseCurrency = useCallback((formattedAmount: string): number => {
    const sanitized = formattedAmount.replace(/[^\d,.-]/g, '');
    // For pt-BR, thousands separator is '.', decimal is ','. For en-US, thousands is ',', decimal is '.'
    const normalized = locale === 'pt' 
      ? sanitized.replace(/\./g, '').replace(',', '.') 
      : sanitized.replace(/,/g, '');
    const value = parseFloat(normalized);
    return isNaN(value) ? 0 : value;
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t, formatCurrency, parseCurrency, getLocale }), 
    [locale, setLocale, t, formatCurrency, parseCurrency, getLocale]);

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
};
