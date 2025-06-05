
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Droplet, Zap, Wifi, Home, DollarSign, LineChart, AlertCircle, Loader2, Brain, Settings as SettingsIcon, Receipt, PlusCircle } from 'lucide-react';
import type { Bill, FinancialData, BillConfig, StoredBillData } from '@/types';
import { getSpendingInsights } from '@/ai/flows/spending-insights';
import type { SpendingInsightsInput, SpendingInsightsOutput } from '@/ai/flows/spending-insights';
import { siteConfig } from '@/config/site';
import { useToast } from "@/hooks/use-toast";
import { useLocalization } from '@/hooks/use-localization';

const LOCAL_STORAGE_KEY = 'billBlissData';

const PREDEFINED_BILLS_CONFIG: BillConfig[] = [
  { id: 'water', nameKey: 'home.bills.water', defaultName: 'Water Bill', icon: Droplet },
  { id: 'electricity', nameKey: 'home.bills.electricity', defaultName: 'Electricity Bill', icon: Zap },
  { id: 'internet', nameKey: 'home.bills.internet', defaultName: 'Internet Bill', icon: Wifi },
  { id: 'rent', nameKey: 'home.bills.rent', defaultName: 'Rent / Mortgage', icon: Home },
];

export default function HomePage() {
  const { t, formatCurrency, parseCurrency, getLocale } = useLocalization();
  const [income, setIncome] = useState<number>(0);
  const [localIncomeDisplay, setLocalIncomeDisplay] = useState('');
  const [bills, setBills] = useState<Bill[]>([]);
  const [insights, setInsights] = useState<string | null>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState<boolean>(false);
  const [errorInsights, setErrorInsights] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  const [isAddBillModalOpen, setIsAddBillModalOpen] = useState(false);
  const [newBillName, setNewBillName] = useState('');
  const [newBillAmount, setNewBillAmount] = useState('');


  const mapStoredDataToBills = useCallback((storedBills: StoredBillData[]): Bill[] => {
    return storedBills.map(storedBill => {
      if (storedBill.isCustom) {
        return {
          id: storedBill.id,
          name: storedBill.name || 'Custom Bill', // Fallback name
          icon: Receipt, // Generic icon for custom bills
          amount: storedBill.amount || 0,
          isCustom: true,
        };
      }
      const config = PREDEFINED_BILLS_CONFIG.find(pb => pb.id === storedBill.id);
      if (config) {
        return {
          id: config.id,
          name: t(config.nameKey) || config.defaultName,
          nameKey: config.nameKey,
          icon: config.icon,
          amount: storedBill.amount || 0,
          isCustom: false,
        };
      }
      return null; // Should not happen if data is consistent
    }).filter(bill => bill !== null) as Bill[];
  }, [t]);
  
  const initializeBills = useCallback(() => {
    return PREDEFINED_BILLS_CONFIG.map(config => ({
      id: config.id,
      name: t(config.nameKey) || config.defaultName,
      nameKey: config.nameKey,
      icon: config.icon,
      amount: 0,
      isCustom: false,
    }));
  }, [t]);


  useEffect(() => {
    setIsClient(true);
    try {
      const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedData) {
        const parsedData: FinancialData = JSON.parse(storedData);
        const loadedIncome = parsedData.income || 0;
        setIncome(loadedIncome);
        setLocalIncomeDisplay(formatCurrency(loadedIncome));
        
        if (parsedData.bills && parsedData.bills.length > 0) {
          setBills(mapStoredDataToBills(parsedData.bills));
        } else {
          setBills(initializeBills());
        }
      } else {
        setLocalIncomeDisplay(formatCurrency(0));
        setBills(initializeBills());
      }
    } catch (error) {
      console.error("Failed to load data from localStorage:", error);
      toast({
        variant: "destructive",
        title: t('toast.errorLoadingData.title'),
        description: t('toast.errorLoadingData.description'),
      });
      setLocalIncomeDisplay(formatCurrency(0));
      setBills(initializeBills());
    }
  }, [toast, t, formatCurrency, mapStoredDataToBills, initializeBills]);

  useEffect(() => {
    // Update bill names and income display if locale changes
    setBills(currentBills => currentBills.map(bill => ({
      ...bill,
      name: bill.isCustom ? bill.name : (t(bill.nameKey || '') || PREDEFINED_BILLS_CONFIG.find(pb => pb.id === bill.id)?.defaultName || 'Bill')
    })));
    setLocalIncomeDisplay(formatCurrency(income));
  }, [t, income, formatCurrency]);


  useEffect(() => {
    if (isClient) {
      try {
        const storedBillsData: StoredBillData[] = bills.map(bill => ({
          id: bill.id,
          amount: bill.amount,
          name: bill.isCustom ? bill.name : undefined,
          isCustom: bill.isCustom,
        }));
        const dataToStore: FinancialData = { income, bills: storedBillsData, language: getLocale() };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToStore));
      } catch (error) {
        console.error("Failed to save data to localStorage:", error);
         toast({
          variant: "destructive",
          title: t('toast.errorSavingData.title'),
          description: t('toast.errorSavingData.description'),
        });
      }
    }
  }, [income, bills, isClient, toast, t, getLocale]);

  const handleIncomeInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLocalIncomeDisplay(event.target.value);
  };

  const handleIncomeInputBlur = () => {
    const numericValue = parseCurrency(localIncomeDisplay);
    setIncome(numericValue);
    setLocalIncomeDisplay(formatCurrency(numericValue));
  };

  const handleBillAmountChange = (billId: string, amountStr: string) => {
    // Allow direct input for amounts, parse on blur for bills as well
    setBills(prevBills =>
      prevBills.map(bill =>
        bill.id === billId ? { ...bill, amount: parseCurrency(amountStr) } : bill // Store numeric value
      )
    );
  };
  
  const handleBillAmountDisplayChange = (billId: string, displayValue: string) => {
    // This is a bit tricky; we need to update the bill's amount for calculation,
    // but also keep a local display version for each input if we want live formatting.
    // For simplicity, we'll update the numeric amount and rely on re-render to format display.
    // Or, manage display strings separately. For now, let's just parse and update.
    // The input value prop will be formatCurrency(bill.amount)
    // So, on change, we parse.
    const numericAmount = parseCurrency(displayValue);
    setBills(prevBills =>
      prevBills.map(bill =>
        bill.id === billId ? { ...bill, amount: numericAmount } : bill
      )
    );
  };


  const totalExpenses = useMemo(() => {
    return bills.reduce((total, bill) => total + (bill.amount || 0), 0);
  }, [bills]);

  const remainingBalance = useMemo(() => {
    return income - totalExpenses;
  }, [income, totalExpenses]);

  const expenseRatio = useMemo(() => {
    if (income === 0) return 0;
    return Math.min((totalExpenses / income) * 100, 100);
  }, [income, totalExpenses]);

  const handleGenerateInsights = useCallback(async () => {
    setIsLoadingInsights(true);
    setErrorInsights(null);
    setInsights(null);

    const insightInput: SpendingInsightsInput = {
      income,
      expenses: bills.map(bill => ({ category: bill.name, amount: bill.amount })),
    };

    try {
      const result: SpendingInsightsOutput = await getSpendingInsights(insightInput);
      setInsights(result.insights);
    } catch (error) {
      console.error("Error fetching spending insights:", error);
      const errorMessage = t('toast.insightsFailed.description');
      setErrorInsights(errorMessage);
       toast({
        variant: "destructive",
        title: t('toast.insightsFailed.title'),
        description: errorMessage,
      });
    } finally {
      setIsLoadingInsights(false);
    }
  }, [income, bills, toast, t]);

  const handleAddNewBill = () => {
    const parsedAmount = parseCurrency(newBillAmount);
    if (!newBillName.trim() || parsedAmount <= 0) {
      // Basic validation
      toast({ variant: "destructive", title: t('generic.error'), description: "Please enter a valid bill name and amount." });
      return;
    }
    const newBill: Bill = {
      id: `custom-${Date.now()}`,
      name: newBillName,
      icon: Receipt,
      amount: parsedAmount,
      isCustom: true,
    };
    setBills(prevBills => [...prevBills, newBill]);
    setNewBillName('');
    setNewBillAmount('');
    setIsAddBillModalOpen(false);
  };
  
  if (!isClient) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-56px)] p-4 sm:p-8 bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-foreground">{t('app.loading')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-[calc(100vh-56px)] p-4 sm:p-8 bg-background selection:bg-primary/20">
      <header className="w-full max-w-5xl mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl font-headline">
          {t('home.welcome', { appName: siteConfig.name })}
        </h1>
        <p className="mt-3 text-xl text-muted-foreground font-headline">{t(siteConfig.descriptionKey)}</p>
        <div className="mt-6">
          <Link href="/settings" passHref>
            <Button variant="outline">
              <SettingsIcon className="mr-2 h-4 w-4" />
              {t('home.settingsButton')}
            </Button>
          </Link>
        </div>
      </header>

      <main className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center text-2xl font-headline">
                <DollarSign className="mr-2 h-7 w-7 text-primary" />
                {t('home.incomeCard.title')}
              </CardTitle>
              <CardDescription>{t('home.incomeCard.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Label htmlFor="income" className="text-sm font-medium">{t('home.incomeCard.label')}</Label>
              <Input
                id="income"
                type="text"
                value={localIncomeDisplay}
                onChange={handleIncomeInputChange}
                onBlur={handleIncomeInputBlur}
                placeholder={t('currency.placeholder', { exampleAmount: formatCurrency(3000)})}
                className="mt-1 text-lg"
                aria-label={t('home.incomeCard.label')}
              />
            </CardContent>
          </Card>

          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center text-2xl font-headline">
                <LineChart className="mr-2 h-7 w-7 text-primary" />
                {t('home.billsCard.title')}
              </CardTitle>
              <CardDescription>{t('home.billsCard.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {bills.map(bill => (
                <div key={bill.id} className="flex items-center space-x-3">
                  <bill.icon className="h-6 w-6 text-accent flex-shrink-0" aria-hidden="true" />
                  <Label htmlFor={bill.id} className="flex-1 text-sm font-medium">{bill.name}</Label>
                  <Input
                    id={bill.id}
                    type="text" // For formatted currency
                    value={formatCurrency(bill.amount)} // Display formatted currency
                    onChange={(e) => handleBillAmountDisplayChange(bill.id, e.target.value)}
                    placeholder={formatCurrency(0)}
                    className="w-32 text-right"
                    aria-label={`${bill.name} ${t('home.addBillModal.amountLabel')}`}
                  />
                </div>
              ))}
               <Dialog open={isAddBillModalOpen} onOpenChange={setIsAddBillModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full mt-4">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    {t('home.addBillButton')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('home.addBillModal.title')}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label htmlFor="newBillName">{t('home.addBillModal.nameLabel')}</Label>
                      <Input id="newBillName" value={newBillName} onChange={(e) => setNewBillName(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="newBillAmount">{t('home.addBillModal.amountLabel')}</Label>
                      <Input 
                        id="newBillAmount" 
                        type="text" 
                        value={newBillAmount} 
                        onChange={(e) => setNewBillAmount(e.target.value)} 
                        onBlur={(e) => setNewBillAmount(formatCurrency(parseCurrency(e.target.value)))}
                        placeholder={formatCurrency(0)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddBillModalOpen(false)}>{t('generic.cancel')}</Button>
                    <Button onClick={handleAddNewBill}>{t('home.addBillModal.saveButton')}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="text-2xl font-headline">{t('home.summaryCard.title')}</CardTitle>
              <CardDescription>{t('home.summaryCard.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t('home.summaryCard.totalIncome')}</span>
                <span className="font-semibold text-lg text-primary">{formatCurrency(income)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t('home.summaryCard.totalExpenses')}</span>
                <span className="font-semibold text-lg text-destructive">{formatCurrency(totalExpenses)}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-lg font-medium">{t('home.summaryCard.remainingBalance')}</span>
                <span className={`font-bold text-xl ${remainingBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(remainingBalance)}
                </span>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{t('home.summaryCard.expenseRatio', { ratio: expenseRatio.toFixed(0) })}</Label>
                <Progress value={expenseRatio} className="w-full mt-1 h-3" indicatorClassName={expenseRatio > 80 ? "bg-destructive" : "bg-primary"} />
                 {expenseRatio > 100 && (
                    <p className="text-xs text-destructive mt-1 flex items-center">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {t('home.summaryCard.expensesExceedIncome')}
                    </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center text-2xl font-headline">
                <Brain className="mr-2 h-7 w-7 text-primary" />
                {t('home.insightsCard.title')}
              </CardTitle>
              <CardDescription>{t('home.insightsCard.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingInsights && (
                <div className="flex items-center justify-center p-6">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="ml-3 text-muted-foreground">{t('home.insightsCard.generating')}</p>
                </div>
              )}
              {errorInsights && !isLoadingInsights && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{t('home.insightsCard.errorTitle')}</AlertTitle>
                  <AlertDescription>{errorInsights}</AlertDescription>
                </Alert>
              )}
              {insights && !isLoadingInsights && (
                <div className="p-4 bg-accent/20 rounded-md border border-accent/50">
                  <p className="text-sm whitespace-pre-wrap text-foreground/90">{insights}</p>
                </div>
              )}
              {!insights && !isLoadingInsights && !errorInsights && (
                 <p className="text-sm text-muted-foreground text-center py-4">{t('home.insightsCard.prompt')}</p>
              )}
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleGenerateInsights}
                disabled={isLoadingInsights || income === 0 && bills.every(b => b.amount === 0)}
                className="w-full"
                aria-label={t('home.insightsCard.generateButton')}
              >
                {isLoadingInsights ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Brain className="mr-2 h-4 w-4" />
                )}
                {t('home.insightsCard.generateButton')}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </main>
      <footer className="w-full max-w-5xl mt-12 pt-6 border-t border-border text-center">
        <p className="text-sm text-muted-foreground">
          {t('home.footer.copyright', { year: new Date().getFullYear(), appName: siteConfig.name })}
        </p>
      </footer>
    </div>
  );
}
