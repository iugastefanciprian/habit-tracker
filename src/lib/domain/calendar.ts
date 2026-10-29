import type { Habit } from "@/lib/types";
import {
  addDaysISO,
  getDayStatus,
  isAchieved,
  isBeforeCreation,
  isScheduled,
  todayISO,
} from "./habits";

/** Normalizes any date or month to the first day of its month. */
export function monthOf(dateISO: string): string {
  return `${dateISO.slice(0, 7)}-01`;
}

export function addMonths(monthISO: string, delta: number): string {
  const date = new Date(`${monthOf(monthISO)}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 10);
}

export function monthLabel(monthISO: string): string {
  return new Date(`${monthOf(monthISO)}T00:00:00Z`).toLocaleDateString(
    undefined,
    { month: "long", year: "numeric", timeZone: "UTC" }
  );
}

export interface MonthDay {
  date: string;
  inMonth: boolean;
}

/**
 * A six-row month grid (42 cells) beginning on `weekStartsOn` (1 = Monday).
 * Leading and trailing cells belong to the neighbouring months and are
 * flagged with `inMonth: false`.
 */
export function getMonthMatrix(
  monthISO: string,
  weekStartsOn: 0 | 1 = 1
): MonthDay[][] {
  const first = monthOf(monthISO);
  const firstDate = new Date(`${first}T00:00:00Z`);
  const weekday = firstDate.getUTCDay();
  const offset = (weekday - weekStartsOn + 7) % 7;
  const gridStart = addDaysISO(first, -offset);

  const weeks: MonthDay[][] = [];
  for (let week = 0; week < 6; week++) {
    const days: MonthDay[] = [];
    for (let day = 0; day < 7; day++) {
      const date = addDaysISO(gridStart, week * 7 + day);
      days.push({ date, inMonth: date.slice(0, 7) === first.slice(0, 7) });
    }
    weeks.push(days);
  }
  return weeks;
}

/** Month starts oldest-first, ending with the month containing `today`. */
export function getTrailingMonths(today: string, count = 12): string[] {
  const safeCount = Math.max(1, Math.floor(count));
  const current = monthOf(today);
  return Array.from({ length: safeCount }, (_, index) =>
    addMonths(current, index - (safeCount - 1))
  );
}

export interface DayOverview {
  /** Scheduled habits that were not skipped. The completion denominator. */
  scheduled: number;
  /** Scheduled habits whose evaluation period is achieved. */
  kept: number;
  /** Scheduled habits with any value or note recorded that day. */
  logged: number;
  skipped: number;
  /** Active habits that do not expect an entry that day. */
  off: number;
  /** 0–100; 0 when nothing was scheduled. */
  completion: number;
  hasData: boolean;
}

/**
 * Aggregate view of one day across habits. Uses the same rules as the rest of
 * the app: skipped and off-schedule habits are neutral, and weekly habits
 * count as kept when their week is complete.
 */
export function getDayOverview(
  habits: Habit[],
  date: string,
  today = todayISO()
): DayOverview {
  let scheduled = 0;
  let kept = 0;
  let logged = 0;
  let skipped = 0;
  let off = 0;

  for (const habit of habits) {
    if (isBeforeCreation(habit, date)) continue;
    if (!isScheduled(habit, date)) {
      off += 1;
      continue;
    }
    const status = getDayStatus(habit, date);
    if (status === "skipped") {
      skipped += 1;
      continue;
    }
    // A note without a value is neutral, exactly as it is for streaks and
    // percentages, so it stays out of the completion denominator.
    if (status === "noted") continue;

    scheduled += 1;
    if (status !== "empty") logged += 1;
    if (isAchieved(habit, date, today)) kept += 1;
  }

  return {
    scheduled,
    kept,
    logged,
    skipped,
    off,
    completion: scheduled === 0 ? 0 : (kept / scheduled) * 100,
    hasData: scheduled > 0,
  };
}

/** Whether a habit is allowed to record an entry on `date`. */
export function canEditDay(habit: Habit, date: string, today: string): boolean {
  return date <= today && !isBeforeCreation(habit, date);
}
