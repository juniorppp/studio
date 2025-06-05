
import type { LucideIcon } from 'lucide-react';

export interface BillConfig {
  id: string;
  nameKey: string;
  defaultName: string;
  icon: LucideIcon;
}

export interface Bill {
  id: string;
  name: string;
  nameKey?: string;
  icon: LucideIcon;
  amount: number;
  isCustom?: boolean;
  incomeSourceId?: string; // ID of the income source paying this bill
}

export interface StoredBillData {
  id: string;
  amount: number;
  name?: string; // Used if isCustom is true
  nameKey?: string; // Used if !isCustom to find translated name
  isCustom?: boolean;
  incomeSourceId?: string;
}

export interface IncomeSource {
  id: string;
  name: string;
  amount: number;
}

// Represents data for a specific month and year
export interface MonthlyData {
  _id?: string; // MongoDB ObjectId as string
  year: number;
  month: number; // 1 for January, 12 for December
  incomeSources: IncomeSource[];
  bills: StoredBillData[];
}

export type Locale = 'en' | 'pt';

// AppStorage now primarily handles user settings stored in localStorage.
// Monthly financial data is managed via MongoDB.
export interface AppStorage {
  userLocale: Locale;
  defaultIncome?: number;
  defaultIncomeSourceName?: string;
  // allMonthlyData: MonthlyData[]; // This is now removed and handled by MongoDB
}
