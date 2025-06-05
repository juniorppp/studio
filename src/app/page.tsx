'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Droplet, Zap, Wifi, Home, DollarSign, LineChart, AlertCircle, Loader2, Brain } from 'lucide-react';
import type { Bill, FinancialData } from '@/types';
import { getSpendingInsights } from '@/ai/flows/spending-insights';
import type { SpendingInsightsInput, SpendingInsightsOutput } from '@/ai/flows/spending-insights';
import { siteConfig } from '@/config/site';
import { AppLogo } from '@/components/app-logo';
import { useToast } from "@/hooks/use-toast";

const LOCAL_STORAGE_KEY = 'billBlissData';

const initialBills: Bill[] = [
  { id: 'water', name: 'Water Bill', icon: Droplet, amount: 0 },
  { id: 'electricity', name: 'Electricity Bill', icon: Zap, amount: 0 },
  { id: 'internet', name: 'Internet Bill', icon: Wifi, amount: 0 },
  { id: 'rent', name: 'Rent / Mortgage', icon: Home, amount: 0 },
];

export default function HomePage() {
  const [income, setIncome] = useState<number>(0);
  const [bills, setBills] = useState<Bill[]>(initialBills);
  const [insights, setInsights] = useState<string | null>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState<boolean>(false);
  const [errorInsights, setErrorInsights] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
    try {
      const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedData) {
        const parsedData: FinancialData = JSON.parse(storedData);
        setIncome(parsedData.income || 0);
        // Ensure loaded bills match initialBills structure and update amounts
        const updatedBills = initialBills.map(initialBill => {
          const storedBill = parsedData.bills.find(b => b.id === initialBill.id);
          return storedBill ? { ...initialBill, amount: storedBill.amount || 0 } : initialBill;
        });
        setBills(updatedBills);
      }
    } catch (error) {
      console.error("Failed to load data from localStorage:", error);
      toast({
        variant: "destructive",
        title: "Error loading data",
        description: "Could not load saved data. Using default values.",
      });
    }
  }, [toast]);

  useEffect(() => {
    if (isClient) {
      try {
        const dataToStore: FinancialData = { income, bills };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToStore));
      } catch (error) {
        console.error("Failed to save data to localStorage:", error);
         toast({
          variant: "destructive",
          title: "Error saving data",
          description: "Could not save data to browser storage.",
        });
      }
    }
  }, [income, bills, isClient, toast]);

  const handleIncomeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setIncome(parseFloat(event.target.value) || 0);
  };

  const handleBillAmountChange = (billId: string, amountStr: string) => {
    const amount = parseFloat(amountStr) || 0;
    setBills(prevBills =>
      prevBills.map(bill =>
        bill.id === billId ? { ...bill, amount } : bill
      )
    );
  };

  const totalExpenses = useMemo(() => {
    return bills.reduce((total, bill) => total + bill.amount, 0);
  }, [bills]);

  const remainingBalance = useMemo(() => {
    return income - totalExpenses;
  }, [income, totalExpenses]);

  const expenseRatio = useMemo(() => {
    if (income === 0) return 0;
    return Math.min((totalExpenses / income) * 100, 100); // Cap at 100%
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
      setErrorInsights("Failed to generate spending insights. Please try again.");
       toast({
        variant: "destructive",
        title: "Insight Generation Failed",
        description: "Could not generate spending insights at this time.",
      });
    } finally {
      setIsLoadingInsights(false);
    }
  }, [income, bills, toast]);
  
  if (!isClient) {
    // Render a loading state or null until the client has mounted
    // This helps avoid hydration mismatches with localStorage
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-8 bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-foreground">Loading Bill Bliss...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen p-4 sm:p-8 bg-background selection:bg-primary/20">
      <header className="w-full max-w-5xl mb-8 text-center">
        <div className="flex justify-center mb-2">
          <AppLogo />
        </div>
        <p className="text-muted-foreground font-headline">{siteConfig.description}</p>
      </header>

      <main className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Income & Bills */}
        <div className="space-y-6">
          <Card className="shadow-lg_ hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center text-2xl font-headline">
                <DollarSign className="mr-2 h-7 w-7 text-primary" />
                Your Income
              </CardTitle>
              <CardDescription>Enter your total monthly income.</CardDescription>
            </CardHeader>
            <CardContent>
              <Label htmlFor="income" className="text-sm font-medium">Total Income</Label>
              <Input
                id="income"
                type="number"
                value={income}
                onChange={handleIncomeChange}
                placeholder="e.g., 3000"
                className="mt-1 text-lg"
                aria-label="Total Income"
              />
            </CardContent>
          </Card>

          <Card className="shadow-lg_ hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center text-2xl font-headline">
                <LineChart className="mr-2 h-7 w-7 text-primary" />
                Fixed Bills
              </CardTitle>
              <CardDescription>Enter amounts for your fixed monthly bills.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {bills.map(bill => (
                <div key={bill.id} className="flex items-center space-x-3">
                  <bill.icon className="h-6 w-6 text-accent flex-shrink-0" aria-hidden="true" />
                  <Label htmlFor={bill.id} className="flex-1 text-sm font-medium">{bill.name}</Label>
                  <Input
                    id={bill.id}
                    type="number"
                    value={bill.amount}
                    onChange={(e) => handleBillAmountChange(bill.id, e.target.value)}
                    placeholder="0.00"
                    className="w-32 text-right"
                    aria-label={`${bill.name} amount`}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Summary & Insights */}
        <div className="space-y-6">
          <Card className="shadow-lg_ hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="text-2xl font-headline">Financial Summary</CardTitle>
              <CardDescription>Overview of your income and expenses.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Income:</span>
                <span className="font-semibold text-lg text-primary">${income.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Expenses:</span>
                <span className="font-semibold text-lg text-destructive">${totalExpenses.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-lg font-medium">Remaining Balance:</span>
                <span className={`font-bold text-xl ${remainingBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${remainingBalance.toFixed(2)}
                </span>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Expense Ratio ({expenseRatio.toFixed(0)}%)</Label>
                <Progress value={expenseRatio} className="w-full mt-1 h-3" indicatorClassName={expenseRatio > 80 ? "bg-destructive" : "bg-primary"} />
                 {expenseRatio > 100 && (
                    <p className="text-xs text-destructive mt-1 flex items-center">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Expenses exceed income.
                    </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg_ hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center text-2xl font-headline">
                <Brain className="mr-2 h-7 w-7 text-primary" />
                Spending Insights
              </CardTitle>
              <CardDescription>Get AI-powered insights on your spending habits.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingInsights && (
                <div className="flex items-center justify-center p-6">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="ml-3 text-muted-foreground">Generating insights...</p>
                </div>
              )}
              {errorInsights && !isLoadingInsights && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{errorInsights}</AlertDescription>
                </Alert>
              )}
              {insights && !isLoadingInsights && (
                <div className="p-4 bg-accent/20 rounded-md border border-accent/50">
                  <p className="text-sm whitespace-pre-wrap text-foreground/90">{insights}</p>
                </div>
              )}
              {!insights && !isLoadingInsights && !errorInsights && (
                 <p className="text-sm text-muted-foreground text-center py-4">Click the button below to generate personalized spending insights.</p>
              )}
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleGenerateInsights}
                disabled={isLoadingInsights}
                className="w-full"
                aria-label="Generate Spending Insights"
              >
                {isLoadingInsights ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Brain className="mr-2 h-4 w-4" />
                )}
                Generate Insights
              </Button>
            </CardFooter>
          </Card>
        </div>
      </main>
      <footer className="w-full max-w-5xl mt-12 pt-6 border-t border-border text-center">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
