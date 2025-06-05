
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PieChart as ChartIcon, Droplet, Zap, Wifi, Home, DollarSign, LineChart, AlertCircle, Loader2, Brain, Settings as SettingsIcon, Receipt, PlusCircle, CalendarDays } from 'lucide-react';
import { BarChart, Pie, PieChart, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import type { Bill, BillConfig, StoredBillData, MonthlyData, AppStorage, Locale } from '@/types';
import { getSpendingInsights } from '@/ai/flows/spending-insights';
import type { SpendingInsightsInput, SpendingInsightsOutput } from '@/ai/flows/spending-insights';
import { siteConfig } from '@/config/site';
import { useToast } from "@/hooks/use-toast";
import { useLocalization } from '@/hooks/use-localization';
import { format, getYear, getMonth, subYears, addYears } from 'date-fns';
import { enUS, ptBR } from 'date-fns/locale';


const LOCAL_STORAGE_KEY = 'billBlissData';

const PREDEFINED_BILLS_CONFIG: BillConfig[] = [
  { id: 'water', nameKey: 'home.bills.water', defaultName: 'Water Bill', icon: Droplet },
  { id: 'electricity', nameKey: 'home.bills.electricity', defaultName: 'Electricity Bill', icon: Zap },
  { id: 'internet', nameKey: 'home.bills.internet', defaultName: 'Internet Bill', icon: Wifi },
  { id: 'rent', nameKey: 'home.bills.rent', defaultName: 'Rent / Mortgage', icon: Home },
];

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
  const [selectedMonth, setSelectedMonth] = useState<number>(getMonth(new Date()) + 1); // 1-12

  const [currentMonthlyData, setCurrentMonthlyData] = useState<MonthlyData | null>(null);
  
  // Derived state for UI: income and bills for the selected period
  const [income, setIncome] = useState<number>(0);
  const [localIncomeDisplay, setLocalIncomeDisplay] = useState('');
  const [bills, setBills] = useState<Bill[]>([]);

  const [insights, setInsights] = useState<string | null>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState<boolean>(false);
  const [errorInsights, setErrorInsights] = useState<string | null>(null);

  const [isAddBillModalOpen, setIsAddBillModalOpen] = useState(false);
  const [newBillName, setNewBillName] = useState('');
  const [newBillAmount, setNewBillAmount] = useState('');
  
  const yearOptions = useMemo(() => generateYearOptions(), []);
  const monthOptions = useMemo(() => generateMonthOptions(t, locale), [t, locale]);


  const mapStoredDataToBills = useCallback((storedBills: StoredBillData[]): Bill[] => {
    return storedBills.map(storedBill => {
      if (storedBill.isCustom) {
        return {
          id: storedBill.id,
          name: storedBill.name || t('home.bills.customBillFallback'),
          icon: Receipt,
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
      return null; 
    }).filter(bill => bill !== null) as Bill[];
  }, [t]);
  
  const initializePredefinedBills = useCallback((): StoredBillData[] => {
    return PREDEFINED_BILLS_CONFIG.map(config => ({
      id: config.id,
      amount: 0,
      isCustom: false,
    }));
  }, []);

  // Load all data from localStorage on client mount
  useEffect(() => {
    setIsClient(true);
    try {
      const storedDataString = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedDataString) {
        const parsedData = JSON.parse(storedDataString);
        const validatedAppStorage: AppStorage = {
          userLocale: (parsedData.userLocale === 'en' || parsedData.userLocale === 'pt') ? parsedData.userLocale : getLocale(),
          defaultIncome: typeof parsedData.defaultIncome === 'number' ? parsedData.defaultIncome : 0,
          allMonthlyData: Array.isArray(parsedData.allMonthlyData) ? parsedData.allMonthlyData : [],
        };
        setAppStorage(validatedAppStorage);
      } else {
        // Initialize AppStorage if nothing is in localStorage
        const initialStorage: AppStorage = {
          userLocale: getLocale(),
          defaultIncome: 0,
          allMonthlyData: [],
        };
        setAppStorage(initialStorage);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialStorage));
      }
    } catch (error) {
      console.error("Failed to load data from localStorage:", error);
      toast({
        variant: "destructive",
        title: t('toast.errorLoadingData.title'),
        description: t('toast.errorLoadingData.description'),
      });
      const fallbackStorage: AppStorage = { userLocale: getLocale(), defaultIncome: 0, allMonthlyData: [] };
      setAppStorage(fallbackStorage);
    }
  }, [toast, t, getLocale]);
  
  // Effect to load/initialize data for the selectedYear and selectedMonth
  useEffect(() => {
    if (!isClient || !appStorage) return; // appStorage.allMonthlyData is guaranteed to be an array if appStorage is truthy

    let monthData = appStorage.allMonthlyData.find(
      (data) => data.year === selectedYear && data.month === selectedMonth
    );

    if (!monthData) {
      // Create new monthly data if it doesn't exist
      monthData = {
        year: selectedYear,
        month: selectedMonth,
        income: appStorage.defaultIncome || 0,
        bills: initializePredefinedBills(),
      };
      // No need to push to appStorage here, will be handled by save logic
    }
    
    setCurrentMonthlyData(monthData);
    setIncome(monthData.income);
    setLocalIncomeDisplay(formatCurrency(monthData.income));
    setBills(mapStoredDataToBills(monthData.bills));
    setInsights(null); // Clear insights when period changes
    setErrorInsights(null);

  }, [isClient, appStorage, selectedYear, selectedMonth, initializePredefinedBills, mapStoredDataToBills, formatCurrency]);

  // Effect to save data to localStorage when currentMonthlyData changes
  useEffect(() => {
    if (!isClient || !appStorage || !currentMonthlyData) return;

    const updatedAllMonthlyData = appStorage.allMonthlyData.filter(
      (data) => !(data.year === currentMonthlyData.year && data.month === currentMonthlyData.month)
    );
    updatedAllMonthlyData.push(currentMonthlyData);

    const newAppStorage: AppStorage = {
      ...appStorage,
      allMonthlyData: updatedAllMonthlyData,
      userLocale: getLocale(), // Ensure locale is up-to-date
    };
    
    setAppStorage(newAppStorage); 
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newAppStorage));

  }, [currentMonthlyData, isClient, getLocale]); 

  // Update currentMonthlyData when income state changes
  useEffect(() => {
    if (currentMonthlyData && currentMonthlyData.income !== income) {
      setCurrentMonthlyData(prev => prev ? { ...prev, income } : null);
    }
  }, [income, currentMonthlyData]); 

  // Update currentMonthlyData when bills state changes
  useEffect(() => {
    if (currentMonthlyData) {
        const storedBillsData: StoredBillData[] = bills.map(bill => ({
          id: bill.id,
          amount: bill.amount,
          name: bill.isCustom ? bill.name : undefined,
          isCustom: bill.isCustom,
        }));
        
        if (JSON.stringify(currentMonthlyData.bills) !== JSON.stringify(storedBillsData)) {
             setCurrentMonthlyData(prev => prev ? { ...prev, bills: storedBillsData } : null);
        }
    }
  }, [bills, currentMonthlyData]); 


  // Update bill names and income display if locale changes (or initial load)
   useEffect(() => {
    if (isClient) {
        setBills(currentBills => currentBills.map(bill => ({
          ...bill,
          name: bill.isCustom ? bill.name : (t(bill.nameKey || '') || PREDEFINED_BILLS_CONFIG.find(pb => pb.id === bill.id)?.defaultName || t('home.bills.customBillFallback'))
        })));
        setLocalIncomeDisplay(formatCurrency(income)); 
        
    }
  }, [t, locale, isClient, formatCurrency, income]);


  const handleIncomeInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLocalIncomeDisplay(event.target.value);
  };

  const handleIncomeInputBlur = () => {
    const numericValue = parseCurrency(localIncomeDisplay);
    setIncome(numericValue); 
    setLocalIncomeDisplay(formatCurrency(numericValue));
  };
  
  const handleBillAmountDisplayChange = (billId: string, displayValue: string) => {
    setBills(prevBills =>
      prevBills.map(bill =>
        bill.id === billId ? { ...bill, amount: parseCurrency(displayValue) } : bill
      )
    );
  };

  const handleBillAmountInputBlur = (billId: string, displayValue: string) => {
    const billToUpdate = bills.find(b => b.id === billId);
    // No explicit re-render trigger needed here, value prop of Input handles it
  };


  const totalExpenses = useMemo(() => {
    return bills.reduce((total, bill) => total + (bill.amount || 0), 0);
  }, [bills]);

  const remainingBalance = useMemo(() => {
    return income - totalExpenses;
  }, [income, totalExpenses]);

  const expenseRatio = useMemo(() => {
    if (income === 0 && totalExpenses === 0) return 0; 
    if (income === 0) return totalExpenses > 0 ? 1000 : 0; 
    return Math.min(Math.max(0, (totalExpenses / income) * 100), 1000); 
  }, [income, totalExpenses]);

  const handleGenerateInsights = useCallback(async () => {
    if (!currentMonthlyData) return;
    setIsLoadingInsights(true);
    setErrorInsights(null);
    setInsights(null);

    const currentLocale = getLocale();
    const languageForAI = currentLocale === 'pt' ? 'Portuguese' : 'English';

    const insightInput: SpendingInsightsInput = {
      income: currentMonthlyData.income,
      expenses: currentMonthlyData.bills.map(b => {
          const billConfig = PREDEFINED_BILLS_CONFIG.find(pbc => pbc.id === b.id);
          const name = b.isCustom ? b.name : (billConfig ? t(billConfig.nameKey) : t('home.bills.customBillFallback'));
          return { category: name || t('home.bills.unknownCategory'), amount: b.amount };
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
  }, [currentMonthlyData, toast, t, getLocale]);

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
    toast({ title: t('home.addBillModal.toast.success.title'), description: t('home.addBillModal.toast.success.description', { billName: newBillName }) });
  };

  const topExpenses = useMemo(() => {
    return [...bills]
      .filter(bill => bill.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);
  }, [bills]);

  const chartData = useMemo(() => {
    return bills
      .filter(bill => bill.amount > 0)
      .map((bill, index) => ({
        name: bill.name,
        value: bill.amount,
        fill: `hsl(var(--chart-${(index % 5) + 1}))`, 
      }));
  }, [bills]);

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {};
    chartData.forEach(item => {
      config[item.name] = {
        label: item.name,
        color: item.fill,
      };
    });
    return config;
  }, [chartData]);
  
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
        <div className="lg:col-span-2 space-y-6"> {/* Bills and Income */}
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center text-2xl font-headline">
                <DollarSign className="mr-2 h-7 w-7 text-primary" />
                {t('home.incomeCard.title')}
              </CardTitle>
              <CardDescription>{t('home.incomeCard.descriptionPeriod', { month: monthOptions.find(m=>m.value === selectedMonth.toString())?.label || '', year: selectedYear.toString() })}</CardDescription>
            </CardHeader>
            <CardContent>
              <Label htmlFor="income" className="text-sm font-medium">{t('home.incomeCard.label')}</Label>
              <Input
                id="income"
                type="text"
                value={localIncomeDisplay}
                onChange={handleIncomeInputChange}
                onBlur={handleIncomeInputBlur}
                placeholder={t('currency.placeholder', { exampleAmount: formatCurrency(appStorage?.defaultIncome || 3000)})}
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
              <CardDescription>{t('home.billsCard.descriptionPeriod', { month: monthOptions.find(m=>m.value === selectedMonth.toString())?.label || '', year: selectedYear.toString() })}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {bills.map(bill => (
                <div key={bill.id} className="flex items-center space-x-3">
                  <bill.icon className="h-6 w-6 text-accent flex-shrink-0" aria-hidden="true" />
                  <Label htmlFor={bill.id} className="flex-1 text-sm font-medium">{bill.name}</Label>
                  <Input
                    id={bill.id}
                    type="text" 
                    value={formatCurrency(bill.amount)} 
                    onChange={(e) => handleBillAmountDisplayChange(bill.id, e.target.value)}
                    onBlur={(e) => handleBillAmountInputBlur(bill.id, e.target.value)}
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

        <div className="space-y-6"> {/* Summary, Chart, Insights */}
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="text-2xl font-headline">{t('home.summaryCard.title')}</CardTitle>
              <CardDescription>{t('home.summaryCard.descriptionPeriod', { month: monthOptions.find(m=>m.value === selectedMonth.toString())?.label || '', year: selectedYear.toString() })}</CardDescription>
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
              {chartData.length > 0 ? (
                <ChartContainer config={chartConfig} className="mx-auto aspect-square h-[250px] w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} labelLine={false} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                      {chartData.map((entry, index) => (
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
                disabled={isLoadingInsights || (income === 0 && bills.every(b => b.amount === 0))}
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
        <p className="text-xs text-muted-foreground/80 mt-1">
          {t('home.footer.poweredByFirebase')}
        </p>
      </footer>
    </div>
  );
}

    