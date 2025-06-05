
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PieChart as ChartIcon, Droplet, Zap, Wifi, Home, DollarSign, LineChart, AlertCircle, Loader2, Brain, Settings as SettingsIcon, Receipt, PlusCircle, CalendarDays, Edit3, Trash2, Landmark, ArrowRightCircle } from 'lucide-react';
import { Pie, PieChart, Cell, Legend, ResponsiveContainer } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import type { Bill, BillConfig, StoredBillData, MonthlyData, AppStorage, Locale, IncomeSource } from '@/types';
import { getSpendingInsights } from '@/ai/flows/spending-insights';
import type { SpendingInsightsInput, SpendingInsightsOutput } from '@/ai/flows/spending-insights';
import { siteConfig } from '@/config/site';
import { useToast } from "@/hooks/use-toast";
import { useLocalization } from '@/hooks/use-localization';
import { format, getYear, getMonth, addMonths } from 'date-fns';
import { enUS, ptBR } from 'date-fns/locale';


const LOCAL_STORAGE_KEY = 'billBlissData';

const PREDEFINED_BILLS_CONFIG: BillConfig[] = [
  { id: 'water', nameKey: 'home.bills.water', defaultName: 'Water Bill', icon: Droplet },
  { id: 'electricity', nameKey: 'home.bills.electricity', defaultName: 'Electricity Bill', icon: Zap },
  { id: 'internet', nameKey: 'home.bills.internet', defaultName: 'Internet Bill', icon: Wifi },
  { id: 'rent', nameKey: 'home.bills.rent', defaultName: 'Rent / Mortgage', icon: Home },
];

// Helper function to convert Bill (UI model) to StoredBillData (storage model)
const billToStoredBill = (bill: Bill): StoredBillData => ({
  id: bill.id,
  amount: bill.amount,
  name: bill.isCustom ? bill.name : undefined, // Only store name for custom bills
  isCustom: !!bill.isCustom, // Ensure boolean
  incomeSourceId: bill.incomeSourceId,
});

const billsToStoredBillsArray = (bills: Bill[]): StoredBillData[] => {
  return bills.map(billToStoredBill);
};


const generateMonthOptions = (t: (key: string) => string, currentLocale: Locale) => {
  const formatPattern = 'LLLL';
  return Array.from({ length: 12 }, (_, i) => {
    const date = new Date(2000, i, 1);
    return {
      value: (i + 1).toString(),
      label: format(date, formatPattern, { locale: currentLocale === 'pt' ? ptBR : enUS }),
    };
  });
};

const generateYearOptions = () => {
  const currentYr = getYear(new Date());
  const years = [];
  for (let i = -5; i <= 1; i++) {
    years.push({ value: (currentYr + i).toString(), label: (currentYr + i).toString() });
  }
  return years;
};

