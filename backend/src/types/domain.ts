export const LANGUAGES = ['en', 'hi', 'pa', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml'] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  hi: 'Hindi (हिन्दी)',
  pa: 'Punjabi (ਪੰਜਾਬੀ)',
  bn: 'Bengali (বাংলা)',
  ta: 'Tamil (தமிழ்)',
  te: 'Telugu (తెలుగు)',
  mr: 'Marathi (मराठी)',
  gu: 'Gujarati (ગુજરાતી)',
  kn: 'Kannada (ಕನ್ನಡ)',
  ml: 'Malayalam (മലയാളം)',
};

export const WORK_CATEGORIES = [
  'food_delivery',
  'ride_hailing',
  'ecommerce_delivery',
  'construction',
  'daily_wage',
  'domestic_work',
  'other',
] as const;
export type WorkCategory = (typeof WORK_CATEGORIES)[number];

export type DataSource = 'user_entered' | 'demo_sample';

export interface EarningsEntry {
  id: string;
  ownerId: string;
  date: string; // YYYY-MM-DD (worker local date)
  category: WorkCategory;
  platform?: string;
  hoursWorked: number;
  /** All money fields are rupees, max 2 decimals. */
  basePay: number;
  tips: number;
  bonuses: number;
  incentives: number;
  expenses: number;
  deductions: number;
  notes?: string;
  /** Distinguishes worker typed data from fictional demo data. No platform import exists. */
  source: DataSource;
  createdAt: string;
  updatedAt: string;
}

export type EarningsInput = Omit<
  EarningsEntry,
  'id' | 'ownerId' | 'createdAt' | 'updatedAt' | 'source'
>;

export const GRIEVANCE_TYPES = [
  'payment_delay',
  'incorrect_deduction',
  'unpaid_incentive',
  'account_suspension',
  'harassment',
  'accident',
  'other',
] as const;
export type GrievanceType = (typeof GRIEVANCE_TYPES)[number];

export interface GrievanceFacts {
  type: GrievanceType;
  platformOrEmployer: string;
  incidentDate?: string;
  amountRupees?: number;
  whatHappened: string;
  stepsAlreadyTaken?: string;
  evidenceAvailable: string[];
  desiredResolution?: string;
}

export interface GrievanceDraftContent {
  subject: string;
  /** Echo of what the worker supplied; never rewritten by AI. */
  workerFacts: GrievanceFacts;
  timeline: string[];
  evidenceChecklist: string[];
  requestedResolution: string;
  suggestedChannels: Array<{ name: string; url: string; note: string }>;
  finalMessage: string;
  aiGenerated: { subject: boolean; finalMessage: boolean; evidenceChecklist: boolean };
  disclaimer: string;
}

export interface GrievanceRecord {
  id: string;
  ownerId: string;
  language: Language;
  draft: GrievanceDraftContent;
  status: 'draft' | 'sent_by_worker' | 'resolved';
  provider: 'anthropic' | 'mock';
  createdAt: string;
  updatedAt: string;
}

/** "demo" is the shared public demonstration account: sandboxed data, no password changes. */
export type UserRole = 'user' | 'demo';

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  /** Bumped on password reset; sessions carrying an older value are rejected. */
  sessionVersion: number;
  createdAt: string;
}

/** The only user fields the API ever returns. */
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  isDemo: boolean;
}
