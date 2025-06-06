
'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link'; // Keep for potential future use, not directly used now
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PieChart as ChartIcon, Droplet, Zap, Wifi, Home, DollarSign, LineChart, AlertCircle, Loader2, Brain, Receipt, PlusCircle, CalendarDays, Edit3, Trash2, Landmark, ArrowRightCircle } from 'lucide-react';
import { Pie, PieChart, Cell, ResponsiveContainer } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import type { Bill, BillConfig, StoredBillData, MonthlyData, Locale, IncomeSource, UserJWTPayload, UserSettings } from '@/types';
import { getSpendingInsights } from '@/ai/flows/spending-insights';
import type { SpendingInsightsInput, SpendingInsightsOutput } from '@/ai/flows/spending-insights';
import { siteConfig } from '@/config/site';
import { useToast } from "@/hooks/use-toast";
import { useLocalization } from '@/hooks/use-localization';
import { format, getYear, getMonth, addMonths } from 'date-fns';
import { enUS, ptBR } from 'date-fns/locale';
import { getMonthlyData, saveMonthlyData } from '@/actions/financial-data';
import { getUserSession } from '@/actions/auth';
import { getUserSettings } from '@/actions/user-settings';

const DEFAULT_LOCALE_PAGE: Locale = 'en';

const PREDEFINED_BILLS_CONFIG: BillConfig[] = [
  { id: 'water', nameKey: 'home.bills.water', defaultName: 'Water Bill', icon: Droplet },
  { id: 'electricity', nameKey: 'home.bills.electricity', defaultName: 'Electricity Bill', icon: Zap },
  { id: 'internet', nameKey: 'home.bills.internet', defaultName: 'Internet Bill', icon: Wifi },
  { id: 'rent', nameKey: 'home.bills.rent', defaultName: 'Rent / Mortgage', icon: Home },
];

const billToStoredBill = (bill: Bill): StoredBillData => ({
  id: bill.id,
  amount: bill.amount,
  name: bill.isCustom ? bill.name : undefined,
  nameKey: !bill.isCustom ? bill.nameKey : undefined,
  isCustom: !!bill.isCustom,
  incomeSourceId: bill.incomeSourceId,
});

const billsToStoredBillsArray = (bills: Bill[]): StoredBillData[] => {
  return bills.map(billToStoredBill);
};

const generateMonthOptions = (t: (key: string) => string, currentLocale: Locale) => {
  const formatPattern = 'LLLL';
  const dateFnsLocale = currentLocale === 'pt' ? ptBR : enUS;
  return Array.from({ length: 12 }, (_, i) => {
    const date = new Date(2000, i, 1);
    return {
      value: (i + 1).toString(),
      label: format(date, formatPattern, { locale: dateFnsLocale }),
    };
  });
};

const generateYearOptions = () => {
  const currentYr = getYear(new Date()); // Use current year for range generation, even if selectedYear is null initially
  const years = [];
  for (let i = -5; i <= 1; i++) {
    years.push({ value: (currentYr + i).toString(), label: (currentYr + i).toString() });
  }
  return years;
};


