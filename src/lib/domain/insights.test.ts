import { describe, expect, it } from "vitest";
import type { Habit } from "@/lib/types";
import { withDayValue } from "@/lib/domain/habits";
import {
  getCategoryInsights,
  getHabitInsights,
  getHabitTrend,
  getInsightsReview,
  getInsightsSummary,
  getOverallTrend,
  getRangeStats,
  getTrendRange,
  getTrendRanges,
  getWeekdayInsights,
} from "@/lib/domain/insights";

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "habit-1",
    name: "Water",
    goalType: "yes",
    required: 1,
    period: "daily",
    schedule: { type: "daily" },
    sortOrder: 0,
    createdAt: "2026-10-01",
    completedDates: [],
    dailyProgress: {},
    ...overrides,
  };
}

describe("trend ranges", () => {
  it("builds Monday-based weeks and calendar months", () => {
    expect(getTrendRange("week", 0, "2026-10-28")).toEqual({
      start: "2026-10-26",
      end: "2026-11-01",
      label: "Oct 26",
    });
    expect(getTrendRange("week", -1, "2026-10-28")).toEqual({
      start: "2026-10-19",
      end: "2026-10-25",
      label: "Oct 19",
    });
    expect(getTrendRange("month", 0, "2026-10-28")).toEqual({
      start: "2026-10-01",
      end: "2026-10-31",
      label: "Oct 2026",
    });
    expect(getTrendRange("month", -1, "2026-10-28")).toEqual({
      start: "2026-09-01",
      end: "2026-09-30",
      label: "Sep 2026",
    });
  });

  it("returns oldest-first ranges ending with the current period", () => {
    expect(
      getTrendRanges("week", 3, "2026-10-28").map((range) => range.start)
    ).toEqual(["2026-10-12", "2026-10-19", "2026-10-26"]);
  });
});

describe("range statistics", () => {
  it("scores scheduled days for daily habits", () => {
    const habit = makeHabit({
      schedule: { type: "weekdays", weekdays: [1, 2, 3, 4, 5] },
      completedDates: ["2026-10-05", "2026-10-06"],
    });

    expect(getRangeStats(habit, "2026-10-05", "2026-10-11", "2026-10-11")).toEqual({
      achieved: 2,
      total: 5,
      completion: 40,
      hasData: true,
      unit: "days",
    });
  });

  it("excludes off-schedule, skipped, and note-only days", () => {
    let habit = makeHabit({
      schedule: { type: "weekdays", weekdays: [1, 2, 3, 4, 5] },
      completedDates: ["2026-10-05", "2026-10-06"],
    });
    habit = withDayValue(habit, "2026-10-06", null, { skipped: true });
    habit = withDayValue(habit, "2026-10-07", null, { note: "Busy" });

    const stats = getRangeStats(habit, "2026-10-05", "2026-10-11", "2026-10-11");
    expect(stats.total).toBe(3); // Mon, Thu, Fri (Tue skipped, Wed note-only)
    expect(stats.achieved).toBe(1);
    expect(stats.completion).toBeCloseTo(100 / 3);
  });

  it("ignores days before creation and future days in the current period", () => {
    const habit = makeHabit({ createdAt: "2026-10-07" });

    expect(
      getRangeStats(habit, "2026-10-05", "2026-10-09", "2026-10-09").total
    ).toBe(3);

    expect(
      getRangeStats(
        makeHabit({ createdAt: "2026-10-01" }),
        "2026-10-01",
        "2026-10-31",
        "2026-10-03"
      ).total
    ).toBe(3); // only Oct 1–3 have happened
  });

  it("scores weeks for weekly and times-per-week habits", () => {
    const habit = makeHabit({
      goalType: "count",
      period: "weekly",
      required: 2,
      createdAt: "2026-10-05",
    });
    let progress = withDayValue(habit, "2026-10-05", 2);
    progress = withDayValue(progress, "2026-10-19", 2);
    // Week of 2026-10-12 has no entries and is missed.

    expect(
      getRangeStats(progress, "2026-10-05", "2026-10-25", "2026-10-28")
    ).toEqual({
      achieved: 2,
      total: 3,
      completion: (2 / 3) * 100,
      hasData: true,
      unit: "weeks",
    });

    const timesPerWeek = makeHabit({
      schedule: { type: "timesPerWeek", timesPerWeek: 2 },
      createdAt: "2026-10-05",
    });
    let scheduled = withDayValue(timesPerWeek, "2026-10-05", 1);
    scheduled = withDayValue(scheduled, "2026-10-06", 1);

    expect(
      getRangeStats(scheduled, "2026-10-05", "2026-10-11", "2026-10-11")
        .completion
    ).toBe(100);
  });
});

describe("aggregate trends", () => {
  it("averages completion across habits with data", () => {
    const complete = makeHabit({
      id: "complete",
      completedDates: [
        "2026-10-05",
        "2026-10-06",
        "2026-10-07",
        "2026-10-08",
        "2026-10-09",
        "2026-10-10",
        "2026-10-11",
      ],
    });
    const missed = makeHabit({ id: "missed" });

    const [point] = getOverallTrend([complete, missed], "week", 1, "2026-10-11");
    expect(point.completion).toBe(50);
    expect(point.habitsCounted).toBe(2);
    expect(point.achieved).toBe(7);
    expect(point.total).toBe(14);
  });

  it("produces per-habit trends in oldest-first order", () => {
    const habit = makeHabit({
      completedDates: ["2026-10-05", "2026-10-12"],
    });
    const trend = getHabitTrend(habit, "week", 3, "2026-10-28");

    expect(trend.map((point) => point.label)).toEqual([
      "Oct 12",
      "Oct 19",
      "Oct 26",
    ]);
    expect(trend[0].completion).toBeCloseTo(100 / 7);
    expect(trend[1].completion).toBe(0);
  });
});

