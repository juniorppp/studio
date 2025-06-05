
import type { LucideIcon } from 'lucide-react';

export interface BillConfig {
  id: string;
  nameKey: string;
  defaultName: string;
  icon: LucideIcon;
}

export interface Bill {
  id: string;
  name: string; // Display name (translated or custom)
  nameKey?: string; // Translation key for predefined bills
  icon: LucideIcon;
  amount: number;
  isCustom?: boolean;
}

export interface StoredBillData {
  id: string;
  amount: number;
  name?: string; // Only for custom bills
  isCustom?: boolean;
}

// Represents data for a specific month and year
export interface MonthlyData {
  year: number;
  month: number; // 1 for January, 12 for December
  income: number;
  bills: StoredBillData[];
  // insights?: string; // Optional: store insights per month in the future
}

export type Locale = 'en' | 'pt';

// New structure for data stored in localStorage
export interface AppStorage {
  userLocale: Locale;
  defaultIncome?: number; // Default income for new months, set from settings
  allMonthlyData: MonthlyData[]; // Array of all monthly financial records
}
