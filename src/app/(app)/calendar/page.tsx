"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppNav from "@/components/AppNav";
import DayEditor, { type DayEntrySave } from "@/components/DayEditor";
import HabitLogRow from "@/components/HabitLogRow";
import ProfileAvatar from "@/components/ProfileAvatar";
import { useHabits } from "@/lib/useHabits";
import {
  addMonths,
  getDayOverview,
  getMonthMatrix,
  monthLabel,
  monthOf,
  type DayOverview,
} from "@/lib/domain/calendar";
import {
  filterByCategory,
  groupHabitsByCategory,
  habitCategory,
  listCategories,
} from "@/lib/domain/categories";
import { isScheduled } from "@/lib/domain/habits";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function cellTone(overview: DayOverview): string {
  if (!overview.hasData) {
    return "bg-gray-100 text-gray-500 dark:bg-gray-700/40 dark:text-gray-400";
  }
  if (overview.completion >= 100) {
    return "bg-green-500 text-white";
  }
  if (overview.completion >= 75) {
    return "bg-blue-500 text-white";
  }
  if (overview.completion >= 50) {
    return "bg-amber-400 text-gray-900";
  }
  if (overview.completion > 0) {
    return "bg-orange-500 text-white";
  }
  return "bg-red-500 text-white";
}

