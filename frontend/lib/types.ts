export const LANGUAGES = [
  ['en', 'English'],
  ['hi', 'हिन्दी'],
  ['pa', 'ਪੰਜਾਬੀ'],
  ['bn', 'বাংলা'],
  ['ta', 'தமிழ்'],
  ['te', 'తెలుగు'],
  ['mr', 'मराठी'],
  ['gu', 'ગુજરાતી'],
  ['kn', 'ಕನ್ನಡ'],
  ['ml', 'മലയാളം'],
] as const;
export type Lang = (typeof LANGUAGES)[number][0];

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

export interface Provider {
  name: string;
  model: string;
  isMock: boolean;
}
export interface SourceLink {
  name: string;
  url: string;
  linkStatus: string;
  linkCheckedOn: string;
}
export interface Citation {
  id: string;
  title: string;
  scope: string;
  contentReview: string;
  limitations: string[];
  sources: SourceLink[];
}

export interface ChatResponse {
  answer: string;
  followUpQuestions: string[];
  citations: Citation[];
  couldNotVerify: boolean;
  emergency: { show: boolean; text?: string; number?: string };
  provider: Provider;
  disclaimer: string;
}
export interface Entry {
  id: string;
  date: string;
  category: WorkCategory;
  platform?: string;
  hoursWorked: number;
  basePay: number;
  tips: number;
  bonuses: number;
  incentives: number;
  expenses: number;
  deductions: number;
  notes?: string;
  source: 'user_entered' | 'demo_sample';
}
export interface Totals {
  entries: number;
  hoursWorked: number;
  gross: number;
  expenses: number;
  deductions: number;
  net: number;
  netPerHour: number | null;
  basePay: number;
  tips: number;
  bonuses: number;
  incentives: number;
}
export interface Summary {
  period: 'day' | 'week' | 'month';
  from: string;
  to: string;
  totals: Totals;
  series: Array<{ date: string; gross: number; net: number }>;
  anomalies: Array<{ entryId: string; date: string; reason: string; detail: string }>;
  formulas: { gross: string; net: string };
  dataNotice: string;
  isDemo: boolean;
}
export interface SchemeResult {
  id: string;
  name: string;
  label: string;
  benefit: string;
  eligibility: string[];
  documents: string[];
  applicationSteps: string[];
  applyUrl: string;
  availabilityNote: string;
  reasons: string[];
  cautions: string[];
  whyRelevant?: string;
  nextStep?: string;
  citation: Citation;
  dataNotice: string;
}
export interface GrievanceDraft {
  subject: string;
  timeline: string[];
  evidenceChecklist: string[];
  requestedResolution: string;
  finalMessage: string;
  disclaimer: string;
  suggestedChannels: Array<{ name: string; url: string; note: string }>;
  workerFacts: {
    whatHappened: string;
    incidentDate?: string;
    amountRupees?: number;
    platformOrEmployer: string;
    stepsAlreadyTaken?: string;
    evidenceAvailable: string[];
    desiredResolution?: string;
    type: string;
  };
  aiGenerated: { subject: boolean; finalMessage: boolean; evidenceChecklist: boolean };
}
export interface GrievanceRecord {
  id: string;
  draft: GrievanceDraft;
  status: string;
  createdAt: string;
  provider: string;
}

/** Curated record from GET /knowledge/sources (rights topics and schemes). */
export interface KnowledgeRecord {
  id: string;
  title: string;
  kind: 'rights' | 'scheme';
  scope: string;
  summary: string;
  steps: string[];
  topic?: string;
  channels: Array<{ name: string; url?: string; note: string }>;
  contentReview: string;
  limitations: string[];
  sources: SourceLink[];
}
