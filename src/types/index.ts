
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
  name?: string;
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
  year: number;
  month: number; // 1 for January, 12 for December
  incomeSources: IncomeSource[];
  bills: StoredBillData[];
}

export type Locale = 'en' | 'pt';

export interface AppStorage {
  userLocale: Locale;
  defaultIncome?: number;
  defaultIncomeSourceName?: string; // New: Custom name for the default/primary income source
  allMonthlyData: MonthlyData[];
}
