export type FlowIntensity = 'light' | 'medium' | 'heavy' | 'spotting' | null;

// Big 5 Menstrual Moods - covers 95% of cycle-related mood shifts
export type MoodType = 'energetic' | 'calm' | 'sad' | 'anxious' | 'irritable' | null;

export interface MoodOptionConfig {
  id: string;
  labelKey: string;
  color: string;
  dark: string;
  shadow: string;
  emoji: string;
}

export const MOOD_OPTIONS: MoodOptionConfig[] = [
  { id: 'energetic', labelKey: 'log.mood_energetic', color: '#f59e0b', dark: '#92400e', shadow: 'rgba(245, 158, 11, 0.4)', emoji: '⚡' },
  { id: 'calm', labelKey: 'log.mood_calm', color: '#7598a0', dark: '#2f4b52', shadow: 'rgba(117, 152, 160, 0.4)', emoji: '😌' },
  { id: 'happy', labelKey: 'log.mood_happy', color: '#34d399', dark: '#065f46', shadow: 'rgba(52, 211, 153, 0.4)', emoji: '😊' },
  { id: 'confident', labelKey: 'log.mood_confident', color: '#a78bfa', dark: '#4c1d95', shadow: 'rgba(167, 139, 250, 0.4)', emoji: '💪' },
  { id: 'focused', labelKey: 'log.mood_focused', color: '#60a5fa', dark: '#1e3a5f', shadow: 'rgba(96, 165, 250, 0.4)', emoji: '🎯' },
  { id: 'tired', labelKey: 'log.mood_tired', color: '#94a3b8', dark: '#334155', shadow: 'rgba(148, 163, 184, 0.4)', emoji: '😴' },
  { id: 'foggy', labelKey: 'log.mood_foggy', color: '#a1a1aa', dark: '#3f3f46', shadow: 'rgba(161, 161, 170, 0.4)', emoji: '🌫️' },
  { id: 'sad', labelKey: 'log.mood_sad', color: '#9BA4CC', dark: '#3b4263', shadow: 'rgba(155, 164, 204, 0.4)', emoji: '😔' },
  { id: 'anxious', labelKey: 'log.mood_anxious', color: '#f97316', dark: '#9a3412', shadow: 'rgba(249, 115, 22, 0.4)', emoji: '😰' },
  { id: 'irritable', labelKey: 'log.mood_irritable', color: '#fb7185', dark: '#9f1239', shadow: 'rgba(251, 113, 133, 0.4)', emoji: '😠' },
];

// Fertility & Libido Tracking
export type DischargeType = 'dry' | 'sticky_creamy' | 'egg_white' | 'unusual' | null;
export type SexDriveType = 'high' | 'medium' | 'low' | null;
export type SexType = 'protected' | 'unprotected' | null;

export interface DailyLog {
  date: string; // ISO YYYY-MM-DD
  flow: FlowIntensity;
  symptoms: string[];
  notes: string;
  mood?: MoodType;
  discharge?: DischargeType;
  sexDrive?: SexDriveType;
  sexType?: SexType;
  // --- Medical Flags ---
  isWithdrawalBleeding?: boolean; // Tagged if on birth control during log
  ignoreForAverages?: boolean;   // Manual override for outliers (miscarriage, stress, etc)

}

// Replica Logic Types
export interface Period {
  mensesStart: string; // YYYY-MM-DD
  mensesLength: number; // days (can be negative for unknown/default)
  periodLength: number; // cycle length in days
  isPregnancy: boolean;
  uid?: string;
  // Computed helpers for ease of use
  effectiveBleedingDays: number;
}


// Explicit Cycle Management
export interface PeriodRecord {
  id: string; // UUID v4 or ISO date of start
  startDate: string; // YYYY-MM-DD
  days: number; // Stored duration
  cycleLength?: number; // Stored cycle length (optional for migration)
  activeDays?: number[]; // indices relative to startDate that actually have bleeding
  isWithdrawalBleed?: boolean; // Tagged if created while on birth control
  ignoreForAverages?: boolean; // Manual override for outlier cycles (miscarriage, stress, etc)
}

export interface Cycle {
  startDate: string;
  endDate?: string;
  length?: number;
  periodLength?: number; // Count of actual bleeding days (activeDays.length)
  spanDays?: number;     // Full span from start to end (includes skip days)
  /** True if 21 <= length <= 60 (used for averages and fertile display) */
  isValid?: boolean;
  /** True if length > 60 (tracking gap; exclude from averages, hide fertile in UI) */
  isOutlier?: boolean;
  /** True if period was logged while on birth control (exclude from natural cycle stats) */
  isWithdrawalBleed?: boolean;
  /** Manual override to exclude this cycle from adaptive predictions */
  ignoreForAverages?: boolean;
  // Computed Fertile Window (for historical display)
  ovulationDate?: string;
  fertileStart?: string;
  fertileEnd?: string;
}

export interface SymptomConfig {
  id: string;
  label: string;
  isHidden: boolean;
}

export interface AppSettings {
  // Security Feature: Disguises app as Task Manager
  discreteMode: boolean;
  darkNeumorphism?: boolean;

