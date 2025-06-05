
'use client';

import type React from 'react';
import { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import enTranslations from '@/locales/en.json';
import ptTranslations from '@/locales/pt.json';

type Locale = 'en' | 'pt';
type Translations = Record<string, string | Record<string, string>>; // Basic nested structure
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

function getNestedTranslation(keys: string[], currentTranslations: Translations | string): string | undefined {
  if (typeof currentTranslations === 'string') {
    return keys.length === 0 ? currentTranslations : undefined;
  }
  if (keys.length === 0) return undefined; // Should not happen if used correctly

  const key = keys[0];
  const nextNode = currentTranslations[key];

  if (keys.length === 1) {
    return typeof nextNode === 'string' ? nextNode : undefined;
  }
  if (typeof nextNode === 'object' && nextNode !== null) {
    return getNestedTranslation(keys.slice(1), nextNode as Translations);
  }
  return undefined;
}


export const LocalizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const storedLang = localStorage.getItem(LOCAL_STORAGE_LANG_KEY) as Locale | null;
    if (storedLang && (storedLang === 'en' || storedLang === 'pt')) {
      setLocaleState(storedLang);
      if (typeof document !== 'undefined') {
        document.documentElement.lang = storedLang;
      }
    } else if (typeof document !== 'undefined') {
        document.documentElement.lang = DEFAULT_LOCALE;
    }
    setIsInitialized(true);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(LOCAL_STORAGE_LANG_KEY, newLocale);
    if (typeof document !== 'undefined') {
        document.documentElement.lang = newLocale;
      }
  }, []);
  
  const getLocale = useCallback(() => locale, [locale]);

  const t = useCallback((key: string, values?: TranslationValues): string => {
    const keys = key.split('.');
    let text = getNestedTranslation(keys, translations[locale] || translations[DEFAULT_LOCALE]);

    if (text === undefined) {
      console.warn(`Translation key "${key}" not found for locale "${locale}". Falling back to default locale.`);
      text = getNestedTranslation(keys, translations[DEFAULT_LOCALE]);
    }
    
    if (text === undefined) {
        console.error(`Translation key "${key}" not found in default locale either.`);
        return key; // Return the key itself if not found anywhere
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
    // Remove currency symbols, thousands separators
    const sanitized = formattedAmount.replace(/[^\d,.-]/g, '');
    // Replace locale-specific decimal separator with a period
    const normalized = locale === 'pt' ? sanitized.replace('.', '').replace(',', '.') : sanitized.replace(',', '');
    const value = parseFloat(normalized);
    return isNaN(value) ? 0 : value;
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t, formatCurrency, parseCurrency, getLocale }), 
    [locale, setLocale, t, formatCurrency, parseCurrency, getLocale]);

  if (!isInitialized) {
    return null; // Or a loading spinner, but null avoids hydration issues with localStorage
  }

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
};
