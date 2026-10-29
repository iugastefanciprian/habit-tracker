"use client";

import { useState } from "react";
import { Habit } from "@/lib/types";
import HabitCalendar, { HabitHeatmap } from "@/components/HabitCalendar";
import { habitCategory } from "@/lib/domain/categories";
import { monthOf } from "@/lib/domain/calendar";
import { getMilestones } from "@/lib/domain/milestones";
import {
  describeSchedule,
  getActual,
  getDayStatus,
  getDaysWindow,
  getRatio,
  getSchedule,
  getTarget,
  getWeekProgress,
  habitAgeDays,
  isDayAchieved,
  isDayFailed,
  isWeeklyEvaluation,
  mondayOfWeek,
  percentKeptLastDays,
  percentKeptSinceCreation,
  todayISO,
} from "@/lib/domain/habits";

interface HabitDetailProps {
  habit: Habit;
  onClose: () => void;
  onToggle: (id: string) => void;
  onEdit?: () => void;
  onEditDay?: (date: string) => void;
  today?: string;
}

function meterColor(percent: number): string {
  if (percent >= 100) return "#22c55e";
  if (percent >= 75) return "#3b82f6";
  if (percent >= 50) return "#eab308";
  if (percent >= 25) return "#f97316";
  return "#ef4444";
}

