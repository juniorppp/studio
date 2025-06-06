
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Languages, Save, Loader2, Edit } from 'lucide-react'; 
import type { UserSettings, Locale, UserJWTPayload } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { useLocalization } from '@/hooks/use-localization';
import { getUserSession } from '@/actions/auth';
import { getUserSettings, saveUserSettings } from '@/actions/user-settings';

const LOCAL_STORAGE_SETTINGS_KEY = 'billBlissSettings_legacy'; // For migration

export default function SettingsPage() {
  const { t, locale: currentGlobalLocale, setLocale: setGlobalLocale, formatCurrency, parseCurrency } = useLocalization();
  const { toast } = useToast();
  const router = useRouter();

  const [session, setSession] = useState<UserJWTPayload | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [localDefaultIncome, setLocalDefaultIncome] = useState<number>(0);
  const [localDefaultIncomeDisplay, setLocalDefaultIncomeDisplay] = useState('');
  const [localDefaultIncomeSourceName, setLocalDefaultIncomeSourceName] = useState('');
  const [currentLanguage, setCurrentLanguage] = useState<Locale>(currentGlobalLocale);

  useEffect(() => {
    setIsClient(true);
    const loadAuthAndSettings = async () => {
      setIsLoading(true);
      const currentSession = await getUserSession();
      if (!currentSession) {
        router.push('/login?next=/settings');
        return;
      }
      setSession(currentSession);

      try {
        let settings = await getUserSettings(currentSession.userId);

        // One-time migration from localStorage
        const legacySettingsString = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
        if (legacySettingsString) {
          try {
            const legacySettings = JSON.parse(legacySettingsString);
            // Check if DB settings are still default or non-existent for this user, and legacy exists
            if (settings && settings.defaultIncome === 0 && legacySettings.defaultIncome > 0) {
                const migratedSettings: Partial<Omit<UserSettings, '_id' | 'userId'>> = {
                    userLocale: legacySettings.userLocale || currentGlobalLocale,
                    defaultIncome: legacySettings.defaultIncome || 0,
                    defaultIncomeSourceName: legacySettings.defaultIncomeSourceName || '',
                };
                settings = await saveUserSettings(currentSession.userId, migratedSettings);
                toast({ title: t('settings.toast.migrated.title'), description: t('settings.toast.migrated.description') });
                localStorage.removeItem(LOCAL_STORAGE_SETTINGS_KEY); // Remove after successful migration
            } else {
                 localStorage.removeItem(LOCAL_STORAGE_SETTINGS_KEY); // Remove if not migrating to avoid re-check
            }
          } catch (e) {
            console.error("Error migrating legacy settings:", e);
            localStorage.removeItem(LOCAL_STORAGE_SETTINGS_KEY); // Remove corrupted legacy settings
          }
        }
        
        if (settings) {
          setLocalDefaultIncome(settings.defaultIncome || 0);
          setLocalDefaultIncomeDisplay(formatCurrency(settings.defaultIncome || 0));
          setLocalDefaultIncomeSourceName(settings.defaultIncomeSourceName || '');
          setCurrentLanguage(settings.userLocale);
          if (settings.userLocale !== currentGlobalLocale) {
            setGlobalLocale(settings.userLocale);
          }
        } else {
          // Should not happen if getUserSettings returns defaults, but as a fallback:
          setLocalDefaultIncomeDisplay(formatCurrency(0));
        }

      } catch (error) {
        console.error("Failed to load user settings:", error);
        toast({
          variant: "destructive",
          title: t('toast.errorLoadingSettings.title'),
          description: (error as Error).message,
        });
        setLocalDefaultIncomeDisplay(formatCurrency(0));
      } finally {
        setIsLoading(false);
      }
    };
    loadAuthAndSettings();
  }, [router, toast, t, formatCurrency, setGlobalLocale, currentGlobalLocale]);


  useEffect(() => {
    if(isClient && !isLoading) { 
        setLocalDefaultIncomeDisplay(formatCurrency(localDefaultIncome));
    }
  }, [currentGlobalLocale, localDefaultIncome, formatCurrency, isClient, isLoading]);


  const handleDefaultIncomeInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLocalDefaultIncomeDisplay(event.target.value);
  };

  const handleDefaultIncomeInputBlur = () => {
    const numericValue = parseCurrency(localDefaultIncomeDisplay);
    setLocalDefaultIncome(numericValue); 
    setLocalDefaultIncomeDisplay(formatCurrency(numericValue)); 
  };

  const handleLanguageChange = (value: string) => {
    if (value === 'en' || value === 'pt') {
      const newLocale = value as Locale;
      setGlobalLocale(newLocale); 
      setCurrentLanguage(newLocale); 
    }
  };

  const handleSaveChanges = useCallback(async () => {
    if (!isClient || !session?.userId) {
        toast({ variant: 'destructive', title: t('generic.error'), description: t('settings.toast.notAuthenticated')});
        return;
    }
    setIsLoading(true);
    try {
      const numericDefaultIncome = parseCurrency(localDefaultIncomeDisplay);
      setLocalDefaultIncome(numericDefaultIncome); 

      const settingsToSave: Partial<Omit<UserSettings, '_id' | 'userId'>> = {
        defaultIncome: numericDefaultIncome,
        defaultIncomeSourceName: localDefaultIncomeSourceName.trim(),
        userLocale: currentLanguage, 
      };

      await saveUserSettings(session.userId, settingsToSave);
      toast({
        title: t('toast.settingsSaved.title'),
        description: t('toast.settingsSaved.description'),
      });
    } catch (error) {
      console.error("Failed to save settings to DB:", error);
      toast({
        variant: "destructive",
        title: t('toast.errorSavingSettings.title'),
        description: (error as Error).message,
      });
    } finally {
        setIsLoading(false);
    }
  }, [isClient, session, toast, t, parseCurrency, localDefaultIncomeDisplay, localDefaultIncomeSourceName, currentLanguage]);

  if (!isClient || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-56px)] p-4 sm:p-8 bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-foreground">{isLoading ? t('settings.loading') : t('app.loadingAuth')}</p>
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
              placeholder={t('currency.placeholder', { exampleAmount: formatCurrency(0)})}
              className="mt-1 text-lg"
              aria-label={t('settings.defaultIncomeCard.label')}
              disabled={isLoading}
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
              disabled={isLoading}
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
            <Select value={currentLanguage} onValueChange={handleLanguageChange} disabled={isLoading}>
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
          <Button onClick={handleSaveChanges} className="text-lg px-6 py-3" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
            {t('settings.saveButton')}
          </Button>
        </div>
      </div>
    </div>
  );
}
