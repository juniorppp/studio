
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PieChart as ChartIcon, Droplet, Zap, Wifi, Home, DollarSign, LineChart, AlertCircle, Loader2, Brain, Receipt, PlusCircle, CalendarDays, Edit3, Trash2, Landmark, ArrowRightCircle } from 'lucide-react';
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

const billToStoredBill = (bill: Bill): StoredBillData => ({
  id: bill.id,
  amount: bill.amount,
  name: bill.isCustom ? bill.name : undefined,
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
  const [newBillAmountRaw, setNewBillAmountRaw] = useState('');
  const [newBillIcon, setNewBillIcon] = useState<React.ElementType>(Receipt);
  const [newBillIsCustom, setNewBillIsCustom] = useState(true);
  const [newBillPredefinedId, setNewBillPredefinedId] = useState<string | null>(null);
  const [selectedIncomeSourceForNewBill, setSelectedIncomeSourceForNewBill] = useState<string | undefined>(undefined);

  const [isIncomeSourceModalOpen, setIsIncomeSourceModalOpen] = useState(false);
  const [currentIncomeSource, setCurrentIncomeSource] = useState<IncomeSource | null>(null);
  const [incomeSourceName, setIncomeSourceName] = useState('');
  const [incomeSourceAmountRaw, setIncomeSourceAmountRaw] = useState('');

  const yearOptions = useMemo(() => generateYearOptions(), []);
  const monthOptions = useMemo(() => generateMonthOptions(t, locale), [t, locale]);

  const getDecimalSeparator = useCallback(() => (locale === 'pt' ? ',' : '.'), [locale]);

  const sanitizeNumericInput = useCallback((value: string) => {
    const decimalSeparator = getDecimalSeparator();
    // Allow only digits and the locale-specific decimal separator.
    // Regex explanation:
    // [^0-9...] matches any character NOT in the set.
    // \\. is for literal dot (if decimalSeparator is '.')
    // The 'g' flag means global (replace all occurrences).
    const regex = new RegExp(`[^0-9${decimalSeparator === '.' ? '\\.' : decimalSeparator}]`, 'g');
    let sanitized = value.replace(regex, '');
  
    // Ensure only one decimal separator
    const parts = sanitized.split(decimalSeparator);
    if (parts.length > 2) {
      sanitized = parts[0] + decimalSeparator + parts.slice(1).join('');
    }
    return sanitized;
  }, [getDecimalSeparator]);
  

  const mapStoredDataToBills = useCallback((storedBills: StoredBillData[]): Bill[] => {
    const mapped = storedBills.map(storedBill => {
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
          icon: Receipt, // Default icon for custom bills
        };
      }
      // It's a predefined bill, find its config
      const config = PREDEFINED_BILLS_CONFIG.find(pb => pb.id === storedBill.id);
      if (config) {
        return {
          ...baseBill,
          name: t(config.nameKey) || config.defaultName, // Translate nameKey or use default
          nameKey: config.nameKey,
          icon: config.icon,
        };
      }
      // Fallback if a non-custom bill ID doesn't match predefined (should ideally not happen)
      return {
        ...baseBill,
        name: storedBill.name || t('home.bills.customBillFallback'),
        icon: Receipt,
        isCustom: true, // Treat as custom if config not found
      };
    }).filter(bill => bill !== null) as Bill[]; // Filter out any nulls if error cases were added
    // Ensure uniqueness by ID, important if merging from multiple sources or after edits
    return Array.from(new Map(mapped.map(item => [item.id, item])).values());
  }, [t]);


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

      if (!storedDataString) { // If no data was stored, initialize with validated defaults
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(validatedAppStorage));
      }
    } catch (error) {
      console.error("Failed to load data from localStorage:", error);
      toast({
        variant: "destructive",
        title: t('toast.errorLoadingData.title'),
        description: t('toast.errorLoadingData.description'),
      });
      // Fallback to a default structure if loading fails
      const fallbackStorage: AppStorage = {
        userLocale: getLocale(),
        defaultIncome: 0,
        defaultIncomeSourceName: '',
        allMonthlyData: []
      };
      setAppStorage(fallbackStorage);
    }
  }, [toast, t, getLocale]); // getLocale from useLocalization

 useEffect(() => {
    if (!isClient || !appStorage) return;

    let existingMonthData = appStorage.allMonthlyData.find(
      (data) => data.year === selectedYear && data.month === selectedMonth
    );

    let finalMonthData: MonthlyData;

    if (!existingMonthData) {
      // New month: initialize with default income source from appStorage settings
      const primaryIncomeName = appStorage.defaultIncomeSourceName?.trim()
        ? appStorage.defaultIncomeSourceName
        : t('home.incomeSources.defaultPrimaryName');
      
      const initialIncomeSources: IncomeSource[] = [{
        id: `primary-${selectedYear}-${selectedMonth}-${Date.now()}`, // Unique ID for primary
        name: primaryIncomeName,
        amount: appStorage.defaultIncome || 0 // Use defaultIncome from settings
      }];

      finalMonthData = {
        year: selectedYear,
        month: selectedMonth,
        incomeSources: initialIncomeSources,
        bills: [], // Bills start empty for a new month
      };
    } else {
      // Existing month data found, ensure primary income source is present and up-to-date
      const resolvedIncomeSources = [...(existingMonthData.incomeSources || [])];
      const primaryIncomeNameFromSettings = appStorage.defaultIncomeSourceName?.trim()
        ? appStorage.defaultIncomeSourceName
        : t('home.incomeSources.defaultPrimaryName');
      
      let primarySource = resolvedIncomeSources.find(s => s.id.startsWith('primary-'));

      if (!primarySource) {
        // Add primary source if missing (e.g., data from older version)
        primarySource = {
          id: `primary-${selectedYear}-${selectedMonth}-${Date.now()}`,
          name: primaryIncomeNameFromSettings,
          amount: appStorage.defaultIncome || 0, // Use settings default
        };
        resolvedIncomeSources.unshift(primarySource); // Add to the beginning
      } else {
        // Primary source exists, update its name if it's the generic default and settings have a custom one
        // Also update amount if it's 0 and settings have a default amount > 0
        if (primarySource.name === 'Primary Income' || primarySource.name === t('home.incomeSources.defaultPrimaryName', undefined, {locale: 'en'}) || primarySource.name === t('home.incomeSources.defaultPrimaryName', undefined, {locale: 'pt'})) {
            primarySource.name = primaryIncomeNameFromSettings;
        }
        if (!primarySource.amount && (appStorage.defaultIncome || 0) > 0) {
            // Only update amount if current is 0 and default from settings is > 0.
            // This avoids overwriting a user-set 0 amount for the primary source for that month.
            primarySource.amount = appStorage.defaultIncome || 0;
        }
      }
      
      // Ensure unique income sources by ID
      const uniqueIncomeSources = Array.from(new Map(resolvedIncomeSources.map(item => [item.id, item])).values());
      // Ensure unique stored bills by ID
      const uniqueStoredBills = Array.from(new Map((existingMonthData.bills || []).map(item => [item.id, item])).values());


      finalMonthData = {
        ...existingMonthData,
        incomeSources: uniqueIncomeSources,
        bills: uniqueStoredBills, // Use the de-duplicated bills
      };
    }
    
    setCurrentMonthlyData(finalMonthData);
    setIncomeSources(finalMonthData.incomeSources);
    setBills(mapStoredDataToBills(finalMonthData.bills)); // Map stored bills to UI bills
    setInsights(null); // Reset insights when month/year changes
    setErrorInsights(null);

  }, [isClient, appStorage, selectedYear, selectedMonth, mapStoredDataToBills, t]);


  useEffect(() => {
    if (!isClient || !appStorage || !currentMonthlyData) return;

    const monthDataInStorage = appStorage.allMonthlyData.find(
      (data) => data.year === currentMonthlyData.year && data.month === currentMonthlyData.month
    );
    
    // Only save if currentMonthlyData is different from what's in appStorage for this month/year
    if (JSON.stringify(monthDataInStorage) !== JSON.stringify(currentMonthlyData)) {
        const updatedAllMonthlyData = appStorage.allMonthlyData.filter(
        (data) => !(data.year === currentMonthlyData.year && data.month === currentMonthlyData.month)
        );
        updatedAllMonthlyData.push(currentMonthlyData);
        
        const newAppStorage: AppStorage = {
        ...appStorage,
        allMonthlyData: updatedAllMonthlyData,
        };
        
        setAppStorage(newAppStorage);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newAppStorage));
    }
  }, [currentMonthlyData, isClient, appStorage]);

   // Effect to update bill names if language changes
   useEffect(() => {
    if (isClient && bills.length > 0) {
        // Only update names, not amounts or other properties
        setBills(currentBills => currentBills.map(bill => ({
          ...bill,
          name: bill.isCustom ? bill.name : (t(bill.nameKey || '') || PREDEFINED_BILLS_CONFIG.find(pb => pb.id === bill.id)?.defaultName || t('home.bills.customBillFallback'))
        })));
    }
  }, [t, locale, isClient]); // Removed `bills` from dependencies to avoid loop, only t and locale should trigger this.

  const handleBillAmountRawChange = (billId: string, rawValue: string) => {
    const sanitizedValue = sanitizeNumericInput(rawValue);
    setBills(prevBills =>
      prevBills.map(bill =>
        bill.id === billId ? { ...bill, rawAmountDisplay: sanitizedValue } : bill
      )
    );
  };

  const handleBillAmountBlur = (billId: string) => {
    setBills(prevBills => {
      const billToUpdate = prevBills.find(b => b.id === billId);
      if (!billToUpdate) return prevBills;
  
      const numericValue = parseCurrency(billToUpdate.rawAmountDisplay || '0');
      
      const updatedBills = prevBills.map(bill => {
        if (bill.id === billId) {
          // Create a new object without rawAmountDisplay, setting amount
          const { rawAmountDisplay, ...rest } = bill;
          return { ...rest, amount: numericValue };
        }
        return bill;
      });
  
      // Update currentMonthlyData with the new amounts
      setCurrentMonthlyData(prevData => {
        if (!prevData) return null;
        return { ...prevData, bills: billsToStoredBillsArray(updatedBills) };
      });
  
      return updatedBills; // Return updated bills for setBills
    });
  };
  

  const handleBillIncomeSourceChange = (billId: string, sourceId: string) => {
    const updatedBills = bills.map(bill =>
      bill.id === billId ? { ...bill, incomeSourceId: sourceId === "unassigned" ? undefined : sourceId } : bill
    );
    setBills(updatedBills);
    setCurrentMonthlyData(prevData => {
        if (!prevData) return null;
        return { ...prevData, bills: billsToStoredBillsArray(updatedBills) };
      });
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
    if (totalIncome === 0 && totalExpenses === 0) return 0; // No income, no expenses
    if (totalIncome === 0) return totalExpenses > 0 ? 1000 : 0; // No income, but expenses (treat as very high ratio or 0 if no expenses)
    // Cap ratio at 1000 to prevent extreme progress bar values if expenses vastly exceed income.
    return Math.min(Math.max(0, (totalExpenses / totalIncome) * 100), 1000);
  }, [totalIncome, totalExpenses]);


  const handleGenerateInsights = useCallback(async () => {
    if (!currentMonthlyData) return;
    setIsLoadingInsights(true);
    setErrorInsights(null);
    setInsights(null); // Clear previous insights

    const currentLocale = getLocale(); // From useLocalization
    const languageForAI = currentLocale === 'pt' ? 'Portuguese' : 'English';

    // Ensure totalIncome for AI matches the sum of current incomeSources in currentMonthlyData
    const totalIncomeForAI = currentMonthlyData.incomeSources.reduce((sum, source) => sum + source.amount, 0);

    const insightInput: SpendingInsightsInput = {
      incomeSources: currentMonthlyData.incomeSources.map(s => ({name: s.name, amount: s.amount })), // Use currentMonthlyData
      totalIncome: totalIncomeForAI, // Use calculated total from currentMonthlyData
      expenses: currentMonthlyData.bills.map(b => { // Use currentMonthlyData
          // Find the corresponding UI bill to get its potentially translated name
          const uiBill = bills.find(ui_b => ui_b.id === b.id);
          const name = uiBill ? uiBill.name : (b.isCustom ? b.name : t('home.bills.customBillFallback'));
          const paidBySource = currentMonthlyData.incomeSources.find(src => src.id === b.incomeSourceId);
          return {
            category: name || t('home.bills.unknownCategory'), // Fallback for category name
            amount: b.amount,
            paidBy: paidBySource?.name // Name of the income source that paid
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
      setErrorInsights(errorMessage); // Set error message for display
       toast({
        variant: "destructive",
        title: t('toast.insightsFailed.title'),
        description: errorMessage,
      });
    } finally {
      setIsLoadingInsights(false);
    }
  }, [currentMonthlyData, toast, t, getLocale, bills]); // Added `bills` as dependency for name resolution

  const openAddBillModal = () => {
    setNewBillName('');
    setNewBillAmountRaw(''); // Use raw string state
    setNewBillIcon(Receipt);
    setNewBillIsCustom(true);
    setNewBillPredefinedId(null);
    setSelectedIncomeSourceForNewBill(undefined); // Reset income source selection
    setIsAddBillModalOpen(true);
  };

  const handlePredefinedBillSelect = (config: BillConfig) => {
    setNewBillName(t(config.nameKey) || config.defaultName); // Use translated name
    setNewBillIcon(config.icon);
    setNewBillIsCustom(false); // This is a predefined bill type
    setNewBillPredefinedId(config.id); // Store the predefined ID
    // Amount is not set here, user will input it
  };
  
  const handleNewBillNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewBillName(e.target.value);
    // If user types a custom name after selecting a predefined one, treat it as custom
    if (newBillPredefinedId) { // If a predefined bill was selected
      setNewBillIsCustom(true); // Now it's custom because the name changed
      setNewBillIcon(Receipt); // Revert to default custom icon
      // newBillPredefinedId remains to check for existence, but isCustom flag takes precedence for saving
    }
  };

  const handleAddNewBillAmountRawChange = (rawValue: string) => {
    setNewBillAmountRaw(sanitizeNumericInput(rawValue));
  };

  const handleAddNewBillAmountBlur = () => {
    // const numericValue = parseCurrency(newBillAmountRaw);
    // setNewBillAmountRaw(numericValue > 0 ? formatCurrency(numericValue) : ''); // Format on blur
    // No, we want to keep it raw for submission, parse on submit.
    // Or, if we want live formatting, need a more complex setup.
    // For now, sanitize onChange, parse on submit.
  };


  const handleAddNewBill = () => {
    const parsedAmount = parseCurrency(newBillAmountRaw); // Parse the raw string amount
  
    if (!newBillName.trim()) {
      toast({ variant: "destructive", title: t('generic.error'), description: t('home.addBillModal.validation.nameRequired') });
      return;
    }
    if (parsedAmount < 0 ) { // Amount can be 0
        toast({ variant: "destructive", title: t('generic.error'), description: t('home.addBillModal.validation.amountMustBePositiveOrZero') });
        return;
    }
     // If raw input is not '0' or empty, but parsed amount is 0, it means invalid input like "abc"
    if (parsedAmount <= 0 && newBillAmountRaw.trim() !== '0' && newBillAmountRaw.trim() !== '' && newBillAmountRaw.trim() !== formatCurrency(0).replace(/\s/g, '')) {
         toast({ variant: "destructive", title: t('generic.error'), description: t('home.addBillModal.validation.amountRequired') });
         return;
    }


    const newBillEntry: Bill = {
      id: newBillIsCustom || !newBillPredefinedId ? `custom-${Date.now()}` : newBillPredefinedId,
      name: newBillName,
      nameKey: newBillIsCustom || !newBillPredefinedId ? undefined : PREDEFINED_BILLS_CONFIG.find(c => c.id === newBillPredefinedId)?.nameKey,
      icon: newBillIcon,
      amount: parsedAmount, // Use parsed numeric amount
      isCustom: newBillIsCustom || !newBillPredefinedId, // Bill is custom if name was changed or not predefined
      incomeSourceId: selectedIncomeSourceForNewBill === "unassigned" ? undefined : selectedIncomeSourceForNewBill,
    };

    // Check if a non-custom bill with the same ID already exists
    const billExists = bills.some(b => b.id === newBillEntry.id && !b.isCustom && !newBillEntry.isCustom);
    if (billExists) {
        toast({ variant: "destructive", title: t('generic.error'), description: t('home.addBillModal.validation.billExists', { billName: newBillEntry.name }) });
        return;
    }

    const updatedBills = [...bills, newBillEntry];
    setBills(updatedBills);
    setCurrentMonthlyData(prevData => {
        if (!prevData) return null;
        return { ...prevData, bills: billsToStoredBillsArray(updatedBills) };
      });
    setIsAddBillModalOpen(false);
    toast({ title: t('home.addBillModal.toast.success.title'), description: t('home.addBillModal.toast.success.description', { billName: newBillEntry.name }) });
  };

  const handleDeleteBill = (billIdToDelete: string) => {
    const billToDelete = bills.find(b => b.id === billIdToDelete);
    if (!billToDelete) return; // Should not happen if UI is consistent

    // Update UI state
    const updatedBills = bills.filter(bill => bill.id !== billIdToDelete);
    setBills(updatedBills);

    // Update persistent state structure
    setCurrentMonthlyData(prevData => {
        if (!prevData) return null;
        return { ...prevData, bills: billsToStoredBillsArray(updatedBills) };
      });

    toast({ title: t('home.deleteBillModal.toast.success.title'), description: t('home.deleteBillModal.toast.success.description', { billName: billToDelete.name }) });
  };

  const openIncomeSourceModal = (source: IncomeSource | null) => {
    setCurrentIncomeSource(source);
    if (source) {
      setIncomeSourceName(source.name);
      setIncomeSourceAmountRaw(source.amount > 0 ? formatCurrency(source.amount) : ''); // Format for display
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
    // This can be used to format the input on blur if desired,
    // but parsing will happen on save.
    // const numericValue = parseCurrency(incomeSourceAmountRaw);
    // setIncomeSourceAmountRaw(numericValue >= 0 ? formatCurrency(numericValue) : '');
  };

  const handleSaveIncomeSource = () => {
    const parsedAmount = parseCurrency(incomeSourceAmountRaw);
    if (!incomeSourceName.trim()) {
      toast({ variant: "destructive", title: t('generic.error'), description: t('home.incomeSources.dialog.nameLabel') + ' ' + t('home.addBillModal.validation.nameRequired') });
      return;
    }
     if (parsedAmount < 0) { // Amount can be 0
      toast({ variant: "destructive", title: t('generic.error'), description: t('home.incomeSources.dialog.amountMustBePositiveOrZero') });
      return;
    }

    let updatedIncomeSources;
    if (currentIncomeSource) { // Editing existing source
      updatedIncomeSources = incomeSources.map(s => s.id === currentIncomeSource.id ? { ...s, name: incomeSourceName, amount: parsedAmount } : s);
      toast({ title: t('home.incomeSources.toast.updated.title'), description: t('home.incomeSources.toast.updated.description', { sourceName: incomeSourceName })});
    } else { // Adding new source
      const newSource: IncomeSource = {
        id: `income-${Date.now()}`, // Unique ID for custom income sources
        name: incomeSourceName,
        amount: parsedAmount,
      };
      updatedIncomeSources = [...incomeSources, newSource];
      toast({ title: t('home.incomeSources.toast.added.title'), description: t('home.incomeSources.toast.added.description', { sourceName: incomeSourceName }) });
    }
    setIncomeSources(updatedIncomeSources);
    setCurrentMonthlyData(prevData => {
        if (!prevData) return null;
        return { ...prevData, incomeSources: updatedIncomeSources };
      });
    setIsIncomeSourceModalOpen(false);
  };

  const handleDeleteIncomeSource = (sourceId: string) => {
    const sourceToDelete = incomeSources.find(s => s.id === sourceId);
    if (!sourceToDelete) return;

    // Prevent deleting the primary income source if it's the only one
    if (sourceToDelete.id.startsWith('primary-') && incomeSources.length === 1) {
        toast({
            variant: "destructive",
            title: t('home.incomeSources.deleteConfirm.cannotDeletePrimaryTitle'),
            description: t('home.incomeSources.deleteConfirm.cannotDeletePrimaryDescription')
        });
        return;
    }

    const updatedIncomeSources = incomeSources.filter(s => s.id !== sourceId);
    setIncomeSources(updatedIncomeSources);

    // Unassign bills from the deleted income source
    const updatedBills = bills.map(b => b.incomeSourceId === sourceId ? { ...b, incomeSourceId: undefined } : b);
    setBills(updatedBills); // Update UI bills

    setCurrentMonthlyData(prevData => {
      if (!prevData) return null;
      return {
        ...prevData,
        incomeSources: updatedIncomeSources,
        bills: billsToStoredBillsArray(updatedBills) // Update stored bills
      };
    });
    toast({ title: t('home.incomeSources.toast.deleted.title'), description: t('home.incomeSources.toast.deleted.description', { sourceName: sourceToDelete.name}) });
  };

  const handleReplicateBill = useCallback((billToReplicate: Bill) => {
    if (!appStorage) return;
  
    const currentMonthDate = new Date(selectedYear, selectedMonth - 1, 1);
    const nextMonthDate = addMonths(currentMonthDate, 1);
    const nextMonth = getMonth(nextMonthDate) + 1;
    const nextYear = getYear(nextMonthDate);
  
    let nextMonthData = appStorage.allMonthlyData.find(d => d.year === nextYear && d.month === nextMonth);
    const newAllMonthlyData = [...appStorage.allMonthlyData.filter(d => !(d.year === nextYear && d.month === nextMonth))];
    
    const replicatedStoredBill = billToStoredBill(billToReplicate);
  
    if (nextMonthData) {
      // Month data exists, add or update the bill
      const billExists = nextMonthData.bills.some(b => b.id === replicatedStoredBill.id);
      if (!billExists) {
         nextMonthData.bills.push(replicatedStoredBill);
      } else {
        // If bill with same ID exists, update it (e.g. if amount changed in current month before replicating)
        nextMonthData.bills = nextMonthData.bills.map(b => b.id === replicatedStoredBill.id ? replicatedStoredBill : b);
      }
    } else {
      // Month data doesn't exist, create it
      const primaryIncomeName = appStorage.defaultIncomeSourceName?.trim()
        ? appStorage.defaultIncomeSourceName
        : t('home.incomeSources.defaultPrimaryName');
      nextMonthData = {
        year: nextYear,
        month: nextMonth,
        incomeSources: [{ // Initialize with default primary income for the new month
          id: `primary-${nextYear}-${nextMonth}-${Date.now()}`,
          name: primaryIncomeName,
          amount: appStorage.defaultIncome || 0
        }],
        bills: [replicatedStoredBill], // Add the replicated bill
      };
    }
    // Ensure bills in nextMonthData are unique by ID after potential addition/update
    const uniqueStoredBillsNextMonth = Array.from(new Map(nextMonthData.bills.map(item => [item.id, item])).values());
    nextMonthData.bills = uniqueStoredBillsNextMonth;

    newAllMonthlyData.push(nextMonthData);
  
    const updatedAppStorage: AppStorage = {
      ...appStorage,
      allMonthlyData: newAllMonthlyData,
    };
    setAppStorage(updatedAppStorage); // Update appStorage state
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedAppStorage)); // Save to localStorage
  
    const currentFnLocale = locale === 'pt' ? ptBR : enUS;
    const nextMonthFormatted = format(nextMonthDate, 'LLLL', { locale: currentFnLocale });
    toast({
      title: t('home.bills.toast.replicated.title'),
      description: t('home.bills.toast.replicated.description', { billName: billToReplicate.name, nextMonth: nextMonthFormatted, nextYear: nextYear.toString() }),
    });
  }, [appStorage, selectedYear, selectedMonth, t, locale, toast]);
  

  const topExpenses = useMemo(() => {
    return [...bills]
      .filter(bill => bill.amount > 0) // Only consider bills with a positive amount
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);
  }, [bills]);

  const expenseChartData = useMemo(() => {
    return bills
      .filter(bill => bill.amount > 0) // Only include bills with actual spending
      .map((bill, index) => ({
        name: bill.name,
        value: bill.amount,
        fill: `hsl(var(--chart-${(index % 5) + 1}))`, // Cycle through 5 chart colors
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
      if (bill.incomeSourceId && bill.amount > 0) { // Bill must have an assigned source and positive amount
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
      fill: `hsl(var(--chart-${(index % 5) + 1}))`, // Cycle chart colors
    }));
  }, [bills, incomeSources]);

  const incomeContributionChartConfig = useMemo(() => {
    const config: ChartConfig = {};
    incomeContributionChartData.forEach(item => {
      // Use a unique key for config, like source ID, if names can clash
      config[item.incomeSourceName] = { // Assuming incomeSourceName is unique enough for labels
        label: item.name, // This is the display label for the legend
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
                  className="flex flex-col sm:flex-row sm:items-center sm:gap-x-4 gap-y-2 p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors rounded-md"
                >
                  {/* Group 1: Icon and Name */}
                  <div className="flex items-center gap-3 flex-shrink-0 w-full sm:w-auto sm:flex-none">
                    <bill.icon className="h-7 w-7 text-accent flex-shrink-0"/>
                    <p className="font-medium truncate text-card-foreground flex-1">{bill.name}</p>
                  </div>

                  {/* Group 2: Income Source Select */}
                  <div className="w-full sm:order-2 sm:flex-1 min-w-0 md:max-w-[220px]">
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
                  
                  {/* Group 3 (Mobile): Amount Input AND Action Buttons on the same line */}
                  {/* This div handles the layout for mobile's third line, and adapts for desktop */}
                  <div className="flex items-center justify-between w-full gap-2 sm:order-3 sm:w-auto sm:gap-1 sm:ml-auto">
                    {/* Amount Input */}
                    <div className="flex-grow sm:flex-grow-0 sm:w-28">
                      <Input
                        id={`bill-amount-${bill.id}`}
                        type="text" // Keep as text to allow custom formatting and sanitization
                        value={(bill as any).rawAmountDisplay ?? (bill.amount === 0 && !(bill as any).rawAmountDisplay?.trim() ? '' : formatCurrency(bill.amount))}
                        onChange={(e) => handleBillAmountRawChange(bill.id, e.target.value)}
                        onBlur={() => handleBillAmountBlur(bill.id)}
                        placeholder={t('home.addBillModal.amountPlaceholder')}
                        className="w-full text-right text-sm"
                        aria-label={`${bill.name} ${t('home.addBillModal.amountLabel')}`}
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1">
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleReplicateBill(bill)}
                              aria-label={t('home.bills.tooltip.replicateBill')}
                              className="h-8 w-8 sm:h-9 sm:w-9" 
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
                                          className="text-destructive hover:text-destructive/90 hover:bg-destructive/10 h-8 w-8 sm:h-9 sm:w-9"
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
                type="text" // Keep as text for controlled input and sanitization
                value={newBillAmountRaw}
                onChange={(e) => handleAddNewBillAmountRawChange(e.target.value)}
                onBlur={handleAddNewBillAmountBlur} // Could format on blur if needed
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
                type="text" // Keep as text for controlled input
                value={incomeSourceAmountRaw}
                onChange={(e) => handleIncomeSourceAmountRawChange(e.target.value)}
                onBlur={handleIncomeSourceAmountBlur} // Could format on blur
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
          {t('home.footer.poweredByFirebase')}
        </p>
      </footer>
    </div>
  );
}

// This helps TypeScript understand that Bill objects might temporarily have rawAmountDisplay
declare module '@/types' {
    interface Bill {
        rawAmountDisplay?: string;
    }
}