export default function HomePage() {
  const { t, formatCurrency, parseCurrency, getLocale, locale, setLocale } = useLocalization();
  const { toast } = useToast();
  const router = useRouter();

  const [session, setSession] = useState<UserJWTPayload | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  
  const [isClient, setIsClient] = useState(false);
  
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const [currentMonthlyData, setCurrentMonthlyData] = useState<MonthlyData | null>(null);
  const [isLoadingMonthlyData, setIsLoadingMonthlyData] = useState<boolean>(true);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);


  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);

  const [insights, setInsights] = useState<string | null>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState<boolean>(false);
  const [errorInsights, setErrorInsights] = useState<string | null>(null);

  const [isAddBillModalOpen, setIsAddBillModalOpen] = useState(false);
  const [newBillName, setNewBillName] = useState('');
  const [newBillAmountRaw, setNewBillAmountRaw] = useState('');
  const [newBillIcon, setNewBillIcon] = useState<React.ElementType>(Receipt);
  const [newBillIsCustom, setNewBillIsCustom] = useState(true);
  const [newBillPredefinedId, setNewBillPredefinedId] = useState<string | null>(null);
  const [selectedIncomeSourceForNewBill, setSelectedIncomeSourceForNewBill] = useState<string | undefined>(undefined);

  const [isIncomeSourceModalOpen, setIsIncomeSourceModalOpen] = useState(false);
  const [currentIncomeSource, setCurrentIncomeSource] = useState<IncomeSource | null>(null);
  const [incomeSourceName, setIncomeSourceName] = useState('');
  const [incomeSourceAmountRaw, setIncomeSourceAmountRaw] = useState('');
  
  const dataSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Set initial selectedYear and selectedMonth on client mount
  useEffect(() => {
    if (isClient) {
      setSelectedYear(getYear(new Date()));
      setSelectedMonth(getMonth(new Date()) + 1);
    }
  }, [isClient]);

  // Load session and user settings
  useEffect(() => {
    if (!isClient) return;

    const loadAuthData = async () => {
      setIsLoadingAuth(true);
      const currentSession = await getUserSession();
      if (!currentSession) {
        router.push('/login?next=/');
        return;
      }
      setSession(currentSession);
      
      try {
        const settings = await getUserSettings(currentSession.userId);
        setUserSettings(settings);
        if (settings?.userLocale && settings.userLocale !== locale) { 
          setLocale(settings.userLocale); 
        }
      } catch (error) {
        console.error("Failed to load user settings in HomePage:", error);
        toast({ variant: "destructive", title: t('toast.errorLoadingSettings.title'), description: (error as Error).message });
        setUserSettings({ userId: currentSession.userId, userLocale: locale, defaultIncome: 0, defaultIncomeSourceName: '' });
      } finally {
        setIsLoadingAuth(false);
      }
    };
    loadAuthData();
  }, [isClient, router, toast, setLocale, locale]);


  const yearOptions = useMemo(() => generateYearOptions(), []);
  const monthOptions = useMemo(() => generateMonthOptions(t, locale), [t, locale]);
  
  const getDecimalSeparator = useCallback(() => (locale === 'pt' ? ',' : '.'), [locale]);

  const sanitizeNumericInput = useCallback((value: string) => {
    const decimalSeparator = getDecimalSeparator();
    if (value === decimalSeparator) return value; 

    const regex = new RegExp(`[^0-9${decimalSeparator === '.' ? '\\.' : decimalSeparator}]`, 'g');
    let sanitized = value.replace(regex, '');
  
    const parts = sanitized.split(decimalSeparator);
    if (parts.length > 2) {
      sanitized = parts[0] + decimalSeparator + parts.slice(1).join('');
    }
     if (sanitized.length > 1 && sanitized.startsWith('0') && sanitized[1] !== decimalSeparator) {
        sanitized = sanitized.substring(1);
        while (sanitized.length > 1 && sanitized.startsWith('0') && sanitized[1] !== decimalSeparator) {
            sanitized = sanitized.substring(1);
        }
    }
    if (/^0+$/.test(sanitized) && sanitized.length > 1) {
        sanitized = "0";
    }
    return sanitized;
  }, [getDecimalSeparator]);
  

  const mapStoredDataToBills = useCallback((storedBills: StoredBillData[]): Bill[] => {
    const mapped = storedBills.map(storedBill => {
      const amount = storedBill.amount || 0;
      const baseBill = {
        id: storedBill.id,
        amount: amount,
        isCustom: storedBill.isCustom,
        incomeSourceId: storedBill.incomeSourceId,
        rawAmountDisplay: formatCurrency(amount) 
      };
      if (storedBill.isCustom) {
        return {
          ...baseBill,
          name: storedBill.name || t('home.bills.customBillFallback'),
          icon: Receipt, 
        };
      }
      const config = PREDEFINED_BILLS_CONFIG.find(pb => pb.id === storedBill.id || pb.id === storedBill.nameKey);
      if (config) {
        return {
          ...baseBill,
          name: t(config.nameKey) || config.defaultName,
          nameKey: config.nameKey,
          icon: config.icon,
        };
      }
      return {
        ...baseBill,
        name: storedBill.name || t('home.bills.customBillFallback'),
        icon: Receipt,
        isCustom: true, 
      };
    }).filter(bill => bill !== null) as Bill[];
    return Array.from(new Map(mapped.map(item => [item.id, item])).values());
  }, [t, formatCurrency]);

 // Effect to load or initialize monthly data from MongoDB