export default function HomePage() {
  const { t, formatCurrency, parseCurrency, getLocale, locale } = useLocalization();
  const { toast } = useToast();

  const [isClient, setIsClient] = useState(false);
  const [appStorage, setAppStorage] = useState<AppStorage | null>(null);

  const [selectedYear, setSelectedYear] = useState<number>(getYear(new Date()));
  const [selectedMonth, setSelectedMonth] = useState<number>(getMonth(new Date()) + 1);

  const [currentMonthlyData, setCurrentMonthlyData] = useState<MonthlyData | null>(null);

  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);

  const [insights, setInsights] = useState<string | null>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState<boolean>(false);
  const [errorInsights, setErrorInsights] = useState<string | null>(null);

  const [isAddBillModalOpen, setIsAddBillModalOpen] = useState(false);
  const [newBillName, setNewBillName] = useState('');
  const [newBillAmount, setNewBillAmount] = useState('');
  const [selectedIncomeSourceForNewBill, setSelectedIncomeSourceForNewBill] = useState<string | undefined>(undefined);

  const [isIncomeSourceModalOpen, setIsIncomeSourceModalOpen] = useState(false);
  const [currentIncomeSource, setCurrentIncomeSource] = useState<IncomeSource | null>(null); // For editing
  const [incomeSourceName, setIncomeSourceName] = useState('');
  const [incomeSourceAmount, setIncomeSourceAmount] = useState('');

  const yearOptions = useMemo(() => generateYearOptions(), []);
  const monthOptions = useMemo(() => generateMonthOptions(t, locale), [t, locale]);


  const mapStoredDataToBills = useCallback((storedBills: StoredBillData[]): Bill[] => {
    return storedBills.map(storedBill => {
      const baseBill = {
        id: storedBill.id,
        amount: storedBill.amount || 0,
        isCustom: storedBill.isCustom,
        incomeSourceId: storedBill.incomeSourceId,
      };
      if (storedBill.isCustom) {
        return {
          ...baseBill,
          name: storedBill.name || t('home.bills.customBillFallback'),
          icon: Receipt,
        };
      }
      const config = PREDEFINED_BILLS_CONFIG.find(pb => pb.id === storedBill.id);
      if (config) {
        return {
          ...baseBill,
          name: t(config.nameKey) || config.defaultName,
          nameKey: config.nameKey,
          icon: config.icon,
        };
      }
      console.warn(`Could not find config for predefined bill ID: ${storedBill.id}`);
      return {
        ...baseBill,
        name: t('home.bills.customBillFallback'),
        icon: Receipt,
        isCustom: true,
      };
    }).filter(bill => bill !== null) as Bill[];
  }, [t]);

  const initializePredefinedBills = useCallback((): StoredBillData[] => {
    return PREDEFINED_BILLS_CONFIG.map(config => ({
      id: config.id,
      amount: 0,
      isCustom: false,
    }));
  }, []);

  useEffect(() => {
    setIsClient(true);
    try {
      const storedDataString = localStorage.getItem(LOCAL_STORAGE_KEY);
      let parsedData;
      if (storedDataString) {
        parsedData = JSON.parse(storedDataString);
      }

      const validatedAppStorage: AppStorage = {
        userLocale: (parsedData?.userLocale === 'en' || parsedData?.userLocale === 'pt') ? parsedData.userLocale : getLocale(),
        defaultIncome: typeof parsedData?.defaultIncome === 'number' ? parsedData.defaultIncome : 0,
        defaultIncomeSourceName: typeof parsedData?.defaultIncomeSourceName === 'string' ? parsedData.defaultIncomeSourceName : '',
        allMonthlyData: Array.isArray(parsedData?.allMonthlyData) ? parsedData.allMonthlyData : [],
      };
      setAppStorage(validatedAppStorage);

      if (!storedDataString) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(validatedAppStorage));
      }

    } catch (error) {
      console.error("Failed to load data from localStorage:", error);
      toast({
        variant: "destructive",
        title: t('toast.errorLoadingData.title'),
        description: t('toast.errorLoadingData.description'),
      });
      const fallbackStorage: AppStorage = {
        userLocale: getLocale(),
        defaultIncome: 0,
        defaultIncomeSourceName: '',
        allMonthlyData: []
      };
      setAppStorage(fallbackStorage);
    }
  }, [toast, t, getLocale]);

  useEffect(() => {
    if (!isClient || !appStorage) return;

    let monthData = appStorage.allMonthlyData.find(
      (data) => data.year === selectedYear && data.month === selectedMonth
    );

    if (!monthData) {
      const primaryIncomeName = appStorage.defaultIncomeSourceName?.trim()
        ? appStorage.defaultIncomeSourceName
        : t('home.incomeSources.defaultPrimaryName');

      monthData = {
        year: selectedYear,
        month: selectedMonth,
        incomeSources: [{
            id: `primary-${selectedYear}-${selectedMonth}-${Date.now()}`, // More unique ID
            name: primaryIncomeName,
            amount: appStorage.defaultIncome || 0
        }],
        bills: initializePredefinedBills(),
      };
    }

    setCurrentMonthlyData(monthData);
    setIncomeSources(monthData.incomeSources || []);
    setBills(mapStoredDataToBills(monthData.bills));
    setInsights(null);
    setErrorInsights(null);

  }, [isClient, appStorage, selectedYear, selectedMonth, initializePredefinedBills, mapStoredDataToBills, t]);


  useEffect(() => {
    if (!isClient || !appStorage || !currentMonthlyData) return;

    const updatedAllMonthlyData = appStorage.allMonthlyData.filter(
      (data) => !(data.year === currentMonthlyData.year && data.month === currentMonthlyData.month)
    );
    updatedAllMonthlyData.push(currentMonthlyData);

    const newAppStorage: AppStorage = {
      ...appStorage,
      allMonthlyData: updatedAllMonthlyData,
      userLocale: getLocale(),
    };

    if (JSON.stringify(appStorage) !== JSON.stringify(newAppStorage)) {
      setAppStorage(newAppStorage);
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newAppStorage));

  }, [currentMonthlyData, isClient, getLocale, appStorage]);

   useEffect(() => {
    if (isClient && bills.length > 0) {
        setBills(currentBills => currentBills.map(bill => ({
          ...bill,
          name: bill.isCustom ? bill.name : (t(bill.nameKey || '') || PREDEFINED_BILLS_CONFIG.find(pb => pb.id === bill.id)?.defaultName || t('home.bills.customBillFallback'))
        })));
    }
  }, [t, locale, isClient]);

  const handleBillAmountDisplayChange = (billId: string, displayValue: string) => {
    const newAmount = parseCurrency(displayValue);
    const updatedBills = bills.map(bill =>
      bill.id === billId ? { ...bill, amount: newAmount } : bill
    );
    setBills(updatedBills);
    setCurrentMonthlyData(prev => prev ? { ...prev, bills: billsToStoredBillsArray(updatedBills) } : null);
  };

  const handleBillIncomeSourceChange = (billId: string, sourceId: string) => {
    const updatedBills = bills.map(bill =>
      bill.id === billId ? { ...bill, incomeSourceId: sourceId === "unassigned" ? undefined : sourceId } : bill
    );
    setBills(updatedBills);
    setCurrentMonthlyData(prev => prev ? { ...prev, bills: billsToStoredBillsArray(updatedBills) } : null);
  };

  const totalIncome = useMemo(() => {
    return incomeSources.reduce((total, source) => total + (source.amount || 0), 0);
  }, [incomeSources]);

  const totalExpenses = useMemo(() => {
    return bills.reduce((total, bill) => total + (bill.amount || 0), 0);
  }, [bills]);

  const remainingBalance = useMemo(() => {
    return totalIncome - totalExpenses;
  }, [totalIncome, totalExpenses]);

  const expenseRatio = useMemo(() => {
    if (totalIncome === 0 && totalExpenses === 0) return 0;
    if (totalIncome === 0) return totalExpenses > 0 ? 1000 : 0;
    return Math.min(Math.max(0, (totalExpenses / totalIncome) * 100), 1000);
  }, [totalIncome, totalExpenses]);

  const handleGenerateInsights = useCallback(async () => {
    if (!currentMonthlyData) return;
    setIsLoadingInsights(true);
    setErrorInsights(null);
    setInsights(null);

    const currentLocale = getLocale();
    const languageForAI = currentLocale === 'pt' ? 'Portuguese' : 'English';

    const totalIncomeForAI = currentMonthlyData.incomeSources.reduce((sum, source) => sum + source.amount, 0);

    const insightInput: SpendingInsightsInput = {
      incomeSources: currentMonthlyData.incomeSources.map(s => ({name: s.name, amount: s.amount })),
      totalIncome: totalIncomeForAI,
      expenses: currentMonthlyData.bills.map(b => {
          const uiBill = bills.find(ui_b => ui_b.id === b.id);
          const name = uiBill ? uiBill.name : (b.isCustom ? b.name : t('home.bills.customBillFallback'));
          const paidBySource = currentMonthlyData.incomeSources.find(src => src.id === b.incomeSourceId);
          return {
            category: name || t('home.bills.unknownCategory'),
            amount: b.amount,
            paidBy: paidBySource?.name
          };
      }),
      language: languageForAI,
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
  }, [currentMonthlyData, toast, t, getLocale, bills]);

  const handleAddNewBill = () => {
    const parsedAmount = parseCurrency(newBillAmount);
    if (!newBillName.trim()) {
      toast({ variant: "destructive", title: t('generic.error'), description: t('home.addBillModal.validation.nameRequired') });
      return;
    }
    if (parsedAmount <= 0) {
      toast({ variant: "destructive", title: t('generic.error'), description: t('home.addBillModal.validation.amountRequired') });
      return;
    }

    const newBillEntry: Bill = {
      id: `custom-${Date.now()}`,
      name: newBillName,
      icon: Receipt,
      amount: parsedAmount,
      isCustom: true,
      incomeSourceId: selectedIncomeSourceForNewBill === "unassigned" ? undefined : selectedIncomeSourceForNewBill,
    };

    const updatedBills = [...bills, newBillEntry];
    setBills(updatedBills);
    setCurrentMonthlyData(prev => prev ? { ...prev, bills: billsToStoredBillsArray(updatedBills) } : null);

    setNewBillName('');
    setNewBillAmount('');
    setSelectedIncomeSourceForNewBill(undefined);
    setIsAddBillModalOpen(false);
    toast({ title: t('home.addBillModal.toast.success.title'), description: t('home.addBillModal.toast.success.description', { billName: newBillEntry.name }) });
  };

  const openIncomeSourceModal = (source: IncomeSource | null) => {
    setCurrentIncomeSource(source);
    if (source) {
      setIncomeSourceName(source.name);
      setIncomeSourceAmount(formatCurrency(source.amount));
    } else {
      setIncomeSourceName('');
      setIncomeSourceAmount('');
    }
    setIsIncomeSourceModalOpen(true);
  };

  const handleSaveIncomeSource = () => {
    const parsedAmount = parseCurrency(incomeSourceAmount);
    if (!incomeSourceName.trim()) {
      toast({ variant: "destructive", title: t('generic.error'), description: t('home.incomeSources.dialog.nameLabel') + ' ' + t('home.addBillModal.validation.nameRequired') });
      return;
    }
    if (parsedAmount < 0) {
      toast({ variant: "destructive", title: t('generic.error'), description: t('home.incomeSources.dialog.amountLabel') + ' ' + t('home.addBillModal.validation.amountRequired') });
      return;
    }

    let updatedIncomeSources;
    if (currentIncomeSource) {
      updatedIncomeSources = incomeSources.map(s => s.id === currentIncomeSource.id ? { ...s, name: incomeSourceName, amount: parsedAmount } : s);
      toast({ title: t('home.incomeSources.toast.updated.title'), description: t('home.incomeSources.toast.updated.description', { sourceName: incomeSourceName })});
    } else {
      const newSource: IncomeSource = {
        id: `income-${Date.now()}`,
        name: incomeSourceName,
        amount: parsedAmount,
      };
      updatedIncomeSources = [...incomeSources, newSource];
      toast({ title: t('home.incomeSources.toast.added.title'), description: t('home.incomeSources.toast.added.description', { sourceName: incomeSourceName }) });
    }
    setIncomeSources(updatedIncomeSources);
    setCurrentMonthlyData(prev => prev ? { ...prev, incomeSources: updatedIncomeSources } : null);
    setIsIncomeSourceModalOpen(false);
  };

  const handleDeleteIncomeSource = (sourceId: string) => {
    const sourceToDelete = incomeSources.find(s => s.id === sourceId);
    if (!sourceToDelete) return;

    const updatedIncomeSources = incomeSources.filter(s => s.id !== sourceId);
    setIncomeSources(updatedIncomeSources);

    const updatedBills = bills.map(b => b.incomeSourceId === sourceId ? { ...b, incomeSourceId: undefined } : b);
    setBills(updatedBills);

    setCurrentMonthlyData(prev => prev ? {
      ...prev,
      incomeSources: updatedIncomeSources,
      bills: billsToStoredBillsArray(updatedBills)
    } : null);

    toast({ title: t('home.incomeSources.toast.deleted.title'), description: t('home.incomeSources.toast.deleted.description', { sourceName: sourceToDelete.name}) });
  };

  const handleReplicateBill = useCallback((billToReplicate: Bill) => {
    if (!appStorage) return;

    const currentMonthDate = new Date(selectedYear, selectedMonth - 1, 1);
    const nextMonthDate = addMonths(currentMonthDate, 1);
    const nextMonth = getMonth(nextMonthDate) + 1;
    const nextYear = getYear(nextMonthDate);

    let nextMonthData = appStorage.allMonthlyData.find(d => d.year === nextYear && d.month === nextMonth);
    const newAllMonthlyData = [...appStorage.allMonthlyData];

    const replicatedStoredBill = billToStoredBill(billToReplicate);

    if (nextMonthData) {
      // Check if bill already exists (by ID) to avoid duplicates, or update if desired (here we add, could update)
      const billExists = nextMonthData.bills.some(b => b.id === replicatedStoredBill.id);
      if (!billExists) {
         nextMonthData.bills.push(replicatedStoredBill);
      } else {
        // Optionally update existing bill or notify user
        nextMonthData.bills = nextMonthData.bills.map(b => b.id === replicatedStoredBill.id ? replicatedStoredBill : b);
      }
    } else {
      const primaryIncomeName = appStorage.defaultIncomeSourceName?.trim()
        ? appStorage.defaultIncomeSourceName
        : t('home.incomeSources.defaultPrimaryName');
      nextMonthData = {
        year: nextYear,
        month: nextMonth,
        incomeSources: [{
          id: `primary-${nextYear}-${nextMonth}-${Date.now()}`,
          name: primaryIncomeName,
          amount: appStorage.defaultIncome || 0
        }],
        bills: [...initializePredefinedBills(), replicatedStoredBill], // Add predefined and then the replicated one
      };
      newAllMonthlyData.push(nextMonthData);
    }

    const updatedAppStorage: AppStorage = {
      ...appStorage,
      allMonthlyData: newAllMonthlyData.map(d => (d.year === nextYear && d.month === nextMonth) ? nextMonthData! : d),
    };

    setAppStorage(updatedAppStorage);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedAppStorage));

    const nextMonthFormatted = format(nextMonthDate, 'LLLL', { locale: locale === 'pt' ? ptBR : enUS });
    toast({
      title: t('home.bills.toast.replicated.title'),
      description: t('home.bills.toast.replicated.description', { billName: billToReplicate.name, nextMonth: nextMonthFormatted, nextYear: nextYear.toString() }),
    });

  }, [appStorage, selectedYear, selectedMonth, t, locale, initializePredefinedBills, toast]);


  const topExpenses = useMemo(() => {
    return [...bills]
      .filter(bill => bill.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);
  }, [bills]);

  const expenseChartData = useMemo(() => {
    return bills
      .filter(bill => bill.amount > 0)
      .map((bill, index) => ({
        name: bill.name,
        value: bill.amount,
        fill: `hsl(var(--chart-${(index % 5) + 1}))`,
      }));
  }, [bills]);

  const expenseChartConfig = useMemo(() => {
    const config: ChartConfig = {};
    expenseChartData.forEach(item => {
      config[item.name] = {
        label: item.name,
        color: item.fill,
      };
    });
    return config;
  }, [expenseChartData]);

  const incomeContributionChartData = useMemo(() => {
    const contributions: Record<string, { name: string; value: number; incomeSourceName: string }> = {};
    bills.forEach(bill => {
      if (bill.incomeSourceId && bill.amount > 0) {
        const source = incomeSources.find(s => s.id === bill.incomeSourceId);
        if (source) {
          if (!contributions[source.id]) {
            contributions[source.id] = { name: source.name, value: 0, incomeSourceName: source.name };
          }
          contributions[source.id].value += bill.amount;
        }
      }
    });
    return Object.values(contributions).map((item, index) => ({
      ...item,
      fill: `hsl(var(--chart-${(index % 5) + 1}))`,
    }));
  }, [bills, incomeSources]);

  const incomeContributionChartConfig = useMemo(() => {
    const config: ChartConfig = {};
    incomeContributionChartData.forEach(item => {
      config[item.incomeSourceName] = {
        label: item.name,
        color: item.fill,
      };
    });
    return config;
  }, [incomeContributionChartData]);

  if (!isClient || !appStorage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height,56px))] p-4 sm:p-8 bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-foreground">{t('app.loading')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-[calc(100vh-var(--header-height,56px))] p-4 sm:p-8 bg-background selection:bg-primary/20">
      <header className="w-full max-w-5xl mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl font-headline">
          {t('home.welcome', { appName: siteConfig.name })}
        </h1>
        <p className="mt-3 text-xl text-muted-foreground font-headline">{t(siteConfig.descriptionKey)}</p>
        <div className="mt-6 flex flex-col sm:flex-row justify-center items-center gap-4">
          <div className="flex gap-2 items-center">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={t('home.monthYearSelector.monthPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder={t('home.monthYearSelector.yearPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Link href="/settings" passHref>
            <Button variant="outline">
              <SettingsIcon className="mr-2 h-4 w-4" />
              {t('home.settingsButton')}
            </Button>
          </Link>
        </div>
      </header>

      <main className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Income Sources Card */}
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center text-2xl font-headline">
                <Landmark className="mr-2 h-7 w-7 text-primary" />
                {t('home.incomeSourcesCard.title')}
              </CardTitle>
              <CardDescription>{t('home.incomeSourcesCard.descriptionPeriod', { month: monthOptions.find(m=>m.value === selectedMonth.toString())?.label || '', year: selectedYear.toString() })}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {incomeSources.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">{t('home.incomeSources.noSources')}</p>
              )}
              {incomeSources.map(source => (
                <div key={source.id} className="flex items-center justify-between p-3 border rounded-md bg-card/50 hover:bg-card/80">
                  <div className="flex-1">
                    <p className="font-medium text-card-foreground">{source.name}</p>
                    <p className="text-sm text-primary">{formatCurrency(source.amount)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openIncomeSourceModal(source)} aria-label={t('generic.edit')}>
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/90 hover:bg-destructive/10" aria-label={t('generic.delete')}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('home.incomeSources.deleteConfirm.title')}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t('home.incomeSources.deleteConfirm.description', { sourceName: source.name })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('generic.cancel')}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteIncomeSource(source.id)} className="bg-destructive hover:bg-destructive/90">
                            {t('generic.delete')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" onClick={() => openIncomeSourceModal(null)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                {t('home.incomeSourcesCard.addSourceButton')}
              </Button>
            </CardFooter>
          </Card>

          {/* Bills Card */}
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center text-2xl font-headline">
                <LineChart className="mr-2 h-7 w-7 text-primary" />
                {t('home.billsCard.title')}
              </CardTitle>
              <CardDescription>{t('home.billsCard.descriptionPeriod', { month: monthOptions.find(m=>m.value === selectedMonth.toString())?.label || '', year: selectedYear.toString() })}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {bills.map(bill => (
                <div key={bill.id} className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-x-3 gap-y-1 p-2 border-b last:border-b-0">
                  <bill.icon className="h-6 w-6 text-accent flex-shrink-0 row-span-2" aria-hidden="true" />
                  <Label htmlFor={`bill-name-${bill.id}`} className="flex-1 text-sm font-medium col-span-2">{bill.name}</Label>
                   <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleReplicateBill(bill)}
                      aria-label={t('home.bills.replicateBillLabel')}
                      className="row-start-1 col-start-3 justify-self-end"
                    >
                      <ArrowRightCircle className="h-4 w-4" />
                    </Button>
                  <Input
                    id={`bill-amount-${bill.id}`}
                    type="text"
                    value={formatCurrency(bill.amount)}
                    onChange={(e) => handleBillAmountDisplayChange(bill.id, e.target.value)}
                    placeholder={formatCurrency(0)}
                    className="w-28 text-right row-start-1 col-start-4"
                    aria-label={`${bill.name} ${t('home.addBillModal.amountLabel')}`}
                  />
                  <Label htmlFor={`bill-source-${bill.id}`} className="text-xs text-muted-foreground col-start-2">{t('home.bills.assignIncomeSourceLabel')}:</Label>
                  <Select
                    value={bill.incomeSourceId || "unassigned"}
                    onValueChange={(value) => handleBillIncomeSourceChange(bill.id, value)}
                  >
                    <SelectTrigger id={`bill-source-${bill.id}`} className="w-full col-start-3 col-span-2 text-xs h-8"> {/* Adjusted col-span */}
                       <SelectValue placeholder={t('home.bills.unassignedIncomeSource')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">{t('home.bills.unassignedIncomeSource')}</SelectItem>
                      {incomeSources.length > 0 ? (
                        incomeSources.map(source => (
                          <SelectItem key={source.id} value={source.id}>{source.name}</SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-sources" disabled>{t('home.bills.noIncomeSourcesAvailable')}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
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
                      <Input
                        id="newBillName"
                        value={newBillName}
                        onChange={(e) => setNewBillName(e.target.value)}
                        placeholder={t('home.addBillModal.namePlaceholder')}
                        />
                    </div>
                    <div>
                      <Label htmlFor="newBillAmount">{t('home.addBillModal.amountLabel')}</Label>
                      <Input
                        id="newBillAmount"
                        type="text"
                        value={newBillAmount}
                        onChange={(e) => setNewBillAmount(e.target.value)}
                        onBlur={(e) => {
                            const numericValue = parseCurrency(e.target.value);
                            setNewBillAmount(formatCurrency(numericValue));
                        }}
                        placeholder={formatCurrency(0)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="newBillIncomeSource">{t('home.bills.assignIncomeSourceLabel')}</Label>
                      <Select
                        value={selectedIncomeSourceForNewBill}
                        onValueChange={setSelectedIncomeSourceForNewBill}
                        >
                        <SelectTrigger id="newBillIncomeSource">
                          <SelectValue placeholder={t('home.bills.unassignedIncomeSource')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">{t('home.bills.unassignedIncomeSource')}</SelectItem>
                          {incomeSources.map(source => (
                            <SelectItem key={source.id} value={source.id}>{source.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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

        <div className="space-y-6"> {/* Summary, Charts, Insights */}
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="text-2xl font-headline">{t('home.summaryCard.title')}</CardTitle>
              <CardDescription>{t('home.summaryCard.descriptionPeriod', { month: monthOptions.find(m=>m.value === selectedMonth.toString())?.label || '', year: selectedYear.toString() })}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t('home.summaryCard.totalIncome')}</span>
                <span className="font-semibold text-lg text-primary">{formatCurrency(totalIncome)}</span>
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
                <Label className="text-xs text-muted-foreground">{t('home.summaryCard.expenseRatio', { ratio: expenseRatio > 1000 ? ">1000" : expenseRatio.toFixed(0) })}</Label>
                <Progress value={Math.min(expenseRatio, 100)} className="w-full mt-1 h-3" indicatorClassName={expenseRatio > 80 ? "bg-destructive" : "bg-primary"} />
                 {expenseRatio > 100 && (
                    <p className="text-xs text-destructive mt-1 flex items-center">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {t('home.summaryCard.expensesExceedIncome')}
                    </p>
                )}
              </div>
              {topExpenses.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium mb-2">{t('home.summaryCard.topExpensesTitle')}</h4>
                    <ul className="space-y-1">
                      {topExpenses.map(expense => (
                        <li key={expense.id} className="flex justify-between text-xs">
                          <span>{expense.name}</span>
                          <span className="font-medium">{formatCurrency(expense.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center text-2xl font-headline">
                <ChartIcon className="mr-2 h-7 w-7 text-primary" />
                {t('home.chartCard.title')}
              </CardTitle>
              <CardDescription>{t('home.chartCard.descriptionPeriod', { month: monthOptions.find(m=>m.value === selectedMonth.toString())?.label || '', year: selectedYear.toString() })}</CardDescription>
            </CardHeader>
            <CardContent>
              {expenseChartData.length > 0 ? (
                <ChartContainer config={expenseChartConfig} className="mx-auto aspect-square h-[250px] w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <Pie data={expenseChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} labelLine={false} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                      {expenseChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                  </PieChart>
                </ChartContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-10">{t('home.chartCard.noData')}</p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center text-2xl font-headline">
                <DollarSign className="mr-2 h-7 w-7 text-primary" />
                {t('home.incomeContributionChart.title')}
              </CardTitle>
              <CardDescription>{t('home.incomeContributionChart.descriptionPeriod', { month: monthOptions.find(m=>m.value === selectedMonth.toString())?.label || '', year: selectedYear.toString() })}</CardDescription>
            </CardHeader>
            <CardContent>
              {incomeContributionChartData.length > 0 ? (
                 <ChartContainer config={incomeContributionChartConfig} className="mx-auto aspect-square h-[250px] w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                    <Pie data={incomeContributionChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} labelLine={false} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                      {incomeContributionChartData.map((entry, index) => (
                        <Cell key={`cell-income-contrib-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                  </PieChart>
                </ChartContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-10">{t('home.incomeContributionChart.noData')}</p>
              )}
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
                disabled={isLoadingInsights || (totalIncome === 0 && bills.every(b => b.amount === 0))}
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

      {/* Income Source Modal */}
      <Dialog open={isIncomeSourceModalOpen} onOpenChange={setIsIncomeSourceModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentIncomeSource ? t('home.incomeSources.dialog.editTitle') : t('home.incomeSources.dialog.addTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="incomeSourceName">{t('home.incomeSources.dialog.nameLabel')}</Label>
              <Input
                id="incomeSourceName"
                value={incomeSourceName}
                onChange={(e) => setIncomeSourceName(e.target.value)}
                placeholder={t('home.incomeSources.dialog.namePlaceholder')}
              />
            </div>
            <div>
              <Label htmlFor="incomeSourceAmount">{t('home.incomeSources.dialog.amountLabel')}</Label>
              <Input
                id="incomeSourceAmount"
                type="text"
                value={incomeSourceAmount}
                onChange={(e) => setIncomeSourceAmount(e.target.value)}
                onBlur={(e) => {
                    const numericValue = parseCurrency(e.target.value);
                    setIncomeSourceAmount(formatCurrency(numericValue));
                }}
                placeholder={formatCurrency(0)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsIncomeSourceModalOpen(false)}>{t('generic.cancel')}</Button>
            <Button onClick={handleSaveIncomeSource}>{t('home.incomeSources.dialog.saveButton')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <footer className="w-full max-w-5xl mt-12 pt-6 border-t border-border text-center">
        <p className="text-sm text-muted-foreground">
          {t('home.footer.copyright', { year: new Date().getFullYear(), appName: siteConfig.name })}
        </p>
        <p className="text-xs text-muted-foreground/80 mt-1">
          {t('home.footer.poweredByFirebase')}
        </p>
      </footer>
    </div>
  );
}
