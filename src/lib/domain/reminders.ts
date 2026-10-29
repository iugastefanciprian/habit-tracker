import type { Habit } from "@/lib/types";
import {
  getActual,
  getDayStatus,
  isAchieved,
  isBeforeCreation,
  isScheduled,
  isWeeklyEvaluation,
} from "./habits";

export const REMINDER_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Minutes since local midnight for an `HH:mm` string, or null when invalid. */
export function parseReminderTime(time: string): number | null {
  if (!REMINDER_TIME_PATTERN.test(time)) return null;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Formats minutes since midnight back to `HH:mm`. */
export function formatReminderTime(minutes: number): string {
  const safe = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(
    safe % 60
  ).padStart(2, "0")}`;
}

/** The current wall-clock time in the profile's zone, in minutes. */
export function localMinutes(now: Date, timeZone?: string): number {
  const read = (zone?: string): number | null => {
    try {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: zone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(now);
      const hour = Number(parts.find((part) => part.type === "hour")?.value);
      const minute = Number(parts.find((part) => part.type === "minute")?.value);
      if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
      return hour * 60 + minute;
    } catch {
      return null;
    }
  };

  return (
    read(timeZone) ??
    read(undefined) ??
    now.getHours() * 60 + now.getMinutes()
  );
}

/** True when the habit is already dealt with for today, so no reminder is due. */
export function isHandledToday(habit: Habit, today: string): boolean {
  const status = getDayStatus(habit, today);
  if (status === "skipped" || status === "noted") return true;
  if (isAchieved(habit, today, today)) return true;
  return isWeeklyEvaluation(habit) && getActual(habit, today) > 0;
}

/** A reminder is due when it is enabled, its time has passed, the habit is
 * scheduled today, and the day is still open. */
export function isReminderDue(
  habit: Habit,
  today: string,
  nowMinutes: number
): boolean {
  const reminder = habit.reminder;
  if (!reminder?.enabled) return false;
  const remindAt = parseReminderTime(reminder.time);
  if (remindAt === null || nowMinutes < remindAt) return false;
  if (isBeforeCreation(habit, today)) return false;
  if (!isScheduled(habit, today)) return false;
  return !isHandledToday(habit, today);
}

/**
 * Habits whose reminder is currently due, oldest reminder first. `dismissed`
 * holds habit ids the user has already waved away for the day.
 */
export function getActiveReminders(
  habits: Habit[],
  today: string,
  nowMinutes: number,
  dismissed: Iterable<string> = []
): Habit[] {
  const hidden = new Set(dismissed);
  return habits
    .filter(
      (habit) =>
        !hidden.has(habit.id) &&
        habit.reminder?.enabled &&
        isReminderDue(habit, today, nowMinutes)
    )
    .sort((a, b) => {
      const at = parseReminderTime(a.reminder?.time ?? "") ?? 0;
      const bt = parseReminderTime(b.reminder?.time ?? "") ?? 0;
      if (at !== bt) return at - bt;
      return a.name.localeCompare(b.name);
    });
}

/** Human label such as "08:30" → "08:30"; keeps 24-hour input unambiguous. */
export function reminderLabel(habit: Habit): string | null {
  const reminder = habit.reminder;
  if (!reminder?.enabled) return null;
  return parseReminderTime(reminder.time) === null ? null : reminder.time;
}
