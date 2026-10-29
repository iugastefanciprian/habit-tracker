"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import ProfileAvatar from "@/components/ProfileAvatar";
import { useHabits } from "@/lib/useHabits";
import {
  describeSchedule,
  getSchedule,
  getWeekProgress,
  isWeeklyEvaluation,
  mondayOfWeek,
  type WeekStatus,
} from "@/lib/domain/habits";
import {
  getCategoryInsights,
  getHabitInsights,
  getInsightsReview,
  getInsightsSummary,
  getOverallTrend,
  getRangeStats,
  getWeekdayInsights,
  type TrendGranularity,
} from "@/lib/domain/insights";

const WEEK_COUNT = 8;
const MONTH_COUNT = 6;

function barColor(completion: number): string {
  if (completion >= 80) return "bg-green-500";
  if (completion >= 50) return "bg-blue-500";
  if (completion >= 25) return "bg-amber-400";
  return "bg-red-500";
}

function statusLabel(status: WeekStatus): string {
  switch (status) {
    case "achieved":
      return "complete";
    case "failed":
      return "missed";
    case "skipped":
      return "skipped";
    case "partial":
      return "in progress";
    case "empty":
      return "no entry yet";
    default:
      return "not started";
  }
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
        {value}
      </p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{detail}</p>
    </div>
  );
}

