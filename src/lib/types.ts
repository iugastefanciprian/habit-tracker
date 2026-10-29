export type GoalType = "yes" | "time" | "count";
export type GoalPeriod = "daily" | "weekly";

export type HabitSchedule =
  | { type: "daily" }
  | { type: "weekdays"; weekdays: number[] }
  | { type: "timesPerWeek"; timesPerWeek: number };

export interface DailyProgress {
  value: number;
  achieved: boolean;
  /** The habit target that applied when this day was recorded. */
  target?: number;
  note?: string;
  skipped?: boolean;
}

export interface HabitReminder {
  enabled: boolean;
  /** Local time in HH:mm (24-hour). */
  time: string;
}

export interface Profile {
  id: string;
  name: string;
  avatar?: string;
  timeZone?: string;
  dayStartHour?: number;
}

export interface Habit {
  id: string;
  name: string;
  goalType: GoalType;
  required: number;
  minimum?: number;
  unit?: string;
  period: GoalPeriod;
  schedule: HabitSchedule;
  sortOrder: number;
  createdAt: string;
  completedDates: string[];
  dailyProgress: Record<string, DailyProgress>;
  archivedAt?: string;
  category?: string;
  color?: string;
  emoji?: string;
  reminder?: HabitReminder;
}

export interface HabitInput {
  name: string;
  goalType: GoalType;
  required?: number;
  minimum?: number;
  unit?: string;
  period: GoalPeriod;
  schedule?: HabitSchedule;
  category?: string;
  color?: string;
  emoji?: string;
  reminder?: HabitReminder;
  /** Local start date chosen by the client, so the habit exists "today" locally. */
  createdAt?: string;
}

/**
 * Partial habit edit. `null` clears an optional field; `undefined` leaves it
 * unchanged. Setting `archived` moves a habit to or out of the archive.
 */
export interface HabitUpdateInput {
  name?: string;
  goalType?: GoalType;
  required?: number;
  minimum?: number | null;
  unit?: string | null;
  period?: GoalPeriod;
  schedule?: HabitSchedule;
  category?: string | null;
  color?: string | null;
  emoji?: string | null;
  reminder?: HabitReminder | null;
  archived?: boolean;
}

/** Browser push subscription, as produced by `PushSubscription.toJSON()`. */
export interface WebPushSubscription {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/** Whether background reminders can be enabled and how many devices listen. */
export interface PushStatus {
  enabled: boolean;
  publicKey: string | null;
  subscriptions: number;
}

/** Profile settings the user can edit from the settings dialog. */
export interface ProfileUpdateInput {
  avatar?: string | null;
  timeZone?: string | null;
  dayStartHour?: number | null;
}

export interface ExportProfile extends Profile {
  habits: Habit[];
}

/**
 * A complete backup of every profile and habit, including archived ones.
 * Version 2 adds categories, appearance, reminders, and profile calendar
 * settings; version 1 files (without them) are still accepted on restore.
 */
export interface ExportPayload {
  version: 2;
  exportedAt: string;
  profiles: ExportProfile[];
}

/** How a restored backup is applied to the current account. */
export type RestoreMode = "merge" | "replace";

export interface RestoreSummary {
  profiles: number;
  habits: number;
  mode: RestoreMode;
}

export interface User {
  id: string;
  username: string;
}
