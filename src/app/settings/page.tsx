
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Languages, Save, Loader2 } from 'lucide-react';
import type { AppStorage, Locale } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { useLocalization } from '@/hooks/use-localization';

const LOCAL_STORAGE_KEY = 'billBlissData';

export default function SettingsPage() {
  const { t, locale, setLocale: setGlobalLocale, formatCurrency, parseCurrency, getLocale } = useLocalization();
  const { toast } = useToast();

  const [isClient, setIsClient] = useState(false);
  const [defaultIncome, setDefaultIncome] = useState<number>(0);
  const [localDefaultIncomeDisplay, setLocalDefaultIncomeDisplay] = useState('');
  const [currentLanguage, setCurrentLanguage] = useState<Locale>(locale);


  useEffect(() => {
    setIsClient(true);
    setCurrentLanguage(getLocale()); 
    try {
      const storedDataString = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedDataString) {
        const parsedAppStorage: AppStorage = JSON.parse(storedDataString);
        const loadedDefaultIncome = parsedAppStorage.defaultIncome || 0;
        setDefaultIncome(loadedDefaultIncome);
        setLocalDefaultIncomeDisplay(formatCurrency(loadedDefaultIncome));
        
        if (parsedAppStorage.userLocale && (parsedAppStorage.userLocale === 'en' || parsedAppStorage.userLocale === 'pt')) {
          setCurrentLanguage(parsedAppStorage.userLocale);
        }
      } else {
        setLocalDefaultIncomeDisplay(formatCurrency(0));
      }
    } catch (error) {
      console.error("Failed to load data from localStorage:", error);
      toast({
        variant: "destructive",
        title: t('toast.errorLoadingSettings.title'),
        description: t('toast.errorLoadingSettings.description'),
      });
      setLocalDefaultIncomeDisplay(formatCurrency(0));
    }
  }, [toast, t, formatCurrency, getLocale]); 

  useEffect(() => {
    setLocalDefaultIncomeDisplay(formatCurrency(defaultIncome));
    setCurrentLanguage(getLocale()); 
  }, [locale, defaultIncome, formatCurrency, getLocale]);


  const handleDefaultIncomeInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLocalDefaultIncomeDisplay(event.target.value);
  };

  const handleDefaultIncomeInputBlur = () => {
    const numericValue = parseCurrency(localDefaultIncomeDisplay);
    setDefaultIncome(numericValue);
    setLocalDefaultIncomeDisplay(formatCurrency(numericValue)); 
  };

  const handleLanguageChange = (value: string) => {
    if (value === 'en' || value === 'pt') {
      const newLocale = value as Locale;
      setGlobalLocale(newLocale); 
      setCurrentLanguage(newLocale); 
    }
  };

  const handleSaveChanges = useCallback(() => {
    if (!isClient) return;
    try {
      const numericDefaultIncome = parseCurrency(localDefaultIncomeDisplay);
      setDefaultIncome(numericDefaultIncome); 
      setLocalDefaultIncomeDisplay(formatCurrency(numericDefaultIncome));

      const storedDataString = localStorage.getItem(LOCAL_STORAGE_KEY);
      let currentAppStorage: AppStorage;

      if (storedDataString) {
        currentAppStorage = JSON.parse(storedDataString);
      } else {
        currentAppStorage = {
          userLocale: getLocale(),
          defaultIncome: numericDefaultIncome,
          allMonthlyData: [],
        };
      }
      
      currentAppStorage.defaultIncome = numericDefaultIncome;
      currentAppStorage.userLocale = getLocale(); 

      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentAppStorage));
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
  }, [isClient, toast, t, getLocale, parseCurrency, formatCurrency, localDefaultIncomeDisplay, setGlobalLocale]);

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
              {t('settings.defaultIncomeCard.title')}
            </CardTitle>
            <CardDescription>{t('settings.defaultIncomeCard.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Label htmlFor="defaultIncome" className="text-sm font-medium">{t('settings.defaultIncomeCard.label')}</Label>
            <Input
              id="defaultIncome"
              type="text"
              value={localDefaultIncomeDisplay}
              onChange={handleDefaultIncomeInputChange}
              onBlur={handleDefaultIncomeInputBlur}
              placeholder={t('currency.placeholder', { exampleAmount: formatCurrency(appStorage?.defaultIncome || 3000)})}
              className="mt-1 text-lg"
              aria-label={t('settings.defaultIncomeCard.label')}
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