function TrendChart({
  points,
  granularity,
}: {
  points: ReturnType<typeof getOverallTrend>;
  granularity: TrendGranularity;
}) {
  return (
    <div className="overflow-x-auto pb-2">
      <div
        className="flex min-w-[34rem] items-end gap-3"
        role="img"
        aria-label={`${granularity === "week" ? "Weekly" : "Monthly"} completion trend`}
      >
        {points.map((point) => {
          const height = point.hasData ? Math.max(3, point.completion) : 0;
          const value = point.hasData
            ? `${Math.round(point.completion)}%`
            : "—";
          return (
            <div
              key={point.start}
              className="flex flex-1 flex-col items-center gap-1.5"
              title={`${point.label}: ${value} average completion (${point.habitsCounted} ${
                point.habitsCounted === 1 ? "habit" : "habits"
              })`}
            >
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                {value}
              </span>
              <div className="flex h-40 w-full items-end overflow-hidden rounded-md bg-gray-100 dark:bg-gray-700/50">
                <div
                  className={`w-full rounded-t-md transition-all ${
                    point.hasData ? barColor(point.completion) : "bg-gray-300 dark:bg-gray-600"
                  }`}
                  style={{ height: `${height}%` }}
                />
              </div>
              <span className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                {point.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniTrend({
  points,
}: {
  points: ReturnType<typeof getHabitInsights>[number]["trend"];
}) {
  return (
    <div
      className="flex h-12 items-end gap-1"
      role="img"
      aria-label="Completion trend"
    >
      {points.map((point) => {
        const height = point.hasData ? Math.max(4, point.completion) : 0;
        const value = point.hasData ? `${Math.round(point.completion)}%` : "—";
        return (
          <div
            key={point.start}
            className="flex h-full flex-1 items-end overflow-hidden rounded-sm bg-gray-100 dark:bg-gray-700/50"
            title={`${point.label}: ${value} (${point.achieved}/${point.total} ${point.unit})`}
          >
            <div
              className={`w-full rounded-sm ${
                point.hasData ? barColor(point.completion) : "bg-gray-300 dark:bg-gray-600"
              }`}
              style={{ height: `${height}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function InsightsPage() {
  const router = useRouter();
  const { profile, habits, today, loading, importing, error, setProfile } =
    useHabits();
  const [granularity, setGranularity] = useState<TrendGranularity>("week");

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
            Choose a profile to see insights.
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

  const count = granularity === "week" ? WEEK_COUNT : MONTH_COUNT;
  const summary = getInsightsSummary(habits, today);
  const trend = getOverallTrend(habits, granularity, count, today);
  const habitInsights = getHabitInsights(habits, granularity, count, today);
  const review = getInsightsReview(habits, today);
  const categoryInsights = getCategoryInsights(habits, today);
  const weekdayInsights = getWeekdayInsights(habits, today);
  const hasCategorizedHabits = categoryInsights.some(
    (category) => category.category !== null
  );
  const periodLabel = granularity === "week" ? "week" : "month";

  return (
    <>
      <AppNav
        active="insights"
        profile={profile}
        onProfileUpdated={setProfile}
      />
      <main className="app-main min-h-screen bg-gray-50 px-4 py-12 dark:bg-gray-900">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 flex items-center gap-3">
            <ProfileAvatar profile={profile} size="md" />
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                Insights
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {profile.name} · completion, consistency, and streaks
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
                No active habits yet. Create one to start building insights.
              </p>
              <button
                type="button"
                onClick={() => router.push("/habits?new=1")}
                className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
              >
                Create a habit
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                  label="30-day completion"
                  value={`${Math.round(summary.completionLast30)}%`}
                  detail="Average across active habits"
                />
                <StatCard
                  label="Active streak"
                  value={summary.bestCurrentStreak}
                  detail="Best current run"
                />
                <StatCard
                  label="Longest streak"
                  value={summary.longestStreak}
                  detail="All-time best"
                />
                <StatCard
                  label="Today"
                  value={`${summary.loggedToday}/${summary.scheduledToday}`}
                  detail="Logged or kept"
                />
              </div>

              <section
                aria-label="Current week and month"
                className="mt-6 grid gap-3 sm:grid-cols-2"
              >
                {[review.week, review.month].map((period) => (
                  <div
                    key={period.start}
                    className="rounded-lg bg-white p-5 shadow dark:bg-gray-800"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {period.label}
                      </h3>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {period.daysLeft === 0
                          ? "Last day"
                          : `${period.daysLeft} ${
                              period.daysLeft === 1 ? "day" : "days"
                            } left`}
                      </span>
                    </div>
                    <p className="mt-3 text-3xl font-bold text-gray-900 dark:text-gray-100">
                      {period.hasData
                        ? `${Math.round(period.completion)}%`
                        : "—"}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {period.hasData
                        ? `${period.achieved} of ${period.total} kept · ${period.habitsTracked} ${
                            period.habitsTracked === 1 ? "habit" : "habits"
                          }`
                        : "Nothing scheduled yet"}
                    </p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                      <div
                        className={`h-full rounded-full ${barColor(period.completion)}`}
                        style={{
                          width: `${period.hasData ? Math.max(2, period.completion) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}

                {(review.strongest || review.weakest) && (
                  <div className="flex flex-wrap gap-2 text-xs sm:col-span-2">
                    {review.strongest && (
                      <span className="rounded-full bg-green-50 px-3 py-1 text-green-800 dark:bg-green-900/30 dark:text-green-200">
                        Strongest: {review.strongest.habit.name} ·{" "}
                        {Math.round(review.strongest.completion)}%
                      </span>
                    )}
                    {review.weakest && (
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                        Needs attention: {review.weakest.habit.name} ·{" "}
                        {Math.round(review.weakest.completion)}%
                      </span>
                    )}
                  </div>
                )}
              </section>

              <section
                aria-labelledby="trend-heading"
                className="mt-6 rounded-lg bg-white p-5 shadow dark:bg-gray-800"
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2
                      id="trend-heading"
                      className="text-lg font-semibold text-gray-900 dark:text-gray-100"
                    >
                      Completion trend
                    </h2>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Habits with activity in the period weigh equally.
                      In-progress periods are partial.
                    </p>
                  </div>
                  <div className="flex rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
                    {(["week", "month"] as TrendGranularity[]).map((option) => (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={granularity === option}
                        onClick={() => setGranularity(option)}
                        className={`rounded-md px-3 py-1.5 text-sm transition ${
                          granularity === option
                            ? "bg-white text-gray-900 shadow dark:bg-gray-800 dark:text-gray-100"
                            : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                        }`}
                      >
                        {option === "week"
                          ? `Last ${WEEK_COUNT} weeks`
                          : `Last ${MONTH_COUNT} months`}
                      </button>
                    ))}
                  </div>
                </div>

                <TrendChart points={trend} granularity={granularity} />
              </section>

              {hasCategorizedHabits && (
                <section
                  aria-labelledby="categories-heading"
                  className="mt-6 rounded-lg bg-white p-5 shadow dark:bg-gray-800"
                >
                  <h2
                    id="categories-heading"
                    className="text-lg font-semibold text-gray-900 dark:text-gray-100"
                  >
                    By category
                  </h2>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Last 30 days, averaged per habit.
                  </p>
                  <ul className="mt-4 space-y-3">
                    {categoryInsights.map((category) => (
                      <li key={category.label}>
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="truncate font-medium text-gray-900 dark:text-gray-100">
                            {category.label}
                          </span>
                          <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                            {category.hasData
                              ? `${Math.round(category.completion)}%`
                              : "No data"}{" "}
                            ·{" "}
                            {category.habits === 1
                              ? "1 habit"
                              : `${category.habits} habits`}
                          </span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                          <div
                            className={`h-full rounded-full ${
                              category.hasData
                                ? barColor(category.completion)
                                : "bg-gray-300 dark:bg-gray-600"
                            }`}
                            style={{
                              width: `${
                                category.hasData
                                  ? Math.max(2, category.completion)
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {weekdayInsights.some((day) => day.hasData) && (
                <section
                  aria-labelledby="weekdays-heading"
                  className="mt-6 rounded-lg bg-white p-5 shadow dark:bg-gray-800"
                >
                  <h2
                    id="weekdays-heading"
                    className="text-lg font-semibold text-gray-900 dark:text-gray-100"
                  >
                    Best days
                  </h2>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Last 90 days across daily habits. Weekly goals are scored by
                    week, so they are not counted here.
                  </p>
                  <div
                    className="mt-4 flex items-end gap-2"
                    role="img"
                    aria-label="Completion by weekday"
                  >
                    {weekdayInsights.map((day) => (
                      <div
                        key={day.weekday}
                        className="flex flex-1 flex-col items-center gap-1"
                        title={`${day.label}: ${
                          day.hasData
                            ? `${Math.round(day.completion)}% (${day.achieved}/${day.total})`
                            : "no scheduled days"
                        }`}
                      >
                        <span className="text-[11px] text-gray-600 dark:text-gray-300">
                          {day.hasData ? `${Math.round(day.completion)}%` : "—"}
                        </span>
                        <div className="flex h-28 w-full items-end overflow-hidden rounded-md bg-gray-100 dark:bg-gray-700/50">
                          <div
                            className={`w-full rounded-t-md ${
                              day.hasData
                                ? barColor(day.completion)
                                : "bg-gray-300 dark:bg-gray-600"
                            }`}
                            style={{
                              height: `${
                                day.hasData
                                  ? Math.max(3, day.completion)
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {day.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section aria-labelledby="habits-heading" className="mt-6">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <h2
                      id="habits-heading"
                      className="text-lg font-semibold text-gray-900 dark:text-gray-100"
                    >
                      Habit trends
                    </h2>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Per-habit 30-day completion, streaks, and {periodLabel}ly
                      history.
                    </p>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {habits.length} active
                  </span>
                </div>

                <div className="space-y-3">
                  {habitInsights.map(
                    ({
                      habit,
                      currentStreak,
                      bestStreak,
                      completionLast30,
                      completionSinceCreation,
                      trend: habitTrend,
                    }) => {
                      const weekly = isWeeklyEvaluation(habit);
                      const streakUnit = weekly ? "week" : "day";
                      const week = getWeekProgress(
                        habit,
                        mondayOfWeek(today),
                        today
                      );
                      const weekUnit =
                        getSchedule(habit).type === "timesPerWeek"
                          ? " days"
                          : habit.unit
                            ? ` ${habit.unit}`
                            : "";
                      const currentWeekStats = weekly
                        ? null
                        : getRangeStats(
                            habit,
                            week.weekStart,
                            week.weekEnd,
                            today
                          );

                      return (
                        <article
                          key={habit.id}
                          className="rounded-lg bg-white p-5 shadow dark:bg-gray-800"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">
                                {habit.emoji ? `${habit.emoji} ` : ""}
                                {habit.name}
                              </h3>
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                {describeSchedule(getSchedule(habit))} ·{" "}
                                {habit.period === "weekly"
                                  ? "weekly total"
                                  : "daily"}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                🔥 {currentStreak} {streakUnit}
                                {currentStreak === 1 ? "" : "s"}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Best {bestStreak}
                              </p>
                            </div>
                          </div>

                          <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
                            <div className="rounded-lg bg-gray-50 px-2 py-2 dark:bg-gray-700/50">
                              <dt className="text-xs text-gray-500 dark:text-gray-400">
                                30 days
                              </dt>
                              <dd className="mt-0.5 text-lg font-semibold text-gray-900 dark:text-gray-100">
                                {Math.round(completionLast30)}%
                              </dd>
                            </div>
                            <div className="rounded-lg bg-gray-50 px-2 py-2 dark:bg-gray-700/50">
                              <dt className="text-xs text-gray-500 dark:text-gray-400">
                                Since start
                              </dt>
                              <dd className="mt-0.5 text-lg font-semibold text-gray-900 dark:text-gray-100">
                                {Math.round(completionSinceCreation)}%
                              </dd>
                            </div>
                            <div className="rounded-lg bg-gray-50 px-2 py-2 dark:bg-gray-700/50">
                              <dt className="text-xs text-gray-500 dark:text-gray-400">
                                This week
                              </dt>
                              <dd className="mt-0.5 text-lg font-semibold text-gray-900 dark:text-gray-100">
                                {weekly
                                  ? `${week.achieved}/${week.target}`
                                  : `${Math.round(
                                      currentWeekStats?.completion ?? 0
                                    )}%`}
                              </dd>
                            </div>
                          </dl>

                          <div className="mt-4">
                            <div className="mb-1.5 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                              <span>
                                Last {count} {periodLabel}s
                              </span>
                              {weekly && (
                                <span>
                                  This week: {statusLabel(week.status)}
                                  {weekUnit ? ` · ${week.achieved}/${week.target}${weekUnit}` : ""}
                                </span>
                              )}
                            </div>
                            <MiniTrend points={habitTrend} />
                          </div>
                        </article>
                      );
                    }
                  )}
                </div>
              </section>

              <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
                Off-schedule, skipped, and note-only days are neutral and never
                lower completion.
              </p>
            </>
          )}
        </div>
      </main>
    </>
  );
}
