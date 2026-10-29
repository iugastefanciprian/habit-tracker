"use client";

import { useState } from "react";
import type { Habit } from "@/lib/types";
import {
  describeSchedule,
  getSchedule,
  getTarget,
  getWeekProgress,
  isWeeklyEvaluation,
  mondayOfWeek,
} from "@/lib/domain/habits";

export interface DayEntrySave {
  value: number | null;
  note?: string | null;
  skipped?: boolean;
}

interface DayEditorProps {
  habit: Habit;
  date: string;
  today?: string;
  onSave: (input: DayEntrySave) => void;
  onClose: () => void;
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function DayEditor({
  habit,
  date,
  today = date,
  onSave,
  onClose,
}: DayEditorProps) {
  const existing = habit.dailyProgress[date];
  const [value, setValue] = useState(
    existing !== undefined && existing.value > 0 ? String(existing.value) : ""
  );
  const [note, setNote] = useState(existing?.note ?? "");
  const [kept, setKept] = useState(
    habit.completedDates.includes(date) ||
      (habit.goalType === "yes" && (existing?.value ?? 0) >= 1)
  );
  const [skipped, setSkipped] = useState(Boolean(existing?.skipped));
  const [formError, setFormError] = useState<string | null>(null);

  const unit = habit.unit ? ` ${habit.unit}` : "";
  const target = getTarget(habit, date);
  const week = isWeeklyEvaluation(habit)
    ? getWeekProgress(habit, mondayOfWeek(date), today)
    : null;
  const weeklyDays = getSchedule(habit).type === "timesPerWeek";

  const save = () => {
    const trimmedNote = note.trim() || null;

    if (skipped) {
      onSave({ value: null, note: trimmedNote, skipped: true });
      return;
    }

    if (habit.goalType === "yes") {
      onSave({
        value: kept ? 1 : null,
        note: trimmedNote,
        skipped: false,
      });
      return;
    }

    if (value.trim()) {
      const parsed = Number(value.replace(",", "."));
      if (!Number.isFinite(parsed) || parsed < 0) {
        setFormError("Enter zero or more.");
        return;
      }
      if (parsed > 0) {
        onSave({
          value: parsed,
          note: trimmedNote,
          skipped: false,
        });
        return;
      }
    }

    // No value: keep the note as a neutral note-only day, or clear the day.
    onSave({ value: null, note: trimmedNote, skipped: false });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-editor-title"
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="day-editor-title"
          className="text-xl font-bold text-gray-900 dark:text-gray-100"
        >
          {habit.name}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {formatDate(date)}
        </p>
        <p className="mb-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
          {habit.period === "weekly" ? "Weekly total" : "Daily goal"} ·{" "}
          {describeSchedule(getSchedule(habit))}
        </p>

        <div className="mb-4 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-gray-700/50 dark:text-gray-300">
          {habit.goalType === "yes" ? (
            <span>
              {habit.period === "weekly"
                ? `Keep this habit ${target || 1}× this week`
                : "Yes / No habit"}
            </span>
          ) : (
            <span>
              {habit.period === "weekly" ? "Weekly target" : "Target"}:{" "}
              {habit.period === "weekly" && week ? week.target : target}
              {unit}
              {habit.minimum !== undefined
                ? ` · minimum ${habit.minimum}${unit}`
                : ""}
            </span>
          )}
          {week && (
            <span className="mt-1 block">
              This week: {week.achieved}/{week.target}
              {weeklyDays ? " days" : unit} ({week.status})
            </span>
          )}
        </div>

        <label className="mb-4 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-gray-700/50 dark:text-gray-200">
          <input
            type="checkbox"
            checked={skipped}
            onChange={(event) => setSkipped(event.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Skip this day (rest day)
        </label>

        <div className="space-y-3">
          {habit.goalType === "yes" ? (
            <button
              type="button"
              aria-pressed={kept}
              disabled={skipped}
              onClick={() => setKept((current) => !current)}
              className={`w-full rounded-lg px-4 py-2 transition disabled:opacity-50 ${
                kept
                  ? "bg-green-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              {kept ? "✓ Kept — click to undo" : "Mark kept"}
            </button>
          ) : (
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Actual {unit ? `(${habit.unit})` : ""}
              <input
                type="number"
                min="0"
                step="any"
                value={value}
                disabled={skipped}
                onChange={(event) => setValue(event.target.value)}
                placeholder={`e.g. ${
                  habit.period === "weekly" && week ? week.target : target
                }`}
                autoFocus
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </label>
          )}

          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Note (optional)
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="How did it go? Leave a note for this day."
              maxLength={500}
              rows={3}
              className="mt-1 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            A note without a value is kept as a neutral day.
          </p>

          {formError && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/40 dark:text-red-300"
            >
              {formError}
            </p>
          )}

          <button
            type="button"
            onClick={save}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
          >
            {skipped ? "Save skip" : "Save day"}
          </button>
          <button
            type="button"
            onClick={() => onSave({ value: null, note: null, skipped: false })}
            className="w-full rounded-lg bg-red-100 px-4 py-2 text-red-700 transition hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60"
          >
            Clear day
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-lg px-4 py-2 text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