describe("insights summary", () => {
  const today = "2026-10-28";

  it("summarizes streaks, today, and 30-day completion", () => {
    const daily = makeHabit({
      id: "daily",
      completedDates: ["2026-10-25", "2026-10-26", "2026-10-27"],
    });
    const weekly = makeHabit({
      id: "weekly",
      goalType: "count",
      period: "weekly",
      required: 2,
      createdAt: "2026-10-05",
    });
    const weeklyProgress = withDayValue(weekly, "2026-10-19", 2);

    const summary = getInsightsSummary([daily, weeklyProgress], today);
    expect(summary.trackedHabits).toBe(2);
    expect(summary.bestCurrentStreak).toBe(3);
    expect(summary.longestStreak).toBe(3);
    expect(summary.scheduledToday).toBe(2);
    expect(summary.loggedToday).toBe(0);
    expect(summary.completionLast30).toBeCloseTo(
      ((3 / 28) * 100 + (1 / 4) * 100) / 2
    );
  });

  it("returns zeroes for an empty habit list", () => {
    expect(getInsightsSummary([], today)).toEqual({
      trackedHabits: 0,
      completionLast30: 0,
      bestCurrentStreak: 0,
      longestStreak: 0,
      scheduledToday: 0,
      loggedToday: 0,
    });
  });

  it("bundles per-habit cards", () => {
    const [insight] = getHabitInsights(
      [makeHabit({ completedDates: [today] })],
      "week",
      4,
      today
    );

    expect(insight.currentStreak).toBe(1);
    expect(insight.bestStreak).toBe(1);
    expect(insight.trend).toHaveLength(4);
    expect(insight.completionLast30).toBeCloseTo(100 / 28);
  });
});

describe("insights review", () => {
  const today = "2026-10-28";

  it("summarizes the current week and month", () => {
    const daily = makeHabit({
      id: "daily",
      completedDates: Array.from({ length: 28 }, (_, index) =>
        `2026-10-${String(index + 1).padStart(2, "0")}`
      ),
    });
    const missed = makeHabit({ id: "missed" });

    const review = getInsightsReview([daily, missed], today);

    expect(review.week).toMatchObject({
      start: "2026-10-26",
      end: "2026-11-01",
      label: "Oct 26",
      completion: 50,
      habitsTracked: 2,
      daysLeft: 4,
      hasData: true,
    });
    expect(review.week.achieved).toBe(3);
    expect(review.week.total).toBe(6);

    expect(review.month).toMatchObject({
      start: "2026-10-01",
      end: "2026-10-31",
      label: "Oct 2026",
      completion: 50,
      habitsTracked: 2,
      daysLeft: 3,
    });

    expect(review.strongest?.habit.id).toBe("daily");
    expect(review.strongest?.completion).toBe(100);
    expect(review.weakest?.habit.id).toBe("missed");
    expect(review.weakest?.completion).toBe(0);
  });

  it("has no ranking for a single habit and no data", () => {
    const review = getInsightsReview([], today);
    expect(review.week.hasData).toBe(false);
    expect(review.month.hasData).toBe(false);
    expect(review.strongest).toBeNull();
    expect(review.weakest).toBeNull();
  });
});

describe("weekday insights", () => {
  it("groups daily completions by weekday, Monday first", () => {
    const mondays = makeHabit({
      schedule: { type: "weekdays", weekdays: [1] },
      createdAt: "2026-09-28",
      completedDates: ["2026-10-05", "2026-10-12"],
    });

    const days = getWeekdayInsights([mondays], "2026-10-11", 7);

    expect(days.map((day) => day.label)).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ]);
    expect(days[0]).toMatchObject({
      weekday: 1,
      achieved: 1,
      total: 1,
      completion: 100,
      hasData: true,
    });
    expect(days[1].hasData).toBe(false);
  });

  it("excludes weekly goals because they are scored by week", () => {
    const weekly = makeHabit({
      goalType: "count",
      period: "weekly",
      required: 3,
      createdAt: "2026-10-01",
    });

    expect(
      getWeekdayInsights([weekly], "2026-10-28", 28).every(
        (day) => !day.hasData
      )
    ).toBe(true);
  });
});

describe("category insights", () => {
  const today = "2026-10-28";

  it("averages habits per category and keeps uncategorized last", () => {
    const healthComplete = makeHabit({
      id: "health-complete",
      category: "Health",
      completedDates: ["2026-10-27", "2026-10-28"],
    });
    const healthMissed = makeHabit({
      id: "health-missed",
      category: "health",
    });
    const mindComplete = makeHabit({
      id: "mind-complete",
      category: "Mind",
      completedDates: ["2026-10-27", "2026-10-28"],
    });
    const uncategorized = makeHabit({ id: "uncategorized" });

    const categories = getCategoryInsights(
      [healthComplete, healthMissed, mindComplete, uncategorized],
      today
    );

    expect(categories.map((category) => category.label)).toEqual([
      "Health",
      "Mind",
      "Uncategorized",
    ]);
    expect(categories[0]).toMatchObject({ habits: 2, tracked: 2 });
    // Two of 28 days kept for one habit, none for the other.
    expect(categories[0].completion).toBeCloseTo(100 / 28);
    expect(categories[1].completion).toBeCloseTo(200 / 28);
    expect(categories[2].completion).toBe(0);
  });
});
