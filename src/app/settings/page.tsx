
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Languages, Save, Loader2, Edit } from 'lucide-react'; 
import type { AppStorage, Locale } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { useLocalization } from '@/hooks/use-localization';

const LOCAL_SETTINGS_KEY = 'billBlissSettings'; // Key for localStorage

export default function SettingsPage() {
  const { t, locale, setLocale: setGlobalLocale, formatCurrency, parseCurrency, getLocale } = useLocalization();
  const { toast } = useToast();

  const [isClient, setIsClient] = useState(false);
  // State for settings, loaded from localStorage
  const [localDefaultIncome, setLocalDefaultIncome] = useState<number>(0);
  const [localDefaultIncomeDisplay, setLocalDefaultIncomeDisplay] = useState('');
  const [localDefaultIncomeSourceName, setLocalDefaultIncomeSourceName] = useState('');
  const [currentLanguage, setCurrentLanguage] = useState<Locale>(locale);


  // Load settings from localStorage on mount
  useEffect(() => {
    setIsClient(true);
    setCurrentLanguage(getLocale()); // Initialize with global locale
    try {
      const storedSettingsString = localStorage.getItem(LOCAL_SETTINGS_KEY);
      if (storedSettingsString) {
        const parsedSettings: Omit<AppStorage, 'allMonthlyData'> = JSON.parse(storedSettingsString);
        
        const loadedDefaultIncome = parsedSettings.defaultIncome || 0;
        setLocalDefaultIncome(loadedDefaultIncome);
        setLocalDefaultIncomeDisplay(formatCurrency(loadedDefaultIncome)); // Format for display
        setLocalDefaultIncomeSourceName(parsedSettings.defaultIncomeSourceName || '');

        if (parsedSettings.userLocale && (parsedSettings.userLocale === 'en' || parsedSettings.userLocale === 'pt')) {
          setCurrentLanguage(parsedSettings.userLocale);
          // No need to setGlobalLocale here as it's derived from LocalizationContext or set by user interaction
        }
      } else {
        // If no settings in localStorage, initialize display for 0
        setLocalDefaultIncomeDisplay(formatCurrency(0));
        setLocalDefaultIncomeSourceName('');
      }
    } catch (error) {
      console.error("Failed to load settings from localStorage:", error);
      toast({
        variant: "destructive",
        title: t('toast.errorLoadingSettings.title'),
        description: t('toast.errorLoadingSettings.description'),
      });
      setLocalDefaultIncomeDisplay(formatCurrency(0)); // Fallback display
      setLocalDefaultIncomeSourceName('');
    }
  }, [toast, t, formatCurrency, getLocale]); // formatCurrency and getLocale are stable from useLocalization

  // Update display when locale changes (e.g., currency format) or defaultIncome changes
   useEffect(() => {
    if(isClient) { // Ensure this runs only client-side after initial load
        setLocalDefaultIncomeDisplay(formatCurrency(localDefaultIncome));
        setCurrentLanguage(getLocale()); // Keep language state in sync with global context
    }
  }, [locale, localDefaultIncome, formatCurrency, getLocale, isClient]);


  const handleDefaultIncomeInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // For direct input, allow users to type freely, validation/parsing on blur or save
    setLocalDefaultIncomeDisplay(event.target.value);
  };

  const handleDefaultIncomeInputBlur = () => {
    const numericValue = parseCurrency(localDefaultIncomeDisplay);
    setLocalDefaultIncome(numericValue); // Update numeric state
    setLocalDefaultIncomeDisplay(formatCurrency(numericValue)); // Re-format for display
  };

  const handleLanguageChange = (value: string) => {
    if (value === 'en' || value === 'pt') {
      const newLocale = value as Locale;
      setGlobalLocale(newLocale); // Update global context
      setCurrentLanguage(newLocale); // Update local state for select component
    }
  };

  const handleSaveChanges = useCallback(() => {
    if (!isClient) return;
    try {
      const numericDefaultIncome = parseCurrency(localDefaultIncomeDisplay);
      // Ensure numeric state is also up-to-date if blur didn't fire for some reason
      setLocalDefaultIncome(numericDefaultIncome); 

      const settingsToSave: Omit<AppStorage, 'allMonthlyData'> = {
        defaultIncome: numericDefaultIncome,
        defaultIncomeSourceName: localDefaultIncomeSourceName.trim(),
        userLocale: getLocale(), // Get current global locale
      };

      localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(settingsToSave));
      toast({
        title: t('toast.settingsSaved.title'),
        description: t('toast.settingsSaved.description'),
      });
    } catch (error) {
      console.error("Failed to save settings to localStorage:", error);
      toast({
        variant: "destructive",
        title: t('toast.errorSavingSettings.title'),
        description: t('toast.errorSavingSettings.description'),
      });
    }
  }, [isClient, toast, t, getLocale, parseCurrency, localDefaultIncomeDisplay, localDefaultIncomeSourceName, setGlobalLocale]);

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
              type="text" // Kept as text for better control over display and parsing
              value={localDefaultIncomeDisplay}
              onChange={handleDefaultIncomeInputChange}
              onBlur={handleDefaultIncomeInputBlur}
              placeholder={t('currency.placeholder', { exampleAmount: formatCurrency(0)})}
              className="mt-1 text-lg"
              aria-label={t('settings.defaultIncomeCard.label')}
            />
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center text-xl font-headline">
              <Edit className="mr-2 h-6 w-6 text-primary" />
              {t('settings.primaryIncomeNameCard.title')}
            </CardTitle>
            <CardDescription>{t('settings.primaryIncomeNameCard.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Label htmlFor="defaultIncomeSourceName" className="text-sm font-medium">
              {t('settings.primaryIncomeNameCard.label')}
            </Label>
            <Input
              id="defaultIncomeSourceName"
              type="text"
              value={localDefaultIncomeSourceName}
              onChange={(e) => setLocalDefaultIncomeSourceName(e.target.value)}
              placeholder={t('settings.primaryIncomeNameCard.placeholder')}
              className="mt-1 text-lg"
              aria-label={t('settings.primaryIncomeNameCard.label')}
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
