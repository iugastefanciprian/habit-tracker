import type { Habit } from "@/lib/types";
import {
  addDaysISO,
  calculateBestStreak,
  calculateStreak,
  getActual,
  getDayStatus,
  getWeekProgress,
  isAchieved,
  isDayAchieved,
  isScheduled,
  isWeeklyEvaluation,
  mondayOfWeek,
  todayISO,
} from "./habits";
import { groupHabitsByCategory } from "./categories";

export type TrendGranularity = "week" | "month";

export interface TrendRange {
  start: string;
  end: string;
  label: string;
}

export interface CompletionStats {
  /** Achieved days (daily habits) or achieved weeks (weekly habits). */
  achieved: number;
  /** Eligible days or weeks; neutral days are excluded. */
  total: number;
  /** 0–100, or 0 when the range has no eligible activity. */
  completion: number;
  hasData: boolean;
  unit: "days" | "weeks";
}

export interface TrendPoint extends CompletionStats {
  start: string;
  end: string;
  label: string;
  /** Number of habits contributing to an aggregated point. */
  habitsCounted: number;
}

export interface HabitInsight {
  habit: Habit;
  currentStreak: number;
  bestStreak: number;
  completionLast30: number;
  completionSinceCreation: number;
  trend: TrendPoint[];
}

export interface InsightsSummary {
  trackedHabits: number;
  /** Average 30-day completion across habits with eligible activity. */
  completionLast30: number;
  bestCurrentStreak: number;
  longestStreak: number;
  scheduledToday: number;
  loggedToday: number;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function monthStartISO(iso: string, offset: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 10);
}

