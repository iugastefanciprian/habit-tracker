"use client";

import type { Habit } from "@/lib/types";
import {
  getActual,
  getDayStatus,
  getOnTrack,
  getTarget,
  getWeekProgress,
  isDayAchieved,
  isScheduled,
  isWeeklyEvaluation,
  mondayOfWeek,
} from "@/lib/domain/habits";
import { canEditDay } from "@/lib/domain/calendar";
import { habitCategory } from "@/lib/domain/categories";

interface HabitLogRowProps {
  habit: Habit;
  date: string;
  today: string;
  busy?: boolean;
  showCategory?: boolean;
  onToggle: (habitId: string) => void;
  onSetValue: (habitId: string, value: number | null) => void;
  onEdit: (habit: Habit) => void;
  onOpenDetail?: (habit: Habit) => void;
}

function statusText(
  habit: Habit,
  date: string,
  today: string
): { text: string; tone: string } {
  const unit = habit.unit ? ` ${habit.unit}` : "";
  const status = getDayStatus(habit, date);

  if (status === "before") return { text: "Before start", tone: "muted" };
  if (status === "off") return { text: "Not scheduled", tone: "muted" };
  if (status === "skipped") return { text: "Rest day", tone: "muted" };
  if (status === "noted") return { text: "Note only", tone: "violet" };

  if (habit.period === "weekly") {
    const week = getWeekProgress(habit, mondayOfWeek(date), today);
    if (week.status === "achieved") {
      return {
        text: `Week complete — ${week.achieved}/${week.target}${unit}`,
        tone: "green",
      };
    }
    return {
      text: `This week: ${week.achieved}/${week.target}${unit}`,
      tone: "default",
    };
  }

  if (habit.period === "daily" && isWeeklyEvaluation(habit)) {
    const week = getWeekProgress(habit, mondayOfWeek(date), today);
    return {
      text: `${week.achieved}/${week.target} days this week`,
      tone: week.status === "achieved" ? "green" : "default",
    };
  }

  if (habit.goalType === "yes") {
    return isDayAchieved(habit, date)
      ? { text: "Kept", tone: "green" }
      : { text: "Not yet", tone: "default" };
  }

  const actual = getActual(habit, date);
  const target = getTarget(habit, date);
  if (isDayAchieved(habit, date)) {
    return { text: `Goal met — ${actual}/${target}${unit}`, tone: "green" };
  }
  if (actual > 0) {
    return { text: `${actual}/${target}${unit}`, tone: "default" };
  }
  return { text: `${actual}/${target}${unit}`, tone: "muted" };
}

const TONE_CLASSES: Record<string, string> = {
  green: "text-green-700 dark:text-green-400",
  violet: "text-violet-600 dark:text-violet-400",
  muted: "text-gray-500 dark:text-gray-400",
  default: "text-gray-600 dark:text-gray-300",
};

function onTrackText(habit: Habit, date: string, today: string): string | null {
  if (!isWeeklyEvaluation(habit) || date !== today) return null;
  const week = getWeekProgress(habit, mondayOfWeek(today), today);
  if (week.status === "achieved") return "Weekly goal met";
  const track = getOnTrack(habit, today);
  if (!track.canComplete) return "Not completable this week";

  const needed = Math.max(0, week.target - week.achieved);
  const days = track.daysRemaining;
  const dayText = `${days} ${days === 1 ? "day" : "days"} left`;

  if (habit.period === "daily") {
    return `${needed} more ${needed === 1 ? "day" : "days"} · ${dayText}`;
  }
  const unit = habit.unit ? ` ${habit.unit}` : "";
  return `${needed}${unit} more · ${dayText}`;
}

export default function HabitLogRow({
  habit,
  date,
  today,
  busy = false,
  showCategory = false,
  onToggle,
  onSetValue,
  onEdit,
  onOpenDetail,
}: HabitLogRowProps) {
  const actual = getActual(habit, date);
  const target = getTarget(habit, date);
  const dayAchieved = isDayAchieved(habit, date);
  const weekly = isWeeklyEvaluation(habit);
  const week = weekly ? getWeekProgress(habit, mondayOfWeek(date), today) : null;
  const editable = canEditDay(habit, date, today) && isScheduled(habit, date);
  const skipped = getDayStatus(habit, date) === "skipped";
  const canLog = editable && !skipped && !busy;
  const status = statusText(habit, date, today);
  const progress = week
    ? week.target > 0
      ? Math.min(100, (week.achieved / week.target) * 100)
      : 0
    : target > 0
      ? Math.min(100, (actual / target) * 100)
      : 0;
  const track = onTrackText(habit, date, today);

  const primaryDone = habit.period === "weekly" ? actual > 0 : dayAchieved;
  const primaryLabel =
    habit.period === "weekly"
      ? actual > 0
        ? date === today
          ? "Undo today"
          : "Undo this day"
        : "Log +1"
      : dayAchieved
        ? "Undo"
        : habit.goalType === "yes"
          ? "Mark kept"
          : "Done";

  return (
    <article className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {habit.color && (
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: habit.color }}
              />
            )}
            {onOpenDetail ? (
              <button
                type="button"
                onClick={() => onOpenDetail(habit)}
                className="truncate text-left text-base font-semibold text-gray-900 hover:underline dark:text-gray-100"
              >
                {habit.emoji ? `${habit.emoji} ` : ""}
                {habit.name}
              </button>
            ) : (
              <h3 className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">
                {habit.emoji ? `${habit.emoji} ` : ""}
                {habit.name}
              </h3>
            )}
            {showCategory && habitCategory(habit) && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                {habitCategory(habit)}
              </span>
            )}
          </div>
          <p className={`mt-1 text-sm ${TONE_CLASSES[status.tone]}`}>
            {status.text}
            {habit.dailyProgress[date]?.note ? " · 📝 note" : ""}
          </p>
          {track && (
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {track}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          {habit.goalType !== "yes" && habit.period !== "weekly" && (
            <>
              <button
                type="button"
                onClick={() => onSetValue(habit.id, actual - 1)}
                disabled={!canLog || actual <= 0}
                aria-label={`Decrease ${habit.name} by one`}
                title="Decrease by one"
                className="h-8 w-8 rounded-lg bg-gray-100 text-gray-700 transition hover:bg-gray-200 disabled:opacity-40 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                −
              </button>
              <button
                type="button"
                onClick={() => onSetValue(habit.id, actual + 1)}
                disabled={!canLog}
                aria-label={`Increase ${habit.name} by one`}
                title="Increase by one"
                className="h-8 w-8 rounded-lg bg-gray-100 text-gray-700 transition hover:bg-gray-200 disabled:opacity-40 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                +
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => onToggle(habit.id)}
            disabled={!canLog}
            className={`rounded-lg px-3 py-1.5 text-sm transition disabled:opacity-40 ${
              primaryDone
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            {primaryLabel}
          </button>
          <button
            type="button"
            onClick={() => onEdit(habit)}
            disabled={!editable || busy}
            aria-label={`Edit ${habit.name} for ${date}`}
            title="Edit value, note, or rest day"
            className="h-8 rounded-lg bg-gray-100 px-2 text-sm text-gray-700 transition hover:bg-gray-200 disabled:opacity-40 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            Edit
          </button>
        </div>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className={`h-full rounded-full transition-all ${
            week?.status === "achieved" || (!week && dayAchieved)
              ? "bg-green-500"
              : "bg-blue-500"
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </article>
  );
}
