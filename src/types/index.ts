import type { LucideIcon } from 'lucide-react';

export interface Bill {
  id: string;
  name: string;
  icon: LucideIcon;
  amount: number;
}

export interface FinancialData {
  income: number;
  bills: Bill[];
}