function monthEndISO(monthStart: string): string {
  const date = new Date(`${monthStart}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
}

function weekLabel(start: string): string {
  const date = new Date(`${start}T00:00:00Z`);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

function monthLabel(start: string): string {
  const date = new Date(`${start}T00:00:00Z`);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** A single week (Monday–Sunday) or calendar month ending at `today`. */
export function getTrendRange(
  granularity: TrendGranularity,
  offset: number,
  today = todayISO()
): TrendRange {
  if (granularity === "week") {
    const start = addDaysISO(mondayOfWeek(today), offset * 7);
    return {
      start,
      end: addDaysISO(start, 6),
      label: weekLabel(start),
    };
  }

  const start = monthStartISO(today, offset);
  return {
    start,
    end: monthEndISO(start),
    label: monthLabel(start),
  };
}

/** Oldest-first ranges, ending with the period that contains `today`. */
export function getTrendRanges(
  granularity: TrendGranularity,
  count: number,
  today = todayISO()
): TrendRange[] {
  const safeCount = Math.max(1, Math.floor(count));
  return Array.from({ length: safeCount }, (_, index) =>
    getTrendRange(granularity, index - (safeCount - 1), today)
  );
}

function toCompletion(achieved: number, total: number): number {
  return total === 0 ? 0 : (achieved / total) * 100;
}

/**
 * Completion inside a range. Daily habits count scheduled days; weekly goals
 * and times-per-week schedules count eligible weeks. Both exclude neutral
 * off-schedule, skipped, note-only, and before-creation entries. Future days
 * in the current period are not counted.
 */
export function getRangeStats(
  habit: Habit,
  start: string,
  end: string,
  today = todayISO()
): CompletionStats {
  const effectiveEnd = end < today ? end : today;

  if (isWeeklyEvaluation(habit)) {
    let week = mondayOfWeek(start);
    if (week < start) week = addDaysISO(week, 7);

    let achieved = 0;
    let total = 0;
    for (; week <= effectiveEnd; week = addDaysISO(week, 7)) {
      const progress = getWeekProgress(habit, week, today);
      if (progress.status === "before" || progress.status === "skipped") {
        continue;
      }
      total += 1;
      if (progress.status === "achieved") achieved += 1;
    }

    return {
      achieved,
      total,
      completion: toCompletion(achieved, total),
      hasData: total > 0,
      unit: "weeks",
    };
  }

  let achieved = 0;
  let total = 0;
  for (let date = start; date <= effectiveEnd; date = addDaysISO(date, 1)) {
    const status = getDayStatus(habit, date);
    if (
      status === "before" ||
      status === "off" ||
      status === "skipped" ||
      status === "noted"
    ) {
      continue;
    }
    total += 1;
    if (status === "achieved") achieved += 1;
  }

  return {
    achieved,
    total,
    completion: toCompletion(achieved, total),
    hasData: total > 0,
    unit: "days",
  };
}

/** Oldest-first weekly or monthly trend for a single habit. */
export function getHabitTrend(
  habit: Habit,
  granularity: TrendGranularity,
  count: number,
  today = todayISO()
): TrendPoint[] {
  return getTrendRanges(granularity, count, today).map((range) => ({
    ...range,
    ...getRangeStats(habit, range.start, range.end, today),
    habitsCounted: 1,
  }));
}

/**
 * Average completion across habits for each period, so every habit carries
 * equal weight. Habits with no eligible activity in a period are ignored.
 */
export function getOverallTrend(
  habits: Habit[],
  granularity: TrendGranularity,
  count: number,
  today = todayISO()
): TrendPoint[] {
  return getTrendRanges(granularity, count, today).map((range) => {
    const stats = habits
      .map((habit) => getRangeStats(habit, range.start, range.end, today))
      .filter((entry) => entry.hasData);

    const completion =
      stats.length === 0
        ? 0
        : stats.reduce((sum, entry) => sum + entry.completion, 0) /
          stats.length;

    return {
      ...range,
      achieved: stats.reduce((sum, entry) => sum + entry.achieved, 0),
      total: stats.reduce((sum, entry) => sum + entry.total, 0),
      completion,
      hasData: stats.length > 0,
      unit: "days" as const,
      habitsCounted: stats.length,
    };
  });
}

export function getInsightsSummary(
  habits: Habit[],
  today = todayISO()
): InsightsSummary {
  const start30 = addDaysISO(today, -29);
  const stats = habits
    .map((habit) => getRangeStats(habit, start30, today, today))
    .filter((entry) => entry.hasData);

  const completionLast30 =
    stats.length === 0
      ? 0
      : stats.reduce((sum, entry) => sum + entry.completion, 0) /
        stats.length;

  const scheduled = habits.filter((habit) => isScheduled(habit, today));
  const logged = scheduled.filter((habit) =>
    isWeeklyEvaluation(habit)
      ? getActual(habit, today) > 0 || isAchieved(habit, today, today)
      : isDayAchieved(habit, today)
  );

  return {
    trackedHabits: habits.length,
    completionLast30,
    bestCurrentStreak:
      habits.length === 0
        ? 0
        : Math.max(...habits.map((habit) => calculateStreak(habit, today))),
    longestStreak:
      habits.length === 0
        ? 0
        : Math.max(...habits.map((habit) => calculateBestStreak(habit, today))),
    scheduledToday: scheduled.length,
    loggedToday: logged.length,
  };
}

/** Bundle the per-habit cards shown on the insights page. */
export function getHabitInsights(
  habits: Habit[],
  granularity: TrendGranularity,
  count: number,
  today = todayISO()
): HabitInsight[] {
  const start30 = addDaysISO(today, -29);

  return habits.map((habit) => ({
    habit,
    currentStreak: calculateStreak(habit, today),
    bestStreak: calculateBestStreak(habit, today),
    completionLast30: getRangeStats(habit, start30, today, today).completion,
    completionSinceCreation: getRangeStats(
      habit,
      habit.createdAt,
      today,
      today
    ).completion,
    trend: getHabitTrend(habit, granularity, count, today),
  }));
}

export interface WeekdayInsight {
  /** 0 = Sunday … 6 = Saturday, matching Date. */
  weekday: number;
  label: string;
  achieved: number;
  total: number;
  completion: number;
  hasData: boolean;
}

export interface CategoryInsight {
  category: string | null;
  label: string;
  habits: number;
  tracked: number;
  completion: number;
  hasData: boolean;
}

export interface ReviewPeriod {
  start: string;
  end: string;
  label: string;
  completion: number;
  achieved: number;
  total: number;
  habitsTracked: number;
  /** Days still to come in the current period, excluding today. */
  daysLeft: number;
  hasData: boolean;
}

export interface HabitRank {
  habit: Habit;
  completion: number;
}

export interface InsightsReview {
  week: ReviewPeriod;
  month: ReviewPeriod;
  strongest: HabitRank | null;
  weakest: HabitRank | null;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0] as const;

function daysBetweenISO(start: string, end: string): number {
  const ms =
    new Date(`${end}T00:00:00Z`).getTime() -
    new Date(`${start}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Weekly and monthly review of the period containing `today`, with the
 * strongest and weakest habit by month completion.
 */
export function getInsightsReview(
  habits: Habit[],
  today = todayISO()
): InsightsReview {
  const summarize = (granularity: TrendGranularity): ReviewPeriod => {
    const range = getTrendRange(granularity, 0, today);
    const stats = habits
      .map((habit) => getRangeStats(habit, range.start, range.end, today))
      .filter((entry) => entry.hasData);

    return {
      ...range,
      completion:
        stats.length === 0
          ? 0
          : stats.reduce((sum, entry) => sum + entry.completion, 0) /
            stats.length,
      achieved: stats.reduce((sum, entry) => sum + entry.achieved, 0),
      total: stats.reduce((sum, entry) => sum + entry.total, 0),
      habitsTracked: stats.length,
      daysLeft: Math.max(0, daysBetweenISO(today, range.end)),
      hasData: stats.length > 0,
    };
  };

  const month = getTrendRange("month", 0, today);
  const ranked = habits
    .map((habit) => ({
      habit,
      stats: getRangeStats(habit, month.start, month.end, today),
    }))
    .filter((entry) => entry.stats.hasData)
    .map((entry) => ({ habit: entry.habit, completion: entry.stats.completion }))
    .sort(
      (a, b) =>
        b.completion - a.completion || a.habit.name.localeCompare(b.habit.name)
    );

  const strongest = ranked[0]
    ? { habit: ranked[0].habit, completion: ranked[0].completion }
    : null;
  const weakest =
    ranked.length > 1
      ? {
          habit: ranked[ranked.length - 1].habit,
          completion: ranked[ranked.length - 1].completion,
        }
      : null;

  return {
    week: summarize("week"),
    month: summarize("month"),
    strongest,
    weakest,
  };
}

/**
 * Completion by weekday across daily habits. Weekly goals are excluded because
 * their unit is the week, not the day. Returned Monday-first.
 */
export function getWeekdayInsights(
  habits: Habit[],
  today = todayISO(),
  lookbackDays = 90
): WeekdayInsight[] {
  const safeDays = Math.max(1, Math.floor(lookbackDays));
  const start = addDaysISO(today, -(safeDays - 1));
  const buckets = new Map<number, { achieved: number; total: number }>();

  for (const habit of habits) {
    if (isWeeklyEvaluation(habit)) continue;
    for (let date = start; date <= today; date = addDaysISO(date, 1)) {
      const status = getDayStatus(habit, date);
      if (
        status === "before" ||
        status === "off" ||
        status === "skipped" ||
        status === "noted"
      ) {
        continue;
      }
      const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
      const bucket = buckets.get(weekday) ?? { achieved: 0, total: 0 };
      bucket.total += 1;
      if (status === "achieved") bucket.achieved += 1;
      buckets.set(weekday, bucket);
    }
  }

  return MONDAY_FIRST.map((weekday) => {
    const bucket = buckets.get(weekday) ?? { achieved: 0, total: 0 };
    return {
      weekday,
      label: WEEKDAY_LABELS[weekday],
      achieved: bucket.achieved,
      total: bucket.total,
      completion: toCompletion(bucket.achieved, bucket.total),
      hasData: bucket.total > 0,
    };
  });
}

/**
 * Completion by category over the last `days` days, averaging each habit with
 * activity so a category with many habits does not dominate.
 */
export function getCategoryInsights(
  habits: Habit[],
  today = todayISO(),
  days = 30
): CategoryInsight[] {
  const safeDays = Math.max(1, Math.floor(days));
  const start = addDaysISO(today, -(safeDays - 1));

  return groupHabitsByCategory(habits).map((group) => {
    const stats = group.habits
      .map((habit) => getRangeStats(habit, start, today, today))
      .filter((entry) => entry.hasData);

    return {
      category: group.category,
      label: group.label,
      habits: group.habits.length,
      tracked: stats.length,
      completion:
        stats.length === 0
          ? 0
          : stats.reduce((sum, entry) => sum + entry.completion, 0) /
            stats.length,
      hasData: stats.length > 0,
    };
  });
}
