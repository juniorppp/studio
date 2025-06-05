
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Languages, Save, Loader2 } from 'lucide-react';
import type { FinancialData, StoredBillData } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { useLocalization } from '@/hooks/use-localization';

const LOCAL_STORAGE_KEY = 'billBlissData';

export default function SettingsPage() {
  const { t, locale, setLocale, formatCurrency, parseCurrency, getLocale } = useLocalization();
  const [income, setIncome] = useState<number>(0);
  const [currentLanguage, setCurrentLanguage] = useState<string>(locale);
  const [isClient, setIsClient] = useState(false);
  const [localIncomeDisplay, setLocalIncomeDisplay] = useState('');

  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
    setCurrentLanguage(getLocale());
    try {
      const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedData) {
        const parsedData: FinancialData = JSON.parse(storedData);
        const loadedIncome = parsedData.income || 0;
        setIncome(loadedIncome);
        setLocalIncomeDisplay(formatCurrency(loadedIncome));
        if (parsedData.language && (parsedData.language === 'en' || parsedData.language === 'pt')) {
          // setLocale(parsedData.language); // Already handled by LocalizationProvider
          setCurrentLanguage(parsedData.language);
        }
      } else {
        setLocalIncomeDisplay(formatCurrency(0));
      }
    } catch (error) {
      console.error("Failed to load data from localStorage:", error);
      toast({
        variant: "destructive",
        title: t('toast.errorLoadingSettings.title'),
        description: t('toast.errorLoadingSettings.description'),
      });
      setLocalIncomeDisplay(formatCurrency(0));
    }
  }, [toast, t, formatCurrency, getLocale]);

  useEffect(() => {
    // Update display when locale changes (e.g. currency format)
    setLocalIncomeDisplay(formatCurrency(income));
    setCurrentLanguage(getLocale());
  }, [locale, income, formatCurrency, getLocale]);


  const handleIncomeInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const displayValue = event.target.value;
    setLocalIncomeDisplay(displayValue); // Keep the raw input for display
    
    // Attempt to parse, but only update state on blur or save to avoid weird reformatting during typing
    // const numericValue = parseCurrency(displayValue);
    // setIncome(numericValue); // This would update too aggressively
  };

  const handleIncomeInputBlur = () => {
    const numericValue = parseCurrency(localIncomeDisplay);
    setIncome(numericValue);
    setLocalIncomeDisplay(formatCurrency(numericValue)); // Reformat to canonical
  };

  const handleLanguageChange = (value: string) => {
    if (value === 'en' || value === 'pt') {
      setLocale(value);
      setCurrentLanguage(value);
      toast({
        title: t('toast.languageUpdated.title'),
        description: value === 'pt' ? "O idioma foi definido para Português." : "Language has been set to English.",
      });
    }
  };

  const handleSaveChanges = useCallback(() => {
    if (!isClient) return;
    try {
      // Final parse before saving
      const numericIncome = parseCurrency(localIncomeDisplay);
      setIncome(numericIncome); // Ensure income state is the numeric value
      setLocalIncomeDisplay(formatCurrency(numericIncome)); // And display is formatted

      const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      let currentData: FinancialData;
      if (storedData) {
        currentData = JSON.parse(storedData);
      } else {
        currentData = { income: numericIncome, bills: [], language: getLocale() };
      }
      
      currentData.income = numericIncome;
      currentData.language = getLocale();

      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentData));
      toast({
        title: t('toast.settingsSaved.title'),
        description: t('toast.settingsSaved.description'),
      });
    } catch (error) {
      console.error("Failed to save data to localStorage:", error);
      toast({
        variant: "destructive",
        title: t('toast.errorSavingSettings.title'),
        description: t('toast.errorSavingSettings.description'),
      });
    }
  }, [isClient, toast, t, getLocale, parseCurrency, formatCurrency, localIncomeDisplay]);

  if (!isClient) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-56px)] p-4 sm:p-8 bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-foreground">{t('settings.loading')}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 max-w-2xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl font-headline">
          {t('settings.title')}
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          {t('settings.description')}
        </p>
      </header>

      <div className="space-y-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center text-xl font-headline">
              <DollarSign className="mr-2 h-6 w-6 text-primary" />
              {t('settings.incomeCard.title')}
            </CardTitle>
            <CardDescription>{t('settings.incomeCard.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Label htmlFor="income" className="text-sm font-medium">{t('settings.incomeCard.label')}</Label>
            <Input
              id="income"
              type="text" // Use text for formatted input
              value={localIncomeDisplay}
              onChange={handleIncomeInputChange}
              onBlur={handleIncomeInputBlur}
              placeholder={t('currency.placeholder', { exampleAmount: formatCurrency(3000)})}
              className="mt-1 text-lg"
              aria-label={t('settings.incomeCard.label')}
            />
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center text-xl font-headline">
              <Languages className="mr-2 h-6 w-6 text-primary" />
              {t('settings.languageCard.title')}
            </CardTitle>
            <CardDescription>{t('settings.languageCard.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Label htmlFor="language" className="text-sm font-medium">{t('settings.languageCard.label')}</Label>
            <Select value={currentLanguage} onValueChange={handleLanguageChange}>
              <SelectTrigger id="language" className="mt-1 text-lg" aria-label={t('settings.languageCard.label')}>
                <SelectValue placeholder={t('settings.languageCard.label')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{t('settings.languageCard.english')}</SelectItem>
                <SelectItem value="pt">{t('settings.languageCard.portuguese')}</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        
        <div className="flex justify-end">
          <Button onClick={handleSaveChanges} className="text-lg px-6 py-3">
            <Save className="mr-2 h-5 w-5" />
            {t('settings.saveButton')}
          </Button>
        </div>
      </div>
    </div>
  );
}
