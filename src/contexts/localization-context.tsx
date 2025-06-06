
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
  t: (key: string, values?: TranslationValues) => string;
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
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const storedLang = localStorage.getItem(LOCAL_STORAGE_LANG_KEY) as Locale | null;
    let initialLocale = DEFAULT_LOCALE;
    if (storedLang && (storedLang === 'en' || storedLang === 'pt')) {
      initialLocale = storedLang;
    }
    
    setLocaleState(initialLocale); // Update React state
    if (typeof document !== 'undefined') { // Update HTML lang attribute
      document.documentElement.lang = initialLocale;
    }
    setIsInitialized(true);
  }, []); // Runs once on mount

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(LOCAL_STORAGE_LANG_KEY, newLocale);
    if (typeof document !== 'undefined') {
        document.documentElement.lang = newLocale;
      }
  }, []);
  
  const getLocale = useCallback(() => locale, [locale]);

  const t = useCallback((key: string, values?: TranslationValues): string => {
    let text: string | undefined;
    const currentLocaleTranslations = translations[locale];
    if (currentLocaleTranslations) {
      text = currentLocaleTranslations[key] as string | undefined;
    }

    if (text === undefined) {
      if (locale !== DEFAULT_LOCALE) { 
        console.warn(`Translation key "${key}" not found for locale "${locale}". Falling back to default locale ('${DEFAULT_LOCALE}').`);
      }
      const defaultLocaleTranslations = translations[DEFAULT_LOCALE];
      if (defaultLocaleTranslations) {
        text = defaultLocaleTranslations[key] as string | undefined;
      }
    }
    
    if (text === undefined) {
        console.error(`Translation key "${key}" not found in default locale ('${DEFAULT_LOCALE}') or current locale ('${locale}'). Returning key.`);
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
    const normalized = locale === 'pt' ? sanitized.replace(/\./g, '').replace(',', '.') : sanitized.replace(/,/g, '');
    const value = parseFloat(normalized);
    return isNaN(value) ? 0 : value;
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t, formatCurrency, parseCurrency, getLocale }), 
    [locale, setLocale, t, formatCurrency, parseCurrency, getLocale]);

  if (!isInitialized) {
    return null; 
  }

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
};

    