  userName: string;
  pin?: string;
  lockTimeout?: 0 | 30 | 120; // seconds before re-locking after backgrounding; 0 = immediate
  onboardingCompleted?: boolean;
  adaptivePrediction?: boolean; // If true, derive cycle/period length from history

  // Edge Case Settings
  predictionsPaused: boolean; // Pause predictions (covers pregnancy, irregular cycles, etc.)
  isOnBirthControl: boolean;  // If true, hide fertile window and tag bleeds as withdrawal
  historyArchivedDate?: string;

  // New Configs
  symptoms: SymptomConfig[];

  // --- Prediction Settings (user-defined, no adaptive) ---
  cycleLength: number;            // User's typical cycle length (default: 28)
  periodLength: number;           // User's typical period length (default: 5)
  lutealPhaseLength: number;      // Days from ovulation to period (default: 14)
  pmsLength: number;              // Days before period for PMS warning (default: 3)
  showFertileWindow: boolean;     // Whether to display fertile window
  autoCreatePeriods?: boolean;    // Auto-create period when flow is logged

  // Notification / Reminder toggles
  reminderPeriodStart?: boolean;
  reminderPeriodEnd?: boolean;
  reminderPeriodInput?: boolean;
  reminderFertility?: boolean;
  reminderOvulation?: boolean;
  reminderDailyLog?: boolean;
  // Reminder times (HH:mm, 24h) – shown when corresponding toggle is on
  reminderPeriodStartTime?: string;
  reminderPeriodEndTime?: string;
  reminderPeriodInputTime?: string;
  reminderFertilityTime?: string;
  reminderOvulationTime?: string;
  reminderDailyLogTime?: string;

  // Smart Reminders
  reminderPMS?: boolean; // 3 days before
  reminderPMSTime?: string;
  reminderPeriodLate?: boolean; // Late period prompt
  reminderPeriodLateTime?: string;

  showPMS?: boolean; // Show PMS warning zone on calendar

  // Pill / Birth Control Reminders
  reminderPillDaily?: boolean;
  reminderPillDailyTime?: string;

  // Global Behaviour
  reminderGentleMode?: boolean; // If true, suppress notifications if app used recently, etc.
}

const BIG_6 = [
  'Cramps', 'Headache', 'Bloating', 'Tenderness', 'Fatigue', 'Acne'
];

const BODY_GUT = [
  'Backache', 'Nausea', 'Digestion', 'Insomnia', 'Cravings'
];

export const SYMPTOM_GROUPS = {
  BIG_6: BIG_6.map(s => s.toLowerCase()),
  BODY_GUT: BODY_GUT.map(s => s.toLowerCase())
};

const ALL_DEFAULT_SYMPTOMS = [...BIG_6, ...BODY_GUT];

export const INITIAL_SYMPTOMS: SymptomConfig[] = ALL_DEFAULT_SYMPTOMS.map(s => ({
  id: s.toLowerCase(),
  label: s,
  isHidden: false
}));


export interface PredictionResults {
  lastPeriodStart: string | null;
  periodLength: number;
  cycleLengthUsed: number;
  effective: {
    cycleLength: number;
    periodLength: number;
    source: 'settings' | 'adaptive';
  };
  userSettings: {
    cycleLength: number;
    periodLength: number;
  };
  nextPeriodStart: string | null;
  nextPeriodEnd: string | null;
  fertileWindow: {
    start: string;
    end: string;
  } | null;
  ovulationDate: string | null;
  pmsWindow: {
    start: string;
    end: string;
  } | null;
  healthStatus: string;
  currentEventDays?: number;
  futurePredictions?: {
    startDate: string;
    endDate: string;
    ovulationDate: string | null;
    fertileStart: string | null;
    fertileEnd: string | null;
    pmsStart: string;
    pmsEnd: string;
  }[];
}

export interface BackupData {
  data: Record<string, DailyLog>;
  settings: AppSettings;
  timestamp: string;
  periods?: PeriodRecord[];
}

export interface DayMeta {
  date: string;
  isToday: boolean;
  isValidMonth: boolean; // Computed by Calendar, but meta can know it if provided month context
  // Status
  isPeriod: boolean; // Inside the period span
  isBleeding: boolean; // Actually had bleeding (respects activeDays)
  isCycleStart?: boolean; // New cycle start
  isSpotting: boolean;
  dayOfPeriod?: number;
  isForecastPeriod: boolean; // Predicted
  isFertile: boolean;
  isOvulation: boolean;
  isPMS: boolean;
  isWithdrawalBleed?: boolean;
  isUnavailableFuture?: boolean;
  // Visuals
  intensity?: FlowIntensity;
  symptoms?: string[];
  mood?: string | null;
  /** Header (Dashboard state for the day, typically consumed for Today) */
  header?: {
    title: string;
    subtitle: string;
    statusVariant?: 'neutral' | 'warning' | 'primary' | 'success' | 'info' | 'secondary';
    chance?: string;
    chanceVariant?: 'low' | 'medium' | 'high' | 'peak';
    // Metadata for the header specifically
    dayOfCycle?: number;
    cycleLength?: number;
    dayOfPeriod?: number;
    periodLength?: number;
  };
}
