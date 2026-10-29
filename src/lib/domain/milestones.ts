import type { Habit } from "../types";
import {
  addDaysISO,
  calculateBestStreak,
  calculateStreak,
  getDayStatus,
  getWeekProgress,
  isWeeklyEvaluation,
  mondayOfWeek,
} from "./habits";

export type MilestoneKind = "streak" | "kept";

export interface Milestone {
  id: string;
  kind: MilestoneKind;
  threshold: number;
  label: string;
  achieved: boolean;
  /** Progress toward this milestone, clamped to 0–1. */
  progress: number;
  remaining: number;
}

export interface MilestoneSummary {
  unit: "day" | "week";
  currentStreak: number;
  bestStreak: number;
  totalKept: number;
  achieved: Milestone[];
  next: Milestone | null;
  upcoming: Milestone[];
}

/** Streak lengths (days) that unlock a badge. */
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 180, 365];
/** Streak lengths (weeks) for weekly goals and times-per-week schedules. */
export const WEEK_STREAK_MILESTONES = [3, 7, 14, 26, 52, 100];
/** Total kept days that unlock a badge. */
export const KEPT_MILESTONES = [1, 10, 25, 50, 100, 250, 500, 1_000];
/** Total kept weeks that unlock a badge. */
export const WEEK_KEPT_MILESTONES = [1, 5, 10, 25, 50, 100];

function plural(count: number, unit: "day" | "week"): string {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

/** Kept days (or achieved weeks) since the habit was created. */
export function countKept(habit: Habit, today: string): number {
  if (habit.createdAt > today) return 0;

  if (isWeeklyEvaluation(habit)) {
    let kept = 0;
    const last = mondayOfWeek(today);
    for (
      let week = mondayOfWeek(habit.createdAt);
      week <= last;
      week = addDaysISO(week, 7)
    ) {
      if (getWeekProgress(habit, week, today).status === "achieved") kept += 1;
    }
    return kept;
  }

  let kept = 0;
  for (let date = habit.createdAt; date <= today; date = addDaysISO(date, 1)) {
    if (getDayStatus(habit, date) === "achieved") kept += 1;
  }
  return kept;
}

function makeMilestone(
  kind: MilestoneKind,
  threshold: number,
  value: number,
  unit: "day" | "week"
): Milestone {
  const achieved = value >= threshold;
  return {
    id: `${kind}-${threshold}`,
    kind,
    threshold,
    label:
      kind === "streak"
        ? `${plural(threshold, unit)} streak`
        : `${plural(threshold, unit)} kept`,
    achieved,
    progress: threshold <= 0 ? 1 : Math.min(1, value / threshold),
    remaining: Math.max(0, threshold - value),
  };
}

/**
 * Badge progress for a habit. Streak badges use the best streak so an earned
 * milestone never disappears, while totals count every kept day or week.
 */
export function getMilestones(habit: Habit, today: string): MilestoneSummary {
  const unit: "day" | "week" = isWeeklyEvaluation(habit) ? "week" : "day";
  const bestStreak = calculateBestStreak(habit, today);
  const totalKept = countKept(habit, today);

  const streakThresholds =
    unit === "week" ? WEEK_STREAK_MILESTONES : STREAK_MILESTONES;
  const keptThresholds =
    unit === "week" ? WEEK_KEPT_MILESTONES : KEPT_MILESTONES;

  const streak = streakThresholds.map((threshold) =>
    makeMilestone("streak", threshold, bestStreak, unit)
  );
  const kept = keptThresholds.map((threshold) =>
    makeMilestone("kept", threshold, totalKept, unit)
  );
  const all = [...streak, ...kept];

  const achieved = all.filter((milestone) => milestone.achieved);
  const unachieved = all
    .filter((milestone) => !milestone.achieved)
    .sort((a, b) => b.progress - a.progress || a.threshold - b.threshold);

  return {
    unit,
    currentStreak: calculateStreak(habit, today),
    bestStreak,
    totalKept,
    achieved,
    next: unachieved[0] ?? null,
    upcoming: unachieved.slice(0, 3),
  };
}