useEffect(() => {
    if (!isClient || !session?.userId || !userSettings || isLoadingAuth || selectedYear === null || selectedMonth === null) return;
    setIsLoadingMonthlyData(true);

    async function loadData() {
      try {
        let existingMonthData = await getMonthlyData(session!.userId, selectedYear!, selectedMonth!);
        let finalMonthData: MonthlyData;

        if (existingMonthData) {
          const resolvedIncomeSources = Array.isArray(existingMonthData.incomeSources) ? existingMonthData.incomeSources : [];
          const resolvedStoredBills = Array.isArray(existingMonthData.bills) ? existingMonthData.bills : [];
          
          const primaryIncomeNameFromSettings = userSettings.defaultIncomeSourceName?.trim()
            ? userSettings.defaultIncomeSourceName
            : t('home.incomeSources.defaultPrimaryName');
          
          let primarySource = resolvedIncomeSources.find(s => s.id.startsWith('primary-'));

          if (!primarySource) {
            primarySource = {
              id: `primary-${selectedYear}-${selectedMonth}-${Date.now()}`,
              name: primaryIncomeNameFromSettings,
              amount: userSettings.defaultIncome || 0,
            };
            resolvedIncomeSources.unshift(primarySource);
          } else {
             if (primarySource.name === 'Primary Income' || primarySource.name === t('home.incomeSources.defaultPrimaryName', undefined, {locale: 'en'}) || primarySource.name === t('home.incomeSources.defaultPrimaryName', undefined, {locale: 'pt'})) {
                primarySource.name = primaryIncomeNameFromSettings;
            }
            if (primarySource.amount === 0 && (userSettings.defaultIncome || 0) > 0) {
                primarySource.amount = userSettings.defaultIncome || 0;
            }
          }
          
          const uniqueIncomeSources = Array.from(new Map(resolvedIncomeSources.map(item => [item.id, item])).values());
          const uniqueStoredBills = Array.from(new Map(resolvedStoredBills.map(item => [item.id, item])).values());

          finalMonthData = {
            ...existingMonthData,
            userId: session!.userId,
            incomeSources: uniqueIncomeSources,
            bills: uniqueStoredBills,
          };

        } else {
          const primaryIncomeName = userSettings.defaultIncomeSourceName?.trim()
            ? userSettings.defaultIncomeSourceName
            : t('home.incomeSources.defaultPrimaryName');
          
          const initialIncomeSources: IncomeSource[] = [{
            id: `primary-${selectedYear}-${selectedMonth}-${Date.now()}`,
            name: primaryIncomeName,
            amount: userSettings.defaultIncome || 0
          }];
          
          finalMonthData = {
            userId: session!.userId,
            year: selectedYear!,
            month: selectedMonth!,
            incomeSources: initialIncomeSources,
            bills: [], 
          };
          const saved = await saveMonthlyData(finalMonthData);
          finalMonthData = saved; 
        }
        
        setCurrentMonthlyData(finalMonthData);
        setIncomeSources(finalMonthData.incomeSources || []);
        setBills(mapStoredDataToBills(finalMonthData.bills || []));
        setInsights(null);
        setErrorInsights(null);

      } catch (error) {
        console.error("Error in data loading/initialization:", error);
        toast({ variant: "destructive", title: t('toast.errorLoadingData.title'), description: (error as Error).message });
        const primaryIncomeName = userSettings.defaultIncomeSourceName?.trim()
            ? userSettings.defaultIncomeSourceName
            : t('home.incomeSources.defaultPrimaryName');
        
        const fallbackIncomeSources = [{id: `primary-${selectedYear}-${selectedMonth}-${Date.now()}`, name: primaryIncomeName, amount: userSettings.defaultIncome || 0}];
        setCurrentMonthlyData({
            userId: session!.userId,
            year: selectedYear!, month: selectedMonth!, 
            incomeSources: fallbackIncomeSources, 
            bills: []
        });
        setIncomeSources(fallbackIncomeSources);
        setBills([]);
      } finally {
        setIsLoadingMonthlyData(false);
      }
    }
    loadData();
  }, [isClient, session, userSettings, selectedYear, selectedMonth, t, mapStoredDataToBills, toast, isLoadingAuth]);


  // Debounced save to MongoDB
  const scheduleSaveToDb = useCallback(() => {
    if (dataSaveTimeoutRef.current) {
      clearTimeout(dataSaveTimeoutRef.current);
    }
    dataSaveTimeoutRef.current = setTimeout(async () => {
      if (currentMonthlyData && session?.userId) { 
        try {
          const dataToSave: MonthlyData = {
            ...currentMonthlyData,
            userId: session.userId, 
            incomeSources: incomeSources, 
            bills: billsToStoredBillsArray(bills.map(b => ({...b, amount: b.amount || 0}))),
          };
          const saved = await saveMonthlyData(dataToSave);
          setCurrentMonthlyData(saved); 
        } catch (error) {
          console.error("Failed to save data to DB:", error);
          toast({ variant: "destructive", title: t('toast.errorSavingData.title'), description: (error as Error).message });
        }
      }
    }, 1500); 
  }, [currentMonthlyData, incomeSources, bills, toast, session]);

  useEffect(() => {
    if (!isLoadingMonthlyData && !isLoadingAuth && isClient && currentMonthlyData && session?.userId) { 
      scheduleSaveToDb();
    }
  }, [incomeSources, bills, isLoadingMonthlyData, isLoadingAuth, isClient, currentMonthlyData, scheduleSaveToDb, session]);


   useEffect(() => {
    if (isClient && bills.length > 0) {
        setBills(currentBills => currentBills.map(bill => ({
          ...bill,
          name: bill.isCustom ? bill.name : (t(bill.nameKey || PREDEFINED_BILLS_CONFIG.find(pb => pb.id === bill.id)?.nameKey || '') || PREDEFINED_BILLS_CONFIG.find(pb => pb.id === bill.id)?.defaultName || t('home.bills.customBillFallback'))
        })));
    }
  }, [t, locale, isClient]); 

  const handleBillAmountRawChange = (billId: string, rawValue: string) => {
    const sanitized = sanitizeNumericInput(rawValue);
    setBills(prevBills =>
      prevBills.map(bill =>
        bill.id === billId ? { ...bill, rawAmountDisplay: sanitized, amount: parseCurrency(sanitized) || 0 } : bill
      )
    );
  };
  
  const handleBillAmountFocus = (billId: string) => {
    setBills(prevBills =>
      prevBills.map(bill => {
        if (bill.id === billId) {
          let displayValue = bill.rawAmountDisplay || '';
          if (bill.amount === 0 && bill.rawAmountDisplay === formatCurrency(0)) {
            displayValue = ''; 
          } else {
             displayValue = sanitizeNumericInput(bill.rawAmountDisplay || String(bill.amount));
          }
          return { ...bill, rawAmountDisplay: displayValue };
        }
        return bill;
      })
    );
  };

  const handleBillAmountBlur = (billId: string) => {
    setBills(prevBills => {
      return prevBills.map(bill => {
        if (bill.id === billId) {
          const currentAmount = bill.amount || 0;
          return { ...bill, amount: currentAmount, rawAmountDisplay: formatCurrency(currentAmount) };
        }
        return bill;
      });
    });
  };
  
  const handleBillIncomeSourceChange = (billId: string, sourceId: string) => {
    setBills(prevBills => 
        prevBills.map(bill =>
        bill.id === billId ? { ...bill, incomeSourceId: sourceId === "unassigned" ? undefined : sourceId } : bill
      )
    );
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
    if (!currentMonthlyData || !session?.userId) return;
    setIsLoadingInsights(true);
    setErrorInsights(null);
    setInsights(null); 

    const currentLocale = getLocale(); 
    const languageForAI = currentLocale === 'pt' ? 'Portuguese' : 'English';

    const totalIncomeForAI = currentMonthlyData.incomeSources.reduce((sum, source) => sum + source.amount, 0);

    const insightInput: SpendingInsightsInput = {
      incomeSources: currentMonthlyData.incomeSources.map(s => ({name: s.name, amount: s.amount })),
      totalIncome: totalIncomeForAI, 
      expenses: (currentMonthlyData.bills || []).map(b_stored => { 
          const uiBill = bills.find(ui_b => ui_b.id === b_stored.id);
          const name = uiBill ? uiBill.name : (b_stored.isCustom ? b_stored.name : PREDEFINED_BILLS_CONFIG.find(pbc => pbc.id === b_stored.id)?.defaultName || t('home.bills.customBillFallback'));
          const paidBySource = currentMonthlyData.incomeSources.find(src => src.id === b_stored.incomeSourceId);
          return {
            category: name || t('home.bills.unknownCategory'),
            amount: b_stored.amount,
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
  }, [currentMonthlyData, toast, t, getLocale, bills, session]);

  const openAddBillModal = () => {
    setNewBillName('');
    setNewBillAmountRaw(''); 
    setNewBillIcon(Receipt);
    setNewBillIsCustom(true);
    setNewBillPredefinedId(null);
    setSelectedIncomeSourceForNewBill(undefined); 
    setIsAddBillModalOpen(true);
  };

  const handlePredefinedBillSelect = (config: BillConfig) => {
    setNewBillName(t(config.nameKey) || config.defaultName); 
    setNewBillIcon(config.icon);
    setNewBillIsCustom(false); 
    setNewBillPredefinedId(config.id);
    setNewBillAmountRaw(''); 
  };
  
  const handleNewBillNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewBillName(e.target.value);
    if (newBillPredefinedId && e.target.value !== (t(PREDEFINED_BILLS_CONFIG.find(c => c.id === newBillPredefinedId)?.nameKey || '') || PREDEFINED_BILLS_CONFIG.find(c => c.id === newBillPredefinedId)?.defaultName)) { 
      setNewBillIsCustom(true); 
      setNewBillIcon(Receipt);
      setNewBillPredefinedId(null);
    }
  };

  const handleAddNewBillAmountRawChange = (rawValue: string) => {
    setNewBillAmountRaw(sanitizeNumericInput(rawValue));
  };

  const handleAddNewBillAmountBlur = () => {
    const parsed = parseCurrency(newBillAmountRaw);
    setNewBillAmountRaw(formatCurrency(parsed));
  };

  const handleAddNewBill = () => {
    const parsedAmount = parseCurrency(newBillAmountRaw); 
  
    if (!newBillName.trim()) {
      toast({ variant: "destructive", title: t('generic.error'), description: t('home.addBillModal.validation.nameRequired') });
      return;
    }
    if (parsedAmount < 0 ) { 
        toast({ variant: "destructive", title: t('generic.error'), description: t('home.addBillModal.validation.amountMustBePositiveOrZero') });
        return;
    }
     if (parsedAmount <= 0 && newBillAmountRaw.trim() !== sanitizeNumericInput(formatCurrency(0)) && newBillAmountRaw.trim() !== "0" && newBillAmountRaw.trim() !== '') {
         toast({ variant: "destructive", title: t('generic.error'), description: t('home.addBillModal.validation.amountRequired') });
         return;
    }

    const newBillEntry: Bill = {
      id: newBillIsCustom || !newBillPredefinedId ? `custom-${Date.now()}` : newBillPredefinedId,
      name: newBillName,
      nameKey: newBillIsCustom || !newBillPredefinedId ? undefined : PREDEFINED_BILLS_CONFIG.find(c => c.id === newBillPredefinedId)?.nameKey,
      icon: newBillIcon,
      amount: parsedAmount,
      isCustom: newBillIsCustom || !newBillPredefinedId,
      incomeSourceId: selectedIncomeSourceForNewBill === "unassigned" ? undefined : selectedIncomeSourceForNewBill,
      rawAmountDisplay: formatCurrency(parsedAmount), 
    };

    const billExists = bills.some(b => b.id === newBillEntry.id && !b.isCustom && !newBillEntry.isCustom);
    if (billExists) {
        toast({ variant: "destructive", title: t('generic.error'), description: t('home.addBillModal.validation.billExists', { billName: newBillEntry.name }) });
        return;
    }

    setBills(prevBills => [...prevBills, newBillEntry]);
    setIsAddBillModalOpen(false);
    toast({ title: t('home.addBillModal.toast.success.title'), description: t('home.addBillModal.toast.success.description', { billName: newBillEntry.name }) });
  };

  const handleDeleteBill = (billIdToDelete: string) => {
    const billToDelete = bills.find(b => b.id === billIdToDelete);

    console.log(`[DEBUG] Attempting to delete bill with ID: '${billIdToDelete}'`);
    if (!billToDelete) {
      console.error(`[DEBUG] Bill with ID '${billIdToDelete}' not found for deletion. Current bills:`, bills.map(b => b.id));
      toast({ variant: "destructive", title: t('generic.error'), description: `Bill not found for deletion. ID: ${billIdToDelete}`});
      return;
    }
    console.log('[DEBUG] Bill found for deletion:', billToDelete);
    
    setBills(prevBills => {
      console.log('[DEBUG] Previous bills count:', prevBills.length, 'IDs:', prevBills.map(b => b.id));
      const newBills = prevBills.filter(bill => bill.id !== billIdToDelete);
      console.log('[DEBUG] New bills count after filter:', newBills.length, 'IDs:', newBills.map(b => b.id));
      if (prevBills.length === newBills.length && prevBills.length > 0) {
          console.warn(`[DEBUG] Filter with ID '${billIdToDelete}' did not remove any bills. Please check ID matching carefully.`);
      }
      return newBills;
    });

    toast({ title: t('home.deleteBillModal.toast.success.title'), description: t('home.deleteBillModal.toast.success.description', { billName: billToDelete.name }) });
  };

  const openIncomeSourceModal = (source: IncomeSource | null) => {
    setCurrentIncomeSource(source);
    if (source) {
      setIncomeSourceName(source.name);
      setIncomeSourceAmountRaw(source.amount > 0 ? formatCurrency(source.amount) : ''); 
    } else {
      setIncomeSourceName('');
      setIncomeSourceAmountRaw('');
    }
    setIsIncomeSourceModalOpen(true);
  };

  const handleIncomeSourceAmountRawChange = (rawValue: string) => {
    setIncomeSourceAmountRaw(sanitizeNumericInput(rawValue));
  };
  
  const handleIncomeSourceAmountBlur = () => {
    const parsed = parseCurrency(incomeSourceAmountRaw);
    setIncomeSourceAmountRaw(formatCurrency(parsed));
  };

  const handleSaveIncomeSource = () => {
    const parsedAmount = parseCurrency(incomeSourceAmountRaw);
    if (!incomeSourceName.trim()) {
      toast({ variant: "destructive", title: t('generic.error'), description: t('home.incomeSources.dialog.nameLabel') + ' ' + t('home.addBillModal.validation.nameRequired') });
      return;
    }
     if (parsedAmount < 0) { 
      toast({ variant: "destructive", title: t('generic.error'), description: t('home.incomeSources.dialog.amountMustBePositiveOrZero') });
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
    setIsIncomeSourceModalOpen(false);
  };

  const handleDeleteIncomeSource = (sourceId: string) => {
    const sourceToDelete = incomeSources.find(s => s.id === sourceId);
    if (!sourceToDelete) return;

    if (sourceToDelete.id.startsWith('primary-') && incomeSources.length === 1) {
        toast({
            variant: "destructive",
            title: t('home.incomeSources.deleteConfirm.cannotDeletePrimaryTitle'),
            description: t('home.incomeSources.deleteConfirm.cannotDeletePrimaryDescription')
        });
        return;
    }

    setIncomeSources(prevSources => prevSources.filter(s => s.id !== sourceId));
    setBills(prevBills => prevBills.map(b => b.incomeSourceId === sourceId ? { ...b, incomeSourceId: undefined } : b));
    toast({ title: t('home.incomeSources.toast.deleted.title'), description: t('home.incomeSources.toast.deleted.description', { sourceName: sourceToDelete.name}) });
  };

  const handleReplicateBill = useCallback(async (billToReplicate: Bill) => {
    if (!currentMonthlyData || !session?.userId || !userSettings || selectedYear === null || selectedMonth === null) {
        toast({ variant: "destructive", title: "Error", description: "Current month data or user session not loaded." });
        return;
    }

    const currentMonthDate = new Date(selectedYear, selectedMonth - 1, 1);
    const nextMonthDate = addMonths(currentMonthDate, 1);
    const nextMonthValue = getMonth(nextMonthDate) + 1;
    const nextYearValue = getYear(nextMonthDate);

    try {
        let nextMonthDataFromDB = await getMonthlyData(session.userId, nextYearValue, nextMonthValue);
        const replicatedStoredBill = billToStoredBill(billToReplicate);

        if (nextMonthDataFromDB) {
            const billExists = nextMonthDataFromDB.bills.some(b => b.id === replicatedStoredBill.id && !b.isCustom && !replicatedStoredBill.isCustom);
            if (!billExists) {
                nextMonthDataFromDB.bills.push(replicatedStoredBill);
            } else {
                nextMonthDataFromDB.bills = nextMonthDataFromDB.bills.map(b => b.id === replicatedStoredBill.id ? replicatedStoredBill : b);
            }
        } else {
            const primaryIncomeName = userSettings.defaultIncomeSourceName?.trim()
                ? userSettings.defaultIncomeSourceName
                : t('home.incomeSources.defaultPrimaryName');
            nextMonthDataFromDB = {
                userId: session.userId,
                year: nextYearValue,
                month: nextMonthValue,
                incomeSources: [{
                    id: `primary-${nextYearValue}-${nextMonthValue}-${Date.now()}`,
                    name: primaryIncomeName,
                    amount: userSettings.defaultIncome || 0
                }],
                bills: [replicatedStoredBill],
            };
        }
        
        nextMonthDataFromDB.bills = Array.from(new Map(nextMonthDataFromDB.bills.map(item => [item.id, item])).values());
        await saveMonthlyData(nextMonthDataFromDB);

        const currentFnLocale = locale === 'pt' ? ptBR : enUS;
        const nextMonthFormatted = format(nextMonthDate, 'LLLL', { locale: currentFnLocale });
        toast({
            title: t('home.bills.toast.replicated.title'),
            description: t('home.bills.toast.replicated.description', { billName: billToReplicate.name, nextMonth: nextMonthFormatted, nextYear: nextYearValue.toString() }),
        });

    } catch (error) {
        console.error("Error replicating bill:", error);
        toast({ variant: "destructive", title: t('toast.errorReplicatingBill.title'), description: (error as Error).message });
    }
  }, [selectedYear, selectedMonth, userSettings, t, locale, toast, currentMonthlyData, session]); 
  
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


  if (!isClient || isLoadingAuth || selectedYear === null || selectedMonth === null || (!isLoadingMonthlyData && !currentMonthlyData && session)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height,56px))] p-4 sm:p-8 bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-foreground">{isLoadingAuth || selectedYear === null || selectedMonth === null ? t('app.loadingAuth') : t('app.loadingData')}</p>
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
            <CardContent className="space-y-1">
              {bills.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">{t('home.bills.noBillsYet')}</p>
              )}
              {bills.map(bill => (
                <div 
                  key={bill.id} 
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors rounded-md"
                >
                  <div className="flex items-center gap-3 mr-auto sm:order-1 mb-2 sm:mb-0">
                    <bill.icon className="h-7 w-7 text-accent flex-shrink-0"/>
                    <p className="font-medium truncate text-card-foreground flex-1">{bill.name}</p>
                  </div>
                  
                  <div className="flex flex-row flex-wrap items-center justify-end gap-2 w-full sm:w-auto mt-2 sm:mt-0 sm:order-2">
                    <div className="min-w-[140px] flex-auto xs:flex-initial xs:w-auto sm:max-w-[170px] md:max-w-[190px]">
                      <Select
                        value={bill.incomeSourceId || "unassigned"}
                        onValueChange={(value) => handleBillIncomeSourceChange(bill.id, value)}
                      >
                        <SelectTrigger className="h-8 text-xs w-full">
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
                    
                    <div className="min-w-[100px] w-full xs:w-auto xs:max-w-[120px] sm:w-28">
                      <Input
                        id={`bill-amount-${bill.id}`}
                        type="text" 
                        value={bill.rawAmountDisplay ?? ''}
                        onFocus={() => handleBillAmountFocus(bill.id)}
                        onChange={(e) => handleBillAmountRawChange(bill.id, e.target.value)}
                        onBlur={() => handleBillAmountBlur(bill.id)}
                        placeholder={t('home.addBillModal.amountPlaceholder')}
                        className="w-full text-right text-sm"
                        aria-label={`${bill.name} ${t('home.addBillModal.amountLabel')}`}
                      />
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleReplicateBill(bill)}
                              aria-label={t('home.bills.tooltip.replicateBill')}
                              className="h-9 w-9" 
                            >
                              <ArrowRightCircle className="h-5 w-5"/>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>{t('home.bills.tooltip.replicateBill')}</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <TooltipProvider delayDuration={100}>
                              <Tooltip>
                                  <TooltipTrigger asChild>
                                      <Button
                                          variant="ghost"
                                          size="icon"
                                          className="text-destructive hover:text-destructive/90 hover:bg-destructive/10 h-9 w-9"
                                          aria-label={t('home.bills.tooltip.deleteBill')}
                                      >
                                          <Trash2 className="h-5 w-5"/>
                                      </Button>
                                  </TooltipTrigger>
                                  <TooltipContent><p>{t('home.bills.tooltip.deleteBill')}</p></TooltipContent>
                              </Tooltip>
                          </TooltipProvider>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('home.deleteBillModal.title')}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t('home.deleteBillModal.description', { billName: bill.name })}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('generic.cancel')}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteBill(bill.id)} className="bg-destructive hover:bg-destructive/90">
                              {t('generic.delete')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
            <CardFooter>
                <Button variant="outline" className="w-full mt-4" onClick={openAddBillModal}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    {t('home.addBillButton')}
                </Button>
            </CardFooter>
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
                <Label className="text-xs text-muted-foreground">{t('home.summaryCard.expenseRatio', { ratio: expenseRatio > 1000 ? "&gt;1000" : expenseRatio.toFixed(0) })}</Label>
                <Progress value={Math.min(expenseRatio, 100)} className="w-full mt-1 h-3" indicatorClassName={expenseRatio > 80 ? "bg-destructive" : (expenseRatio > 100 ? "bg-destructive" : "bg-primary")} />
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
                <ChartContainer config={expenseChartConfig} className="mx-auto aspect-square h-[250px] sm:h-[300px] w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                    <Pie 
                        data={expenseChartData} 
                        dataKey="value" 
                        nameKey="name" 
                        cx="50%" 
                        cy="50%" 
                        outerRadius={80} 
                        labelLine={false} 
                        label={({ percent, name }) => {
                            const percentage = (percent * 100).toFixed(0);
                            return parseInt(percentage) > 3 ? `${name}: ${percentage}%` : `${percentage}%`; 
                        }}
                    >
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
                 <ChartContainer config={incomeContributionChartConfig} className="mx-auto aspect-square h-[250px] sm:h-[300px] w-full">
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

      {/* Add/Edit Bill Modal */}
      <Dialog open={isAddBillModalOpen} onOpenChange={setIsAddBillModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('home.addBillModal.title')}</DialogTitle>
            <DialogDescription>{t('home.addBillModal.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="quickAddBill" className="text-sm font-medium">{t('home.addBillModal.quickAddLabel')}</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                {PREDEFINED_BILLS_CONFIG.map(config => (
                  <Button
                    key={config.id}
                    variant="outline"
                    size="sm"
                    className="flex flex-col h-auto p-2 items-center justify-center gap-1 text-xs"
                    onClick={() => handlePredefinedBillSelect(config)}
                  >
                    <config.icon className="h-5 w-5 text-accent" />
                    <span>{t(config.nameKey)}</span>
                  </Button>
                ))}
              </div>
            </div>
            <Separator />
             <div>
              <Label htmlFor="newBillName">{t('home.addBillModal.nameLabel')}</Label>
              <div className="flex items-center gap-2">
                {React.createElement(newBillIcon, { className: "h-5 w-5 text-muted-foreground" })}
                <Input
                  id="newBillName"
                  value={newBillName}
                  onChange={handleNewBillNameChange}
                  placeholder={t('home.addBillModal.namePlaceholder')}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="newBillAmount">{t('home.addBillModal.amountLabel')}</Label>
              <Input
                id="newBillAmount"
                type="text" 
                value={newBillAmountRaw}
                onChange={(e) => handleAddNewBillAmountRawChange(e.target.value)}
                onBlur={handleAddNewBillAmountBlur} 
                placeholder={t('home.addBillModal.amountPlaceholder')}
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
                value={incomeSourceAmountRaw}
                onChange={(e) => handleIncomeSourceAmountRawChange(e.target.value)}
                onBlur={handleIncomeSourceAmountBlur} 
                placeholder={t('home.addBillModal.amountPlaceholder')}
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
          {t('home.footer.poweredByMongoDB')}
        </p>
      </footer>
    </div>
  );
}

    