export default function CalendarPage() {
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
    toggleDay,
    setDayValue,
  } = useHabits();

  const [month, setMonth] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<
    string | null | undefined
  >(undefined);
  const [editingDay, setEditingDay] = useState<{
    habitId: string;
    date: string;
  } | null>(null);

  if (loading) {
    return (
      <main className="app-main min-h-screen bg-gray-50 px-4 py-12 dark:bg-gray-900">
        <div className="mx-auto max-w-4xl">
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
        <div className="mx-auto max-w-4xl">
          <p className="text-gray-500 dark:text-gray-400">
            Choose a profile to see the calendar.
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

  const activeMonth = month || monthOf(today);
  const selectedDate = selected ?? today;
  const categories = listCategories(habits);
  const hasUncategorized = habits.some((habit) => !habitCategory(habit));
  const visibleHabits = filterByCategory(habits, categoryFilter);
  const weeks = getMonthMatrix(activeMonth);
  const selectedOverview = getDayOverview(
    visibleHabits,
    selectedDate,
    today
  );
  const editableHabits = visibleHabits.filter(
    (habit) => selectedDate >= habit.createdAt
  );
  const scheduledForDay = editableHabits.filter((habit) =>
    isScheduled(habit, selectedDate)
  );
  const offSchedule = editableHabits.filter(
    (habit) => !isScheduled(habit, selectedDate)
  );
  const dayGroups = groupHabitsByCategory(scheduledForDay);
  const editingHabit = editingDay
    ? habits.find((habit) => habit.id === editingDay.habitId) ?? null
    : null;

  const goToMonth = (next: string) => {
    setMonth(next);
    setSelected(null);
  };

  const saveDay = async (input: DayEntrySave) => {
    if (!editingDay) return;
    const updated = await setDayValue(
      editingDay.habitId,
      editingDay.date,
      input
    );
    if (updated) setEditingDay(null);
  };

  return (
    <>
      <AppNav
        active="calendar"
        profile={profile}
        onProfileUpdated={setProfile}
      />
      <main className="app-main min-h-screen bg-gray-50 px-4 py-12 dark:bg-gray-900">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 flex items-center gap-3">
            <ProfileAvatar profile={profile} size="md" />
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                Calendar
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {profile.name} · click a day to log across habits
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

          {habits.length === 0 ? (
            <div className="rounded-lg bg-white p-8 text-center shadow dark:bg-gray-800">
              <p className="text-gray-600 dark:text-gray-300">
                No habits yet. Create one to start filling the calendar.
              </p>
              <Link
                href="/habits?new=1"
                className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
              >
                Create a habit
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {[
                  { key: "all", label: "All", value: undefined },
                  ...categories.map((category) => ({
                    key: category,
                    label: category,
                    value: category as string | null | undefined,
                  })),
                  ...(hasUncategorized
                    ? [
                        {
                          key: "uncategorized",
                          label: "Uncategorized",
                          value: null as string | null | undefined,
                        },
                      ]
                    : []),
                ].map((chip) => {
                  const active = categoryFilter === chip.value;
                  return (
                    <button
                      key={chip.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setCategoryFilter(chip.value)}
                      className={`rounded-full px-3 py-1 text-sm transition ${
                        active
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => goToMonth(addMonths(activeMonth, -1))}
                      aria-label="Previous month"
                      className="rounded-lg bg-gray-100 px-3 py-1.5 text-gray-600 transition hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    >
                      ←
                    </button>
                    <div className="text-center">
                      <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {monthLabel(activeMonth)}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setMonth(monthOf(today));
                          setSelected(today);
                        }}
                        className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Today
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => goToMonth(addMonths(activeMonth, 1))}
                      disabled={addMonths(activeMonth, 1) > monthOf(today)}
                      aria-label="Next month"
                      className="rounded-lg bg-gray-100 px-3 py-1.5 text-gray-600 transition hover:bg-gray-200 disabled:opacity-40 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
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
                          const overview = getDayOverview(
                            visibleHabits,
                            date,
                            today
                          );
                          const future = date > today;
                          const isSelected = date === selectedDate;
                          return (
                            <button
                              key={date}
                              type="button"
                              onClick={() => setSelected(date)}
                              disabled={future}
                              title={
                                overview.hasData
                                  ? `${formatDate(date)} · ${overview.kept}/${overview.scheduled} kept`
                                  : `${formatDate(date)} · no scheduled habits`
                              }
                              aria-label={formatDate(date)}
                              aria-pressed={isSelected}
                              className={`flex aspect-square flex-col items-center justify-center rounded-md text-xs font-medium transition ${cellTone(overview)} ${
                                future ? "cursor-default opacity-50" : "hover:opacity-80"
                              } ${
                                date === today
                                  ? "ring-2 ring-blue-500 ring-offset-1 ring-offset-white dark:ring-offset-gray-800"
                                  : ""
                              } ${isSelected ? "outline outline-2 outline-blue-600" : ""}`}
                            >
                              <span>{Number(date.slice(-2))}</span>
                              {overview.hasData && (
                                <span className="text-[9px] font-normal opacity-90">
                                  {overview.kept}/{overview.scheduled}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                    Colour is the share of scheduled habits kept that day.
                    Skipped, note-only, and off-schedule habits are neutral.
                  </p>
                </section>

                <section className="h-fit rounded-lg bg-white p-4 shadow dark:bg-gray-800">
                  <div className="mb-3">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      {formatDate(selectedDate)}
                    </h2>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {selectedOverview.hasData
                        ? `${selectedOverview.kept} of ${selectedOverview.scheduled} kept · ${selectedOverview.logged} logged`
                        : "Nothing scheduled"}
                      {selectedOverview.skipped > 0
                        ? ` · ${selectedOverview.skipped} rest`
                        : ""}
                    </p>
                  </div>

                  {editableHabits.length === 0 ? (
                    <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-500 dark:bg-gray-700/40 dark:text-gray-400">
                      No habits existed on this day.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {dayGroups.map((group) => (
                        <div key={group.category ?? "uncategorized"}>
                          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            {group.label}
                          </h3>
                          <div className="space-y-2">
                            {group.habits.map((habit) => (
                              <HabitLogRow
                                key={habit.id}
                                habit={habit}
                                date={selectedDate}
                                today={today}
                                busy={busy}
                                onToggle={(id) => void toggleDay(id, selectedDate)}
                                onSetValue={(id, value) =>
                                  void setDayValue(id, selectedDate, {
                                    value:
                                      value === null || value <= 0 ? null : value,
                                  })
                                }
                                onEdit={() =>
                                  setEditingDay({
                                    habitId: habit.id,
                                    date: selectedDate,
                                  })
                                }
                              />
                            ))}
                          </div>
                        </div>
                      ))}

                      {offSchedule.length > 0 && (
                        <div>
                          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Not scheduled
                          </h3>
                          <ul className="space-y-1 rounded-lg bg-gray-50 p-2 text-sm text-gray-500 dark:bg-gray-700/40 dark:text-gray-400">
                            {offSchedule.map((habit) => (
                              <li key={habit.id} className="truncate">
                                {habit.emoji ? `${habit.emoji} ` : ""}
                                {habit.name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </div>
      </main>

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
