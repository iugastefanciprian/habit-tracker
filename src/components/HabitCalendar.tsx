"use client";

import type { Habit } from "@/lib/types";
import {
  addMonths,
  canEditDay,
  getMonthMatrix,
  getTrailingMonths,
  monthLabel,
  monthOf,
} from "@/lib/domain/calendar";
import {
  getActual,
  getDayColor,
  getDayStatus,
  getWeekProgress,
  isDayAchieved,
  mondayOfWeek,
  type HabitDayColor,
} from "@/lib/domain/habits";
import { DAY_COLOR_CLASSES } from "@/components/DayGrid";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function cellTextColor(color: HabitDayColor): string {
  if (color === "none") return "text-gray-400 dark:text-gray-500";
  if (color === "off" || color === "skipped") {
    return "text-gray-600 dark:text-gray-200";
  }
  if (color === "noted" || color === "logged" || color === "yellow") {
    return "text-gray-900";
  }
  return "text-white";
}

function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function tooltip(habit: Habit, date: string, today: string): string {
  const status = getDayStatus(habit, date);
  const note = habit.dailyProgress[date]?.note;
  const suffix = note ? ` · 📝 ${note}` : "";
  const unit = habit.unit ? ` ${habit.unit}` : "";

  if (status === "before") return `${shortDate(date)} · Before start`;
  if (status === "off") return `${shortDate(date)} · Not scheduled${suffix}`;
  if (status === "skipped") return `${shortDate(date)} · Skipped${suffix}`;
  if (status === "noted") return `${shortDate(date)} · Note only${suffix}`;
  if (habit.period === "weekly") {
    const week = getWeekProgress(habit, mondayOfWeek(date), today);
    return `${shortDate(date)} · ${getActual(habit, date)}${unit} · week ${week.achieved}/${week.target}${unit}${suffix}`;
  }
  if (habit.goalType === "yes") {
    return `${shortDate(date)} · ${isDayAchieved(habit, date) ? "Kept" : "Not kept"}${suffix}`;
  }
  return `${shortDate(date)} · ${getActual(habit, date)}${unit} / ${habit.required}${unit}${suffix}`;
}

interface HabitCalendarProps {
  habit: Habit;
  month: string;
  today: string;
  onMonthChange: (month: string) => void;
  onSelectDay?: (date: string) => void;
}

/** Navigable month grid for one habit. */
export default function HabitCalendar({
  habit,
  month,
  today,
  onMonthChange,
  onSelectDay,
}: HabitCalendarProps) {
  const weeks = getMonthMatrix(month);
  const previous = addMonths(month, -1);
  const next = addMonths(month, 1);
  const nextDisabled = next > monthOf(today);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onMonthChange(previous)}
          aria-label="Previous month"
          className="rounded-lg bg-gray-100 px-2.5 py-1 text-gray-600 transition hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          ←
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {monthLabel(month)}
          </p>
          <button
            type="button"
            onClick={() => onMonthChange(monthOf(today))}
            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
          >
            Back to this month
          </button>
        </div>
        <button
          type="button"
          onClick={() => onMonthChange(next)}
          disabled={nextDisabled}
          aria-label="Next month"
          className="rounded-lg bg-gray-100 px-2.5 py-1 text-gray-600 transition hover:bg-gray-200 disabled:opacity-40 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-gray-500 dark:text-gray-400">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="mt-1 space-y-1">
        {weeks.map((week) => (
          <div key={week[0].date} className="grid grid-cols-7 gap-1">
            {week.map(({ date, inMonth }) => {
              if (!inMonth) return <div key={date} />;
              const color = getDayColor(habit, date);
              const label = tooltip(habit, date, today);
              const editable = canEditDay(habit, date, today) && Boolean(onSelectDay);
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => onSelectDay?.(date)}
                  disabled={!editable}
                  title={label}
                  aria-label={label}
                  className={`flex aspect-square items-center justify-center rounded-md text-[11px] font-medium transition ${DAY_COLOR_CLASSES[color]} ${cellTextColor(color)} ${
                    editable ? "hover:opacity-75" : "cursor-default"
                  } ${
                    date === today
                      ? "ring-2 ring-blue-500 ring-offset-1 ring-offset-white dark:ring-offset-gray-800"
                      : ""
                  }`}
                >
                  {Number(date.slice(-2))}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

interface HabitHeatmapProps {
  habit: Habit;
  today: string;
  months?: number;
  onSelectDay?: (date: string) => void;
}

/** Twelve-month contribution heatmap for one habit. */
export function HabitHeatmap({
  habit,
  today,
  months = 12,
  onSelectDay,
}: HabitHeatmapProps) {
  const monthStarts = getTrailingMonths(today, months);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {monthStarts.map((month) => {
        const label = new Date(`${month}T00:00:00Z`).toLocaleDateString(
          undefined,
          { month: "short", timeZone: "UTC" }
        );
        return (
          <div key={month}>
            <p className="mb-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
              {label}
            </p>
            <div className="grid grid-cols-7 gap-[2px]">
              {getMonthMatrix(month)
                .flat()
                .map(({ date, inMonth }) => {
                  if (!inMonth) return <div key={date} />;
                  const color = getDayColor(habit, date);
                  const tip = tooltip(habit, date, today);
                  const editable =
                    canEditDay(habit, date, today) && Boolean(onSelectDay);
                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => onSelectDay?.(date)}
                      disabled={!editable}
                      title={tip}
                      aria-label={tip}
                      className={`aspect-square w-full rounded-[2px] transition ${DAY_COLOR_CLASSES[color]} ${
                        editable ? "hover:opacity-70" : "cursor-default"
                      } ${
                        date === today
                          ? "ring-1 ring-blue-500 ring-offset-1 ring-offset-white dark:ring-offset-gray-800"
                          : ""
                      }`}
                    />
                  );
                })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
