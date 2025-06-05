
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

export interface FinancialData {
  income: number;
  bills: StoredBillData[];
  language?: string;
}
