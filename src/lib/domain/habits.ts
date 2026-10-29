import type { DailyProgress, Habit, HabitSchedule, Profile } from "../types";

/**
 * Formats a point in time as a calendar date in the given time zone.
 * `dayStartHour` shifts the boundary (for example 4 means the new day starts
 * at 04:00 local time).
 */
export function dateISOInTimeZone(
  date: Date,
  timeZone?: string,
  dayStartHour = 0
): string {
  const shifted = new Date(date.getTime() - dayStartHour * 3_600_000);
  const zone = timeZone?.trim() || undefined;

  const format = (tz?: string): string | null => {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(shifted);
      const pick = (type: string) =>
        parts.find((part) => part.type === type)?.value;
      const year = pick("year");
      const month = pick("month");
      const day = pick("day");
      return year && month && day ? `${year}-${month}-${day}` : null;
    } catch {
      return null;
    }
  };

  return format(zone) ?? format(undefined) ?? shifted.toISOString().slice(0, 10);
}

export function todayISO(timeZone?: string, dayStartHour = 0): string {
  return dateISOInTimeZone(new Date(), timeZone, dayStartHour);
}

export function todayForProfile(
  profile: Pick<Profile, "timeZone" | "dayStartHour">
): string {
  return todayISO(profile.timeZone, profile.dayStartHour ?? 0);
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

function diffDays(a: string, b: string): number {
  const ms = new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime();
  return Math.round(ms / 86400000);
}

function daysBetween(a: string, b: string): number {
  return diffDays(a, b) + 1; // inclusive
}

function dayOfWeek(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

export function getSchedule(habit: Habit): HabitSchedule {
  return habit.schedule ?? { type: "daily" };
}

/**
 * Weekly goals and "times per week" schedules are evaluated as weeks rather
 * than as individual days. Daily goals with daily/weekday schedules stay
 * day-based.
 */
export function isWeeklyEvaluation(habit: Habit): boolean {
  return habit.period === "weekly" || getSchedule(habit).type === "timesPerWeek";
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function describeSchedule(schedule: HabitSchedule): string {
  switch (schedule.type) {
    case "weekdays": {
      const order = [1, 2, 3, 4, 5, 6, 0];
      const labels = [...new Set(schedule.weekdays)]
        .sort((a, b) => order.indexOf(a) - order.indexOf(b))
        .map((day) => WEEKDAY_LABELS[day])
        .filter(Boolean);
      return labels.length > 0 ? labels.join(", ") : "No days";
    }
    case "timesPerWeek":
      return `${schedule.timesPerWeek}× per week`;
    default:
      return "Every day";
  }
}

/** Stable display order: manual position, then creation date, then id. */
export function compareHabits(a: Habit, b: Habit): number {
  const order = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  if (order !== 0) return order;
  const created = a.createdAt.localeCompare(b.createdAt);
  if (created !== 0) return created;
  return a.id.localeCompare(b.id);
}

export function sortHabits(habits: Habit[]): Habit[] {
  return [...habits].sort(compareHabits);
}

/** Whether the habit expects an entry on this date. */
export function isScheduled(habit: Habit, date: string): boolean {
  const schedule = getSchedule(habit);
  switch (schedule.type) {
    case "weekdays":
      return schedule.weekdays.includes(dayOfWeek(date));
    case "timesPerWeek":
      return true;
    default:
      return true;
  }
}

/** The target that applied on `date`, falling back to the habit's current one. */
export function getTarget(habit: Habit, date: string): number {
  const snapshot = habit.dailyProgress[date]?.target;
  return typeof snapshot === "number" && snapshot > 0 ? snapshot : habit.required;
}

export function hasDayEntry(habit: Habit, date: string): boolean {
  return (
    habit.dailyProgress[date] !== undefined ||
    habit.completedDates.includes(date)
  );
}

/** A note saved without a value; neutral rather than a missed day. */
export function isNoteOnly(habit: Habit, date: string): boolean {
  const entry = habit.dailyProgress[date];
  return (
    entry !== undefined &&
    entry.value <= 0 &&
    !entry.skipped &&
    Boolean(entry.note?.trim())
  );
}

export function getActual(habit: Habit, date: string): number {
  if (habit.goalType === "yes") {
    return habit.completedDates.includes(date) ? 1 : 0;
  }
  return habit.dailyProgress[date]?.value ?? 0;
}

export function getRatio(habit: Habit, date: string): number {
  const target = getTarget(habit, date);
  if (target <= 0) return 0;
  return getActual(habit, date) / target;
}

function getMinRatio(habit: Habit, date: string): number {
  const target = getTarget(habit, date);
  if (target <= 0 || habit.minimum === undefined) return 0;
  return habit.minimum / target;
}

export type DayStatus =
  | "before"
  | "off"
  | "empty"
  | "skipped"
  | "noted"
  | "logged"
  | "achieved"
  | "partial"
  | "failed";

/**
 * Single source of truth for how a single day should be interpreted.
 * Colors, streaks, percentages, and the UI all derive from this.
 *
 * Weekly goals are evaluated by week, so a recorded day is only "logged"
 * toward that week. "Times per week" schedules keep day-level statuses.
 */
export function getDayStatus(habit: Habit, date: string): DayStatus {
  if (isBeforeCreation(habit, date)) return "before";
  if (!isScheduled(habit, date)) return "off";

  const entry = habit.dailyProgress[date];
  if (entry?.skipped) return "skipped";
  if (isNoteOnly(habit, date)) return "noted";
  if (!hasDayEntry(habit, date)) return "empty";
  if (habit.period === "weekly") return "logged";
  if (isDayAchieved(habit, date)) return "achieved";
  if (isDayFailed(habit, date)) return "failed";
  return "partial";
}

/** Whether the entry on this day met that day's target. */
export function isDayAchieved(habit: Habit, date: string): boolean {
  const target = getTarget(habit, date);
  if (target <= 0) return false;
  return getActual(habit, date) >= target;
}

/** Whether the day fell below its minimum (or had no progress). */
export function isDayFailed(habit: Habit, date: string): boolean {
  const ratio = getRatio(habit, date);
  if (habit.goalType === "yes") return ratio < 1;
  const minRatio = getMinRatio(habit, date);
  return ratio === 0 || ratio < minRatio;
}

/**
 * Completion for the date's evaluation period. Weekly goals and
 * "times per week" schedules report whether the whole week is complete.
 */
export function isAchieved(
  habit: Habit,
  date: string,
  today = todayISO()
): boolean {
  if (!isWeeklyEvaluation(habit)) return isDayAchieved(habit, date);
  return getWeekProgress(habit, mondayOfWeek(date), today).status === "achieved";
}

/** Failure for the date's evaluation period; the current week never fails early. */
export function isFailed(
  habit: Habit,
  date: string,
  today = todayISO()
): boolean {
  if (!isWeeklyEvaluation(habit)) return isDayFailed(habit, date);
  return getWeekProgress(habit, mondayOfWeek(date), today).status === "failed";
}

export type HabitDayColor =
  | "none"
  | "off"
  | "skipped"
  | "noted"
  | "logged"
  | "black"
  | "red"
  | "orange"
  | "yellow"
  | "blue"
  | "green";

export function isBeforeCreation(habit: Habit, date: string): boolean {
  return date < habit.createdAt;
}

export function clampToCreation(habit: Habit, date: string): string {
  return isBeforeCreation(habit, date) ? habit.createdAt : date;
}

export function habitAgeDays(habit: Habit, today = todayISO()): number {
  if (habit.createdAt > today) return 0;
  return daysBetween(habit.createdAt, today);
}

export interface HabitDay {
  date: string;
  beforeCreation: boolean;
}

/**
 * Returns the last `days` calendar days, newest first (today first).
 * Days before the habit existed are flagged so callers can omit them.
 */
export function getDaysWindow(
  habit: Habit,
  days = 30,
  today = todayISO()
): HabitDay[] {
  const window: HabitDay[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDaysISO(today, -i);
    window.push({ date, beforeCreation: isBeforeCreation(habit, date) });
  }
  return window;
}

export function getDayColor(habit: Habit, date: string): HabitDayColor {
  const status = getDayStatus(habit, date);
  switch (status) {
    case "before":
      return "none";
    case "off":
      return "off";
    case "skipped":
      return "skipped";
    case "noted":
      return "noted";
    case "logged":
      return "logged";
    case "empty":
    case "failed":
      return "black";
    case "achieved":
      return "green";
    case "partial": {
      const pct = getRatio(habit, date) * 100;
      if (pct < 25) return "red";
      if (pct < 50) return "orange";
      if (pct < 75) return "yellow";
      return "blue";
    }
  }
}

export interface DayValueOptions {
  /**
   * `undefined` keeps the existing note, `null` clears it, and a string sets
   * it. Whitespace-only notes are treated as empty.
   */
  note?: string | null;
  skipped?: boolean;
}

/**
 * Returns a copy of the habit with a single day's value set.
 * `null` (or any non-positive value) clears that day's value.
 * A note and/or skip keeps a neutral zero-value entry; without either, the
 * day is removed entirely. The habit's target is snapshotted onto the entry
 * so later goal changes never rewrite history.
 */
export function withDayValue(
  habit: Habit,
  date: string,
  value: number | null,
  options: DayValueOptions = {}
): Habit {
  if (isBeforeCreation(habit, date)) return habit;

  const existing = habit.dailyProgress[date];
  const dailyProgress: Record<string, DailyProgress> = { ...habit.dailyProgress };
  let completedDates = habit.completedDates;
  const target = existing?.target ?? habit.required;
  const rawNote = options.note === undefined ? existing?.note : options.note;
  const note = rawNote?.trim() ? rawNote.trim() : undefined;

  if (value === null || value <= 0) {
    if (options.skipped || note !== undefined) {
      dailyProgress[date] = {
        value: 0,
        achieved: false,
        target,
        ...(note !== undefined ? { note } : {}),
        ...(options.skipped ? { skipped: true } : {}),
      };
      completedDates = completedDates.filter((d) => d !== date);
    } else {
      delete dailyProgress[date];
      completedDates = completedDates.filter((d) => d !== date);
    }
    return { ...habit, dailyProgress, completedDates };
  }

  const achieved = habit.goalType === "yes" ? value >= 1 : value >= target;
  dailyProgress[date] = {
    value,
    achieved,
    target,
    ...(note !== undefined ? { note } : {}),
    ...(options.skipped ? { skipped: true } : {}),
  };
  completedDates = achieved
    ? completedDates.includes(date)
      ? completedDates
      : [...completedDates, date]
    : completedDates.filter((d) => d !== date);

  return { ...habit, dailyProgress, completedDates };
}

/**
 * Consecutive scheduled days achieved, ending today (or yesterday when today
 * is not achieved yet). Off-schedule and skipped days are neutral.
 */
export function calculateStreak(habit: Habit, today = todayISO()): number {
  if (habit.createdAt > today) return 0;
  if (isWeeklyEvaluation(habit)) return weeklyStreak(habit, today);

  let cursor = isDayAchieved(habit, today) ? today : addDaysISO(today, -1);
  let streak = 0;
  const limit = habitAgeDays(habit, today) + 2;

  for (let i = 0; i < limit && cursor >= habit.createdAt; i++) {
    const status = getDayStatus(habit, cursor);
    if (status === "off" || status === "skipped" || status === "noted") {
      cursor = addDaysISO(cursor, -1);
      continue;
    }
    if (status !== "achieved") break;
    streak++;
    cursor = addDaysISO(cursor, -1);
  }

  return streak;
}

/**
 * Longest run of consecutive achieved days (or weeks for weekly habits),
 * ignoring off-schedule, skipped, and note-only days.
 */
export function calculateBestStreak(habit: Habit, today = todayISO()): number {
  if (habit.createdAt > today) return 0;
  if (isWeeklyEvaluation(habit)) return bestWeeklyStreak(habit, today);

  let best = 0;
  let current = 0;
  for (
    let date = habit.createdAt;
    date <= today;
    date = addDaysISO(date, 1)
  ) {
    const status = getDayStatus(habit, date);
    if (status === "off" || status === "skipped" || status === "noted") continue;
    if (status === "achieved") {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }
  return best;
}

function weeklyStreak(habit: Habit, today: string): number {
  const first = mondayOfWeek(habit.createdAt);
  let cursor = mondayOfWeek(today);

  // A current week that is not complete yet does not break a streak.
  if (getWeekProgress(habit, cursor, today).status !== "achieved") {
    cursor = addDaysISO(cursor, -7);
  }

  let streak = 0;
  const limit = Math.ceil(habitAgeDays(habit, today) / 7) + 2;

  for (let i = 0; i < limit && cursor >= first; i++) {
    const progress = getWeekProgress(habit, cursor, today);
    if (progress.status === "skipped") {
      cursor = addDaysISO(cursor, -7);
      continue;
    }
    if (progress.status !== "achieved") break;
    streak++;
    cursor = addDaysISO(cursor, -7);
  }

  return streak;
}

function bestWeeklyStreak(habit: Habit, today: string): number {
  const first = mondayOfWeek(habit.createdAt);
  const last = mondayOfWeek(today);
  let best = 0;
  let current = 0;

  for (
    let week = first;
    week <= last;
    week = addDaysISO(week, 7)
  ) {
    const progress = getWeekProgress(habit, week, today);
    if (progress.status === "before" || progress.status === "skipped") continue;
    if (progress.status === "achieved") {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }

  return best;
}

interface DayTotals {
  kept: number;
  total: number;
}

/** Counts achieved days between two dates, excluding neutral days. */
function summarizeDays(habit: Habit, from: string, to: string): DayTotals {
  let kept = 0;
  let total = 0;
  for (let date = from; date <= to; date = addDaysISO(date, 1)) {
    const status = getDayStatus(habit, date);
    if (
      status === "off" ||
      status === "skipped" ||
      status === "noted" ||
      status === "before"
    ) {
      continue;
    }
    total += 1;
    if (status === "achieved") kept += 1;
  }
  return { kept, total };
}

/** Counts achieved weeks, excluding skipped/not-yet-started weeks. */
function summarizeWeeks(
  habit: Habit,
  from: string,
  to: string,
  today: string
): DayTotals {
  const first = mondayOfWeek(from);
  const last = mondayOfWeek(to);
  let kept = 0;
  let total = 0;

  for (let week = first; week <= last; week = addDaysISO(week, 7)) {
    const progress = getWeekProgress(habit, week, today);
    if (progress.status === "before" || progress.status === "skipped") continue;
    total += 1;
    if (progress.status === "achieved") kept += 1;
  }

  return { kept, total };
}

export function percentKeptSinceCreation(
  habit: Habit,
  today = todayISO()
): number {
  if (habit.createdAt > today) return 0;
  const { kept, total } = isWeeklyEvaluation(habit)
    ? summarizeWeeks(habit, habit.createdAt, today, today)
    : summarizeDays(habit, habit.createdAt, today);
  return total === 0 ? 0 : (kept / total) * 100;
}

export function percentKeptLastDays(
  habit: Habit,
  days = 30,
  today = todayISO()
): number {
  const windowStart = addDaysISO(today, -(days - 1));
  const start = clampToCreation(habit, windowStart);
  if (start > today) return 0;
  const { kept, total } = isWeeklyEvaluation(habit)
    ? summarizeWeeks(habit, start, today, today)
    : summarizeDays(habit, start, today);
  return total === 0 ? 0 : (kept / total) * 100;
}

export function mondayOfWeek(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  const day = d.getUTCDay(); // 0 = Sunday, 1 = Monday
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split("T")[0];
}

export function getWeekRange(today: string): { start: string; end: string } {
  const start = mondayOfWeek(today);
  return { start, end: addDaysISO(start, 6) };
}

/**
 * The target for a week. Weekly total goals use the snapshot from the first
 * recorded day in that week, so editing a goal does not rewrite old weeks.
 */
export function getWeekTarget(habit: Habit, weekStart: string): number {
  const schedule = getSchedule(habit);
  if (habit.period === "daily" && schedule.type === "timesPerWeek") {
    return schedule.timesPerWeek;
  }

  for (let i = 0; i < 7; i++) {
    const entry = habit.dailyProgress[addDaysISO(weekStart, i)];
    if (entry) return entry.target ?? habit.required;
  }
  return habit.required;
}

/** Progress toward the week: units for weekly goals, kept days for schedules. */
export function getWeeklyAchieved(habit: Habit, weekStart: string): number {
  const schedule = getSchedule(habit);

  if (habit.period === "daily" && schedule.type === "timesPerWeek") {
    let kept = 0;
    for (let i = 0; i < 7; i++) {
      if (isDayAchieved(habit, addDaysISO(weekStart, i))) kept += 1;
    }
    return kept;
  }

  let total = 0;
  for (let i = 0; i < 7; i++) {
    total += getActual(habit, addDaysISO(weekStart, i));
  }
  return total;
}

function weekFullySkipped(habit: Habit, weekStart: string): boolean {
  let scheduled = 0;
  for (let i = 0; i < 7; i++) {
    const date = addDaysISO(weekStart, i);
    if (date < habit.createdAt || !isScheduled(habit, date)) continue;
    scheduled += 1;
    if (!habit.dailyProgress[date]?.skipped) return false;
  }
  return scheduled > 0;
}

export type WeekStatus =
  | "before"
  | "empty"
  | "partial"
  | "achieved"
  | "failed"
  | "skipped";

export interface WeekProgress {
  weekStart: string;
  weekEnd: string;
  target: number;
  achieved: number;
  ratio: number;
  status: WeekStatus;
  ended: boolean;
  /** Days after today until the end of this week (0 for past weeks). */
  daysRemaining: number;
}

export function getWeekProgress(
  habit: Habit,
  weekStart: string,
  today = todayISO()
): WeekProgress {
  const weekEnd = addDaysISO(weekStart, 6);
  const target = getWeekTarget(habit, weekStart);
  const achieved = getWeeklyAchieved(habit, weekStart);
  const ended = weekEnd < today;
  const ratio = target > 0 ? achieved / target : 0;
  let status: WeekStatus;

  if (weekEnd < habit.createdAt) {
    status = "before";
  } else if (target > 0 && achieved >= target) {
    status = "achieved";
  } else if (weekFullySkipped(habit, weekStart)) {
    status = "skipped";
  } else if (!ended) {
    status = achieved > 0 ? "partial" : "empty";
  } else {
    const minimum = habit.period === "weekly" ? habit.minimum ?? 0 : 0;
    status = achieved === 0 || achieved < minimum ? "failed" : "partial";
  }

  return {
    weekStart,
    weekEnd,
    target,
    achieved,
    ratio,
    status,
    ended,
    daysRemaining: Math.max(0, diffDays(today, weekEnd)),
  };
}

export function getOnTrack(habit: Habit, today: string): {
  daysElapsed: number;
  daysRemaining: number;
  canComplete: boolean;
} {
  if (!isWeeklyEvaluation(habit)) {
    const achieved = isDayAchieved(habit, today);
    return { daysElapsed: 1, daysRemaining: 0, canComplete: achieved };
  }

  const weekStart = mondayOfWeek(today);
  const progress = getWeekProgress(habit, weekStart, today);
  const weekEnd = addDaysISO(weekStart, 6);
  const daysElapsed = daysBetween(weekStart, today);
  const daysRemaining = Math.max(0, diffDays(today, weekEnd));
  const needed = Math.max(0, progress.target - progress.achieved);
  const canComplete =
    progress.status === "achieved" ||
    (habit.period === "weekly"
      ? daysRemaining >= 0
      : needed <= daysRemaining + (isDayAchieved(habit, today) ? 0 : 1));

  return { daysElapsed, daysRemaining, canComplete };
}
