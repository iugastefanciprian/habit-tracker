"use client";

import { useEffect, useState } from "react";
import type {
  GoalPeriod,
  GoalType,
  Habit,
  HabitReminder,
  HabitSchedule,
} from "@/lib/types";
import {
  HABIT_COLORS,
  HABIT_TEMPLATES,
  type HabitTemplate,
} from "@/lib/domain/templates";

export interface HabitDraft {
  name: string;
  goalType: GoalType;
  required: number;
  minimum: number | null;
  unit: string | null;
  period: GoalPeriod;
  schedule: HabitSchedule;
  category: string | null;
  color: string | null;
  emoji: string | null;
  reminder: HabitReminder | null;
}

const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

interface HabitFormModalProps {
  mode: "create" | "edit";
  habit?: Habit;
  categories?: string[];
  busy?: boolean;
  error?: string | null;
  onSubmit: (draft: HabitDraft) => void;
  onClose: () => void;
}

export default function HabitFormModal({
  mode,
  habit,
  categories = [],
  busy = false,
  error,
  onSubmit,
  onClose,
}: HabitFormModalProps) {
  const [name, setName] = useState(habit?.name ?? "");
  const [goalType, setGoalType] = useState<GoalType>(habit?.goalType ?? "count");
  const [required, setRequired] = useState(String(habit?.required ?? 1));
  const [minimum, setMinimum] = useState(
    habit?.minimum !== undefined ? String(habit.minimum) : ""
  );
  const [unit, setUnit] = useState(habit?.unit ?? "");
  const [period, setPeriod] = useState<GoalPeriod>(habit?.period ?? "daily");
  const [category, setCategory] = useState(habit?.category ?? "");
  const [emoji, setEmoji] = useState(habit?.emoji ?? "");
  const [color, setColor] = useState(habit?.color ?? "");
  const [reminderEnabled, setReminderEnabled] = useState(
    habit?.reminder?.enabled ?? false
  );
  const [reminderTime, setReminderTime] = useState(
    habit?.reminder?.time ?? "08:00"
  );
  const [showTemplates, setShowTemplates] = useState(false);
  const [scheduleType, setScheduleType] = useState<HabitSchedule["type"]>(
    habit?.schedule?.type ?? "daily"
  );
  const [weekdays, setWeekdays] = useState<number[]>(
    habit?.schedule?.type === "weekdays"
      ? habit.schedule.weekdays
      : [1, 2, 3, 4, 5]
  );
  const [timesPerWeek, setTimesPerWeek] = useState(
    habit?.schedule?.type === "timesPerWeek"
      ? String(habit.schedule.timesPerWeek)
      : "3"
  );
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const applyTemplate = (template: HabitTemplate) => {
    setName(template.name);
    setGoalType(template.goalType);
    setRequired(String(template.required));
    setMinimum(
      template.minimum !== undefined ? String(template.minimum) : ""
    );
    setUnit(template.unit ?? "");
    setPeriod(template.period);
    setCategory(template.category);
    setColor(template.color);
    setEmoji(template.emoji);
    setScheduleType(template.schedule.type);
    if (template.schedule.type === "weekdays") {
      setWeekdays(template.schedule.weekdays);
    }
    if (template.schedule.type === "timesPerWeek") {
      setTimesPerWeek(String(template.schedule.timesPerWeek));
    }
    setShowTemplates(false);
    setFormError(null);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError("Give the habit a name.");
      return;
    }

    const parsedRequired =
      goalType === "yes" ? 1 : Number(required.replace(",", "."));
    if (!Number.isFinite(parsedRequired) || parsedRequired <= 0) {
      setFormError("Required must be greater than zero.");
      return;
    }

    const parsedMinimum = minimum.trim()
      ? Number(minimum.replace(",", "."))
      : null;
    if (
      parsedMinimum !== null &&
      (!Number.isFinite(parsedMinimum) || parsedMinimum < 0)
    ) {
      setFormError("Minimum must be zero or more.");
      return;
    }

    let schedule: HabitSchedule;
    if (scheduleType === "weekdays") {
      const days = [...new Set(weekdays)].sort((a, b) => a - b);
      if (days.length === 0) {
        setFormError("Pick at least one weekday.");
        return;
      }
      schedule = { type: "weekdays", weekdays: days };
    } else if (scheduleType === "timesPerWeek") {
      const count = Number(timesPerWeek);
      if (!Number.isInteger(count) || count < 1 || count > 7) {
        setFormError("Times per week must be a whole number from 1 to 7.");
        return;
      }
      schedule = { type: "timesPerWeek", timesPerWeek: count };
    } else {
      schedule = { type: "daily" };
    }

    setFormError(null);
    onSubmit({
      name: trimmedName,
      goalType,
      required: parsedRequired,
      minimum: parsedMinimum,
      unit: unit.trim() || null,
      period,
      schedule,
      category: category.trim() || null,
      color: color || null,
      emoji: emoji.trim() || null,
      reminder: reminderEnabled
        ? { enabled: true, time: reminderTime || "08:00" }
        : null,
    });
  };

  const toggleWeekday = (day: number) => {
    setWeekdays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day]
    );
  };

  const title = mode === "create" ? "Add New Habit" : "Edit Habit";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="habit-form-title"
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="habit-form-title"
          className="text-xl font-bold text-gray-900 dark:text-gray-100"
        >
          {title}
        </h2>

        {mode === "create" && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowTemplates((value) => !value)}
              aria-expanded={showTemplates}
              className="flex w-full items-center justify-between rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200 dark:bg-gray-700/60 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <span>Start from a template</span>
              <span aria-hidden="true">{showTemplates ? "▾" : "▸"}</span>
            </button>
            {showTemplates && (
              <div className="mt-2 grid max-h-56 grid-cols-2 gap-2 overflow-y-auto pr-1">
                {HABIT_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => applyTemplate(template)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-left transition hover:border-blue-400 hover:bg-blue-50 dark:border-gray-600 dark:bg-gray-700/40 dark:hover:border-blue-500 dark:hover:bg-gray-700"
                  >
                    <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                      {template.emoji} {template.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                      {template.category} · {template.description}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 space-y-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Name
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g., Drink 8 glasses of water"
              autoFocus
              maxLength={120}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Category (optional)
              <input
                type="text"
                list="habit-category-options"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="e.g., Health"
                maxLength={40}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </label>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Emoji (optional)
              <input
                type="text"
                value={emoji}
                onChange={(event) => setEmoji(event.target.value)}
                placeholder="💧"
                maxLength={16}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </label>
          </div>
          <datalist id="habit-category-options">
            {categories.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Colour (optional)
            </legend>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={color === ""}
                onClick={() => setColor("")}
                className={`rounded-lg border px-2 py-1 text-xs transition ${
                  color === ""
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-gray-300 text-gray-500 dark:border-gray-600 dark:text-gray-400"
                }`}
              >
                None
              </button>
              {HABIT_COLORS.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  aria-label={`Use colour ${swatch}`}
                  aria-pressed={color === swatch}
                  onClick={() => setColor(swatch)}
                  style={{ backgroundColor: swatch }}
                  className={`h-7 w-7 rounded-full transition ${
                    color === swatch
                      ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-gray-800"
                      : "hover:opacity-80"
                  }`}
                />
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Reminder (optional)
            </legend>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={reminderEnabled}
                onChange={(event) => setReminderEnabled(event.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              Nudge me if this habit is still open
            </label>
            {reminderEnabled && (
              <label className="mt-2 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span className="shrink-0">At</span>
                <input
                  type="time"
                  value={reminderTime}
                  onChange={(event) => setReminderTime(event.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
              </label>
            )}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Reminders fire on scheduled days only, using your profile time
              zone. Allow notifications when the app asks.
            </p>
          </fieldset>

          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Goal type
              <select
                value={goalType}
                onChange={(event) =>
                  setGoalType(event.target.value as GoalType)
                }
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="yes">Yes / No</option>
                <option value="time">Time</option>
                <option value="count">Count</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Required
              <input
                type="number"
                min="1"
                step="any"
                value={goalType === "yes" ? "1" : required}
                disabled={goalType === "yes"}
                onChange={(event) => setRequired(event.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-60"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Minimum (optional)
              <input
                type="number"
                min="0"
                step="any"
                value={minimum}
                onChange={(event) => setMinimum(event.target.value)}
                placeholder="e.g., 2"
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </label>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Unit (optional)
              <input
                type="text"
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                placeholder="e.g., hours"
                maxLength={40}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </label>
          </div>

          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Period
            <select
              value={period}
              onChange={(event) =>
                setPeriod(event.target.value as GoalPeriod)
              }
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly total</option>
            </select>
          </label>

          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Schedule
            <select
              value={scheduleType}
              onChange={(event) =>
                setScheduleType(event.target.value as HabitSchedule["type"])
              }
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="daily">Every day</option>
              <option value="weekdays">Specific weekdays</option>
              <option value="timesPerWeek">Times per week</option>
            </select>
          </label>

          {scheduleType === "weekdays" && (
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Which days?
              </p>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((day) => {
                  const selected = weekdays.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleWeekday(day.value)}
                      className={`rounded-lg px-3 py-1.5 text-sm transition ${
                        selected
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Off-schedule days are neutral for streaks and percentages.
              </p>
            </div>
          )}

          {scheduleType === "timesPerWeek" && (
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Days per week
              <input
                type="number"
                min="1"
                max="7"
                step="1"
                value={timesPerWeek}
                onChange={(event) => setTimesPerWeek(event.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
              <span className="mt-2 block text-xs font-normal text-gray-500 dark:text-gray-400">
                Any day counts. This is separate from a weekly amount goal.
              </span>
            </label>
          )}

          {period === "weekly" && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Weekly goals add up everything recorded from Monday to Sunday.
            </p>
          )}

          {mode === "edit" && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Target changes apply from today forward; days you already
              recorded keep the target they were saved with. Changing the goal
              type can reinterpret past days.
            </p>
          )}

          {(formError || error) && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/40 dark:text-red-300"
            >
              {formError ?? error}
            </p>
          )}
        </div>

        <div className="mt-6 flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-blue-600 px-6 py-2 text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {busy
              ? mode === "create"
                ? "Adding…"
                : "Saving…"
              : mode === "create"
                ? "Add"
                : "Save changes"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
