
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
  rawAmountDisplay?: string; // Temporary for UI editing
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

// Represents data for a specific month and year, tied to a user
export interface MonthlyData {
  _id?: string; // MongoDB ObjectId as string
  userId: string; // Foreign key to User collection
  year: number;
  month: number; // 1 for January, 12 for December
  incomeSources: IncomeSource[];
  bills: StoredBillData[];
}

export type Locale = 'en' | 'pt';

// User settings, stored in MongoDB and associated with a user
export interface UserSettings {
  _id?: string; // MongoDB ObjectId as string
  userId: string; // Foreign key to User collection
  userLocale: Locale;
  defaultIncome?: number;
  defaultIncomeSourceName?: string;
}

// User model for authentication
export interface User {
  _id?: string; // MongoDB ObjectId as string
  name: string;
  username: string; // Should be unique
  passwordHash: string;
}

// Payload for JWT
export interface UserJWTPayload {
  userId: string;
  username: string;
}

// AppStorage is deprecated, replaced by UserSettings in MongoDB
// export interface AppStorage {
//   userLocale: Locale;
//   defaultIncome?: number;
//   defaultIncomeSourceName?: string;
// }
