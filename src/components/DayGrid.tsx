"use client";

import { Habit } from "@/lib/types";
import {
  getActual,
  getDayColor,
  getDayStatus,
  getDaysWindow,
  getWeekProgress,
  isDayAchieved,
  mondayOfWeek,
  todayISO,
  HabitDayColor,
} from "@/lib/domain/habits";

export const DAY_COLOR_CLASSES: Record<HabitDayColor, string> = {
  none: "border border-dashed border-gray-300 dark:border-gray-600 bg-transparent",
  off: "border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-700/40",
  skipped: "border border-gray-400 bg-gray-200 dark:border-gray-500 dark:bg-gray-600",
  noted: "bg-purple-400",
  logged: "bg-cyan-400",
  black: "bg-gray-900 dark:bg-black dark:border dark:border-gray-600",
  red: "bg-red-500",
  orange: "bg-orange-500",
  yellow: "bg-yellow-400",
  blue: "bg-blue-500",
  green: "bg-green-500",
};

export const DAY_COLOR_LEGEND: { color: HabitDayColor; label: string }[] = [
  { color: "off", label: "Not scheduled" },
  { color: "skipped", label: "Skipped" },
  { color: "noted", label: "Note only" },
  { color: "logged", label: "Logged (weekly)" },
  { color: "black", label: "Missed / no entry" },
  { color: "red", label: "Below 25%" },
  { color: "orange", label: "25–49%" },
  { color: "yellow", label: "50–74%" },
  { color: "blue", label: "75–99%" },
  { color: "green", label: "Goal met" },
];

function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function cellTooltip(habit: Habit, date: string, today: string): string {
  const status = getDayStatus(habit, date);
  const note = habit.dailyProgress[date]?.note;
  const noteSuffix = note ? ` · 📝 ${note}` : "";
  if (status === "off") return `${shortDate(date)} · Not scheduled${noteSuffix}`;
  if (status === "skipped") return `${shortDate(date)} · Skipped${noteSuffix}`;
  if (status === "noted") return `${shortDate(date)} · Note only${noteSuffix}`;

  const actual = getActual(habit, date);
  const unit = habit.unit ? ` ${habit.unit}` : "";

  if (habit.period === "weekly") {
    const week = getWeekProgress(habit, mondayOfWeek(date), today);
    return `${shortDate(date)} · ${actual}${unit} · week ${week.achieved}/${week.target}${unit}${noteSuffix}`;
  }

  if (habit.goalType === "yes") {
    return `${shortDate(date)} · ${isDayAchieved(habit, date) ? "Kept" : "Not kept"}${noteSuffix}`;
  }
  return `${shortDate(date)} · ${actual}${unit} / ${habit.required}${unit}${noteSuffix}`;
}

interface DayGridProps {
  habit: Habit;
  onSelectDay: (date: string) => void;
  today?: string;
}

export default function DayGrid({ habit, onSelectDay, today = todayISO() }: DayGridProps) {
  const days = getDaysWindow(habit, 30, today).filter((day) => !day.beforeCreation);

  return (
    <div>
      <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-1">
        {days.map(({ date }) => {
          const color = getDayColor(habit, date);
          const isToday = date === today;
          const tooltip = cellTooltip(habit, date, today);
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelectDay(date)}
              title={tooltip}
              aria-label={tooltip}
              className={`aspect-square w-full rounded-[3px] transition ${DAY_COLOR_CLASSES[color]} hover:opacity-70 ${
                isToday ? "ring-2 ring-blue-500 ring-offset-1 ring-offset-white dark:ring-offset-gray-800" : ""
              }`}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-gray-500 dark:text-gray-400">
        <span>Today</span>
        <span>{days.length > 0 ? shortDate(days[days.length - 1].date) : ""}</span>
      </div>
    </div>
  );
}

export function DayColorLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
      {DAY_COLOR_LEGEND.map(({ color, label }) => (
        <span key={color} className="flex items-center gap-1.5">
          <span className={`inline-block h-3 w-3 rounded-[3px] ${DAY_COLOR_CLASSES[color]}`} />
          {label}
        </span>
      ))}
    </div>
  );
}
