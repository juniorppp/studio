
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Languages, Save } from 'lucide-react';
import type { FinancialData, Bill } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { siteConfig } from '@/config/site';

const LOCAL_STORAGE_KEY = 'billBlissData';

// Default initial bills structure, similar to home page, to ensure bills data isn't lost
const initialBills: Bill[] = [
  { id: 'water', name: 'Water Bill', icon: () => null, amount: 0 }, // Icon not used here but part of type
  { id: 'electricity', name: 'Electricity Bill', icon: () => null, amount: 0 },
  { id: 'internet', name: 'Internet Bill', icon: () => null, amount: 0 },
  { id: 'rent', name: 'Rent / Mortgage', icon: () => null, amount: 0 },
];


export default function SettingsPage() {
  const [income, setIncome] = useState<number>(0);
  const [currentLanguage, setCurrentLanguage] = useState<string>('en');
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
    try {
      const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedData) {
        const parsedData: FinancialData = JSON.parse(storedData);
        setIncome(parsedData.income || 0);
        // You could also load/save language preference here if it were functional
      }
    } catch (error) {
      console.error("Failed to load data from localStorage:", error);
      toast({
        variant: "destructive",
        title: "Error loading settings",
        description: "Could not load saved settings. Using default values.",
      });
    }
  }, [toast]);

  const handleIncomeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setIncome(parseFloat(event.target.value) || 0);
  };

  const handleLanguageChange = (value: string) => {
    setCurrentLanguage(value);
    toast({
      title: "Language setting",
      description: "Full language switching is not yet implemented. This is a placeholder.",
    });
    // In a real scenario, you'd save this preference and trigger i18n changes.
  };

  const handleSaveChanges = useCallback(() => {
    if (!isClient) return;
    try {
      const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      let currentData: FinancialData;
      if (storedData) {
        currentData = JSON.parse(storedData);
      } else {
        // If no data exists, initialize with current income and default bills structure
        currentData = { income: income, bills: initialBills.map(b => ({...b, icon: b.icon.name as any})) };
      }
      
      currentData.income = income;
      // currentData.language = currentLanguage; // If saving language

      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentData));
      toast({
        title: "Settings Saved",
        description: "Your income has been updated.",
      });
    } catch (error) {
      console.error("Failed to save data to localStorage:", error);
      toast({
        variant: "destructive",
        title: "Error saving settings",
        description: "Could not save your settings.",
      });
    }
  }, [income, isClient, toast]);


  if (!isClient) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-8 bg-background">
        <p className="mt-4 text-lg text-foreground">Loading Settings...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 max-w-2xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl font-headline">
          Settings
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Manage your application settings.
        </p>
      </header>

      <div className="space-y-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center text-xl font-headline">
              <DollarSign className="mr-2 h-6 w-6 text-primary" />
              Monthly Income
            </CardTitle>
            <CardDescription>Set your total monthly income. This will be used across the app for calculations.</CardDescription>
          </CardHeader>
          <CardContent>
            <Label htmlFor="income" className="text-sm font-medium">Total Monthly Income</Label>
            <Input
              id="income"
              type="number"
              value={income}
              onChange={handleIncomeChange}
              placeholder="e.g., 3000"
              className="mt-1 text-lg"
              aria-label="Total Monthly Income"
            />
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center text-xl font-headline">
              <Languages className="mr-2 h-6 w-6 text-primary" />
              Language
            </CardTitle>
            <CardDescription>Choose your preferred language. (Language switching is a placeholder)</CardDescription>
          </CardHeader>
          <CardContent>
            <Label htmlFor="language" className="text-sm font-medium">Select Language</Label>
            <Select value={currentLanguage} onValueChange={handleLanguageChange}>
              <SelectTrigger id="language" className="mt-1 text-lg" aria-label="Select Language">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="pt">Português</SelectItem>
              </SelectContent>
            </Select>
             <p className="mt-2 text-xs text-muted-foreground">
              Note: Full language localization is not yet implemented. This is a UI placeholder.
            </p>
          </CardContent>
        </Card>
        
        <div className="flex justify-end">
          <Button onClick={handleSaveChanges} className="text-lg px-6 py-3">
            <Save className="mr-2 h-5 w-5" />
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