function CircularMeter({ percent }: { percent: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference * (1 - clamped / 100);
  const color = meterColor(clamped);
  return (
    <div className="flex flex-col items-center">
      <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label={`Completion ${Math.round(clamped)} percent`}>
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="12" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
        />
        <text x="70" y="70" textAnchor="middle" dominantBaseline="central" fontSize="24" fontWeight="bold" fill={color}>
          {Math.round(clamped)}%
        </text>
      </svg>
      <p className="text-sm text-gray-500 mt-2">Completion percentage</p>
    </div>
  );
}

function dayStatusText(
  habit: Habit,
  date: string,
  today: string
): { text: string; color: string } {
  const status = getDayStatus(habit, date);
  if (status === "off") return { text: "Rest day", color: "#6b7280" };
  if (status === "skipped") return { text: "Skipped", color: "#6b7280" };
  if (status === "noted") return { text: "Note only", color: "#8b5cf6" };

  const unit = habit.unit ? ` ${habit.unit}` : "";

  if (habit.period === "weekly") {
    const actual = getActual(habit, date);
    if (actual <= 0) return { text: "No entry", color: "#6b7280" };
    const week = getWeekProgress(habit, mondayOfWeek(date), today);
    return {
      text: `${actual}${unit} · week ${week.achieved}/${week.target}${unit}`,
      color: "#3b82f6",
    };
  }

  const actual = getActual(habit, date);
  const target = getTarget(habit, date);
  const failed = isDayFailed(habit, date);
  const achieved = isDayAchieved(habit, date);
  const ratio = getRatio(habit, date);
  const pct = ratio * 100;
  const color =
    failed || pct === 0
      ? "#6b7280"
      : achieved
        ? "#22c55e"
        : pct < 25
          ? "#ef4444"
          : pct < 50
            ? "#f97316"
            : pct < 75
              ? "#eab308"
              : "#3b82f6";

  return {
    text: failed
      ? `Failed — ${actual}${unit}/${target}${unit}`
      : achieved
        ? `Goal met — ${actual}${unit}/${target}${unit}`
        : `${Math.round(pct)}% — ${actual}${unit}/${target}${unit}`,
    color,
  };
}

export default function HabitDetail({
  habit,
  onClose,
  onToggle,
  onEdit,
  onEditDay,
  today = todayISO(),
}: HabitDetailProps) {
  const unit = habit.unit ? ` ${habit.unit}` : "";
  const weekly = isWeeklyEvaluation(habit);
  const [selectedMonth, setSelectedMonth] = useState(monthOf(today));
  const week = weekly ? getWeekProgress(habit, mondayOfWeek(today), today) : null;
  const weeklyDays = getSchedule(habit).type === "timesPerWeek";
  const dayAchievedToday = isDayAchieved(habit, today);
  const loggedToday = getActual(habit, today) > 0;
  const achievedToday = weekly ? week?.status === "achieved" : dayAchievedToday;
  const failedToday = weekly ? week?.status === "failed" : isDayFailed(habit, today);
  const actualToday = getActual(habit, today);
  const targetToday = getTarget(habit, today);

  const percentSinceCreation = percentKeptSinceCreation(habit, today);
  const percentLast30 = percentKeptLastDays(habit, 30, today);
  const hasFullWindow = habitAgeDays(habit, today) >= 30;
  const milestones = getMilestones(habit, today);
  const daysInWindow = getDaysWindow(habit, 30, today).filter(
    (day) => !day.beforeCreation
  );

  const actionDone = habit.period === "weekly" ? loggedToday : dayAchievedToday;
  const actionLabel =
    habit.period === "weekly"
      ? loggedToday
        ? "Undo today's log"
        : "Log today"
      : dayAchievedToday
        ? habit.goalType === "yes"
          ? "✓ Kept — Undo"
          : "✓ Done — Undo"
        : "Mark Done";

  const todayText = (() => {
    if (habit.period === "weekly" && week) {
      if (week.status === "achieved") {
        return `✓ Week complete — ${week.achieved}/${week.target}${unit}`;
      }
      if (week.status === "failed") {
        return `✗ Week missed — ${week.achieved}/${week.target}${unit}`;
      }
      return `This week — ${week.achieved}/${week.target}${unit}${
        loggedToday ? ` · logged ${actualToday}${unit} today` : ""
      }`;
    }

    if (week && weeklyDays) {
      return `${week.achieved}/${week.target} days this week · ${
        dayAchievedToday
          ? "✓ kept today"
          : getDayStatus(habit, today) === "noted"
            ? "note only today"
            : "not yet today"
      }`;
    }

    const status = getDayStatus(habit, today);
    if (status === "noted") return "Note only today";
    if (habit.goalType === "yes") {
      return dayAchievedToday ? "✓ Kept today" : "✗ Not kept today";
    }
    if (failedToday) {
      return `✗ Failed today — ${actualToday}${unit} / ${targetToday}${unit}`;
    }
    if (achievedToday) {
      return `✓ Goal met today — ${actualToday}${unit} / ${targetToday}${unit}`;
    }
    return `In progress — ${actualToday}${unit} / ${targetToday}${unit}`;
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-lg w-full max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{habit.name}</h2>
            {habitCategory(habit) && (
              <span className="mt-1 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                {habitCategory(habit)}
              </span>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {habit.goalType === "yes"
                ? "Yes / No habit"
                : `${habit.required}${unit} required`}
              {habit.minimum !== undefined
                ? ` · minimum ${habit.minimum}${unit}`
                : ""}{" "}
              · {habit.period === "weekly" ? "weekly total" : "daily goal"} ·{" "}
              {describeSchedule(getSchedule(habit))}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onEdit && (
              <button
                onClick={onEdit}
                className="px-3 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
              >
                Edit
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1 rounded-lg bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              Close
            </button>
          </div>
        </div>

        <div className="mb-6">
          <CircularMeter percent={percentSinceCreation} />
          <div className="flex justify-center gap-6 mt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{Math.round(percentSinceCreation)}%</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Since initiation</p>
            </div>
            {hasFullWindow && (
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{Math.round(percentLast30)}%</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Last 30 days</p>
              </div>
            )}
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
            {habit.period === "weekly" ? "This week" : "Today"}
          </h3>
          <div
            className="p-4 rounded-lg border"
            style={{
              borderColor: achievedToday
                ? "#22c55e"
                : failedToday
                  ? "#ef4444"
                  : "#6b7280",
            }}
          >
            <p className="text-sm text-gray-700 dark:text-gray-300">{todayText}</p>
            {week && weeklyDays && week.status !== "achieved" && (
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{
                    width: `${Math.min(100, (week.achieved / Math.max(1, week.target)) * 100)}%`,
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="mb-6">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Milestones
            </h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {milestones.achieved.length} earned
            </span>
          </div>

          {milestones.achieved.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {milestones.achieved.map((milestone) => (
                <span
                  key={milestone.id}
                  className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-200"
                >
                  {milestone.kind === "streak" ? "🔥" : "✅"} {milestone.label}
                </span>
              ))}
            </div>
          )}

          {milestones.next ? (
            <div className="mt-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  Next: {milestones.next.kind === "streak" ? "🔥" : "✅"}{" "}
                  {milestones.next.label}
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  {milestones.next.remaining} more {milestones.unit}
                  {milestones.next.remaining === 1 ? "" : "s"}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
                <div
                  className="h-full rounded-full bg-green-500 transition-all"
                  style={{ width: `${milestones.next.progress * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800 dark:bg-green-900/30 dark:text-green-200">
              Every badge earned. Impressive consistency.
            </p>
          )}

          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {milestones.currentStreak} current · {milestones.bestStreak} best ·{" "}
            {milestones.totalKept} total kept
          </p>
        </div>

        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Calendar
            </h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Click a day to edit it
            </span>
          </div>
          <HabitCalendar
            habit={habit}
            month={selectedMonth}
            today={today}
            onMonthChange={setSelectedMonth}
            onSelectDay={onEditDay}
          />
        </div>

        <div className="mb-6">
          <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Last 12 months
          </h3>
          <HabitHeatmap
            habit={habit}
            today={today}
            onSelectDay={onEditDay}
          />
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">Last 30 days</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {daysInWindow.map(({ date }) => {
              const { text, color: textColor } = dayStatusText(habit, date, today);
              const note = habit.dailyProgress[date]?.note;
              const rowClass =
                "flex w-full items-center justify-between gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-700";
              const content = (
                <>
                  <span className="flex min-w-0 items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                    <span className="truncate">{date}</span>
                    {note && (
                      <span title={note} aria-label={`Note: ${note}`}>
                        📝
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-sm font-medium" style={{ color: textColor }}>
                    {text}
                  </span>
                </>
              );

              return onEditDay ? (
                <button
                  key={date}
                  type="button"
                  onClick={() => onEditDay(date)}
                  className={`${rowClass} text-left hover:bg-gray-100 dark:hover:bg-gray-600 transition`}
                >
                  {content}
                </button>
              ) : (
                <div key={date} className={rowClass}>
                  {content}
                </div>
              );
            })}
          </div>
        </div>

        <button
          onClick={() => onToggle(habit.id)}
          className={`w-full px-4 py-2 rounded-lg transition ${
            actionDone
              ? "bg-green-600 text-white"
              : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
          }`}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
