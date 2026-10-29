import type {
  DailyProgress,
  GoalPeriod,
  GoalType,
  HabitReminder,
  HabitSchedule,
} from "@/lib/types";

export interface UserDoc {
  _id: string;
  username: string;
  createdAt: string;
}

export interface ProfileDoc {
  _id: string;
  userId: string;
  name: string;
  avatar?: string;
  timeZone?: string;
  dayStartHour?: number;
  createdAt: string;
}

export interface PushSubscriptionDoc {
  _id: string;
  userId: string;
  profileId: string;
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
  createdAt: string;
}

/**
 * One row per habit-day notified by the cron job. The unique index makes the
 * reminder job idempotent when it runs more often than once per day.
 */
export interface ReminderDeliveryDoc {
  _id?: string;
  userId: string;
  profileId: string;
  habitId: string;
  date: string;
  sentAt: Date;
}

export interface HabitDoc {
  _id: string;
  userId: string;
  profileId: string;
  name: string;
  goalType: GoalType;
  required: number;
  minimum?: number;
  unit?: string;
  period: GoalPeriod;
  /** Optional on legacy documents; readers default to a daily schedule. */
  schedule?: HabitSchedule;
  sortOrder?: number;
  createdAt: string;
  completedDates: string[];
  dailyProgress: Record<string, DailyProgress>;
  archivedAt?: string;
  category?: string;
  color?: string;
  emoji?: string;
  reminder?: HabitReminder;
}
