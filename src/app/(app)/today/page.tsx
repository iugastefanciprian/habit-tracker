"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import DayEditor, { type DayEntrySave } from "@/components/DayEditor";
import HabitDetail from "@/components/HabitDetail";
import HabitLogRow from "@/components/HabitLogRow";
import ProfileAvatar from "@/components/ProfileAvatar";
import { useHabits } from "@/lib/useHabits";
import { usePush } from "@/lib/usePush";
import { useReminders } from "@/lib/useReminders";
import { isHandledToday, reminderLabel } from "@/lib/domain/reminders";
import { isScheduled } from "@/lib/domain/habits";
import { groupHabitsByCategory } from "@/lib/domain/categories";
import { SUGGESTED_TEMPLATES } from "@/lib/domain/templates";

function formatDay(iso: string): string {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function TodayPage() {
  const router = useRouter();
  const {
    profile,
    habits,
    today,
    loading,
    importing,
    busy,
    error,
    setProfile,
    createHabit,
    toggleDay,
    setDayValue,
  } = useHabits();
  const push = usePush(profile);
  const { reminders, dismiss: dismissReminder } = useReminders(
    habits,
    profile,
    today,
    { notify: !push.loading && !push.subscribed }
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingDay, setEditingDay] = useState<{
    habitId: string;
    date: string;
  } | null>(null);

  if (loading) {
    return (
      <main className="app-main min-h-screen bg-gray-50 px-4 py-12 dark:bg-gray-900">
        <div className="mx-auto max-w-2xl">
          <p className="text-gray-500 dark:text-gray-400">
            {importing ? "Importing your local data…" : "Loading…"}
          </p>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="app-main min-h-screen bg-gray-50 px-4 py-12 dark:bg-gray-900">
        <div className="mx-auto max-w-2xl">
          <p className="text-gray-500 dark:text-gray-400">
            Choose a profile to start tracking.
          </p>
          <button
            type="button"
            onClick={() => router.push("/profiles")}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
          >
            Choose a profile
          </button>
        </div>
      </main>
    );
  }

  const scheduled = habits.filter((habit) => isScheduled(habit, today));
  const notScheduled = habits.filter((habit) => !isScheduled(habit, today));
  const done = scheduled.filter((habit) => isHandledToday(habit, today)).length;
  const remaining = scheduled.length - done;
  const percent = scheduled.length === 0 ? 0 : (done / scheduled.length) * 100;
  const groups = groupHabitsByCategory(scheduled);
  const selectedHabit = selectedId
    ? habits.find((habit) => habit.id === selectedId) ?? null
    : null;
  const editingHabit = editingDay
    ? habits.find((habit) => habit.id === editingDay.habitId) ?? null
    : null;

  const saveDay = async (input: DayEntrySave) => {
    if (!editingDay) return;
    const updated = await setDayValue(editingDay.habitId, editingDay.date, input);
    if (updated) setEditingDay(null);
  };

  const addTemplate = async (template: (typeof SUGGESTED_TEMPLATES)[number]) => {
    await createHabit({
      name: template.name,
      goalType: template.goalType,
      required: template.required,
      minimum: template.minimum,
      unit: template.unit,
      period: template.period,
      schedule: template.schedule,
      category: template.category,
      color: template.color,
      emoji: template.emoji,
    });
  };

  return (
    <>
      <AppNav active="today" profile={profile} onProfileUpdated={setProfile} />
      <main className="app-main min-h-screen bg-gray-50 px-4 py-12 dark:bg-gray-900">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 flex items-center gap-3">
            <ProfileAvatar profile={profile} size="md" />
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                Today
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {formatDay(today)} · {profile.name}
              </p>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/40 dark:text-red-300"
            >
              {error}
            </p>
          )}

          {reminders.length > 0 && (
            <section
              aria-label="Reminders"
              className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-700/60 dark:bg-amber-900/20"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  {reminders.length === 1
                    ? "1 habit still needs you"
                    : `${reminders.length} habits still need you`}
                </h2>
                {push.status?.enabled && !push.subscribed && (
                  <button
                    type="button"
                    onClick={() => void push.subscribe()}
                    disabled={push.busy}
                    className="shrink-0 rounded-lg bg-amber-600 px-2 py-1 text-xs text-white transition hover:bg-amber-700 disabled:opacity-60"
                  >
                    {push.busy ? "Enabling…" : "Enable background reminders"}
                  </button>
                )}
              </div>
              <ul className="mt-2 space-y-1">
                {reminders.map((habit) => (
                  <li
                    key={habit.id}
                    className="flex items-center justify-between gap-2 text-sm text-amber-900 dark:text-amber-100"
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-medium">
                        {habit.emoji ? `${habit.emoji} ` : ""}
                        {habit.name}
                      </span>
                      {reminderLabel(habit) && (
                        <span className="ml-1 text-xs opacity-75">
                          · since {reminderLabel(habit)}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => dismissReminder(habit.id)}
                      className="shrink-0 text-xs underline underline-offset-2 opacity-80 hover:opacity-100"
                    >
                      Dismiss
                    </button>
                  </li>
                ))}
              </ul>
              {push.error && (
                <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
                  {push.error}
                </p>
              )}
              {!push.subscribed && (
                <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
                  These reminders only appear while the app is open. Enable
                  background reminders in Settings to be notified anywhere.
                </p>
              )}
            </section>
          )}

          {habits.length === 0 ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-white p-8 text-center shadow dark:bg-gray-800">
                <p className="text-gray-600 dark:text-gray-300">
                  No habits yet. Start with a template, or build your own.
                </p>
                <Link
                  href="/habits?new=1"
                  className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
                >
                  Create your own
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {SUGGESTED_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => void addTemplate(template)}
                    disabled={busy}
                    className="rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-400 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-500"
                  >
                    <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {template.emoji} {template.name}
                    </span>
                    <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                      {template.category} · {template.description}
                    </span>
                    <span className="mt-2 inline-block text-xs font-medium text-blue-600 dark:text-blue-400">
                      Add habit
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="mb-4 rounded-lg bg-white p-4 shadow dark:bg-gray-800">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {done} of {scheduled.length} handled
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {remaining === 0
                      ? "All done for today"
                      : `${remaining} remaining`}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-end gap-3 text-xs">
                  <Link
                    href="/habits"
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Habit grid
                  </Link>
                  <Link
                    href="/calendar"
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Calendar
                  </Link>
                </div>
              </div>

              <div className="space-y-6">
                {scheduled.length === 0 && (
                  <p className="rounded-lg bg-white p-6 text-center text-sm text-gray-500 shadow dark:bg-gray-800 dark:text-gray-400">
                    Nothing is scheduled for today. Enjoy the rest day.
                  </p>
                )}

                {groups.map((group) => {
                  const groupDone = group.habits.filter((habit) =>
                    isHandledToday(habit, today)
                  ).length;
                  return (
                    <section
                      key={group.category ?? "uncategorized"}
                      aria-label={group.label}
                    >
                      <div className="mb-2 flex items-baseline justify-between">
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          {group.label}
                        </h2>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {groupDone}/{group.habits.length}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {group.habits.map((habit) => (
                          <HabitLogRow
                            key={habit.id}
                            habit={habit}
                            date={today}
                            today={today}
                            busy={busy}
                            onToggle={(id) => void toggleDay(id, today)}
                            onSetValue={(id, value) =>
                              void setDayValue(id, today, {
                                value: value === null || value <= 0 ? null : value,
                              })
                            }
                            onEdit={() =>
                              setEditingDay({ habitId: habit.id, date: today })
                            }
                            onOpenDetail={(habit) => setSelectedId(habit.id)}
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>

              {notScheduled.length > 0 && (
                <div className="mt-6 rounded-lg bg-white p-4 shadow dark:bg-gray-800">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Not scheduled today
                  </h2>
                  <ul className="mt-2 space-y-1 text-sm text-gray-500 dark:text-gray-400">
                    {notScheduled.map((habit) => (
                      <li key={habit.id}>
                        {habit.emoji ? `${habit.emoji} ` : ""}
                        {habit.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {selectedHabit && !editingDay && (
        <HabitDetail
          habit={selectedHabit}
          today={today}
          onClose={() => setSelectedId(null)}
          onToggle={(id) => void toggleDay(id, today)}
          onEditDay={(date) => {
            setSelectedId(null);
            setEditingDay({ habitId: selectedHabit.id, date });
          }}
        />
      )}

      {editingHabit && editingDay && (
        <DayEditor
          habit={editingHabit}
          date={editingDay.date}
          today={today}
          onSave={(input) => void saveDay(input)}
          onClose={() => setEditingDay(null)}
        />
      )}
    </>
  );
}
