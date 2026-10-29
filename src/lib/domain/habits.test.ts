import { describe, expect, it } from "vitest";
import type { Habit } from "@/lib/types";
import {
  addDaysISO,
  calculateBestStreak,
  calculateStreak,
  compareHabits,
  dateISOInTimeZone,
  describeSchedule,
  getActual,
  getDayColor,
  getDayStatus,
  getDaysWindow,
  getRatio,
  getWeekProgress,
  getWeekRange,
  getWeekTarget,
  getWeeklyAchieved,
  habitAgeDays,
  isAchieved,
  isDayAchieved,
  isDayFailed,
  isFailed,
  isNoteOnly,
  isWeeklyEvaluation,
  percentKeptLastDays,
  percentKeptSinceCreation,
  sortHabits,
  todayISO,
  withDayValue,
} from "@/lib/domain/habits";

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "habit-1",
    name: "Water",
    goalType: "count",
    required: 8,
    period: "daily",
    schedule: { type: "daily" },
    sortOrder: 0,
    createdAt: "2026-01-01",
    completedDates: [],
    dailyProgress: {},
    ...overrides,
  };
}

describe("withDayValue", () => {
  it("stores progress, snapshots the target, and completes at the required amount", () => {
    const habit = makeHabit();
    const updated = withDayValue(habit, "2026-01-02", 8);

    expect(updated.dailyProgress["2026-01-02"]).toEqual({
      value: 8,
      achieved: true,
      target: 8,
    });
    expect(updated.completedDates).toContain("2026-01-02");
    expect(habit.dailyProgress["2026-01-02"]).toBeUndefined();
  });

  it("keeps partial progress out of completedDates", () => {
    const updated = withDayValue(makeHabit(), "2026-01-02", 3);

    expect(updated.dailyProgress["2026-01-02"]).toEqual({
      value: 3,
      achieved: false,
      target: 8,
    });
    expect(updated.completedDates).not.toContain("2026-01-02");
  });

  it("clears a day when value is null or non-positive", () => {
    const withValue = withDayValue(makeHabit(), "2026-01-02", 8);
    const cleared = withDayValue(withValue, "2026-01-02", null);

    expect(cleared.dailyProgress["2026-01-02"]).toBeUndefined();
    expect(cleared.completedDates).not.toContain("2026-01-02");
  });

  it("removes an existing completion when lowering the value", () => {
    const complete = withDayValue(makeHabit(), "2026-01-02", 8);
    const lowered = withDayValue(complete, "2026-01-02", 2);

    expect(lowered.completedDates).not.toContain("2026-01-02");
    expect(lowered.dailyProgress["2026-01-02"].achieved).toBe(false);
  });

  it("ignores dates before the habit was created", () => {
    const habit = makeHabit();
    expect(withDayValue(habit, "2025-12-31", 8)).toBe(habit);
  });

  it("treats yes/no habits as required = 1", () => {
    const habit = makeHabit({ goalType: "yes", required: 1 });

    expect(isAchieved(withDayValue(habit, "2026-01-02", 1), "2026-01-02")).toBe(true);
    expect(isAchieved(withDayValue(habit, "2026-01-03", 0), "2026-01-03")).toBe(false);
  });

  it("snapshots the target so later goal changes do not rewrite history", () => {
    const completed = withDayValue(makeHabit({ required: 8 }), "2026-01-02", 8);
    const retargeted = { ...completed, required: 12 };

    expect(isAchieved(retargeted, "2026-01-02")).toBe(true);

    const later = withDayValue(retargeted, "2026-01-03", 8);
    expect(later.dailyProgress["2026-01-03"].target).toBe(12);
    expect(isAchieved(later, "2026-01-03")).toBe(false);
  });

  it("records skipped days without completing them", () => {
    const skipped = withDayValue(makeHabit(), "2026-01-02", null, {
      skipped: true,
      note: "Travel",
    });

    expect(getDayStatus(skipped, "2026-01-02")).toBe("skipped");
    expect(skipped.completedDates).not.toContain("2026-01-02");
    expect(skipped.dailyProgress["2026-01-02"]).toMatchObject({
      value: 0,
      achieved: false,
      skipped: true,
      note: "Travel",
    });
  });
});

describe("habit ordering", () => {
  it("sorts by manual position, then creation date, then id", () => {
    const later = makeHabit({
      id: "later",
      sortOrder: 0,
      createdAt: "2026-02-01",
    });
    const earlier = makeHabit({
      id: "earlier",
      sortOrder: 0,
      createdAt: "2026-01-01",
    });
    const first = makeHabit({
      id: "first",
      sortOrder: -1,
      createdAt: "2026-03-01",
    });

    expect(sortHabits([later, earlier, first]).map((habit) => habit.id)).toEqual([
      "first",
      "earlier",
      "later",
    ]);
    expect(compareHabits(earlier, later)).toBeLessThan(0);
  });
});

describe("achievement helpers", () => {
  it("computes actual values and ratios", () => {
    const habit = withDayValue(makeHabit(), "2026-01-02", 4);

    expect(getActual(habit, "2026-01-02")).toBe(4);
    expect(getRatio(habit, "2026-01-02")).toBe(0.5);
    expect(isAchieved(habit, "2026-01-02")).toBe(false);
    expect(isFailed(habit, "2026-01-02")).toBe(false);
  });

  it("uses minimum only to flag failure", () => {
    const habit = makeHabit({ minimum: 2 });
    const belowMinimum = withDayValue(habit, "2026-01-02", 1);

    expect(isFailed(belowMinimum, "2026-01-02")).toBe(true);
    expect(isAchieved(belowMinimum, "2026-01-02")).toBe(false);
  });

  it("treats zero progress as failed", () => {
    const habit = withDayValue(makeHabit(), "2026-01-02", 1);
    const clearedDay = withDayValue(habit, "2026-01-03", 0);

    expect(isFailed(habit, "2026-01-02")).toBe(false);
    expect(isFailed(clearedDay, "2026-01-03")).toBe(true);
  });

  it("derives a single status per day", () => {
    const habit = makeHabit({
      createdAt: "2026-01-02",
      schedule: { type: "weekdays", weekdays: [1, 2, 3, 4, 5] },
    });

    expect(getDayStatus(habit, "2026-01-01")).toBe("before"); // before creation
    expect(getDayStatus(habit, "2026-01-03")).toBe("off"); // Saturday
    expect(getDayStatus(habit, "2026-01-05")).toBe("empty"); // Monday, no entry

    const partial = withDayValue(habit, "2026-01-05", 3);
    expect(getDayStatus(partial, "2026-01-05")).toBe("partial");

    const achieved = withDayValue(habit, "2026-01-05", 8);
    expect(getDayStatus(achieved, "2026-01-05")).toBe("achieved");
  });
});

describe("date windows", () => {
  const today = todayISO();

  it("returns a newest-first window starting today", () => {
    const window = getDaysWindow(makeHabit({ createdAt: "2020-01-01" }), 3, today);

    expect(window.map((day) => day.date)).toEqual([
      today,
      addDaysISO(today, -1),
      addDaysISO(today, -2),
    ]);
  });

  it("flags days before creation", () => {
    const habit = makeHabit({ createdAt: addDaysISO(today, -1) });
    const window = getDaysWindow(habit, 3, today);

    expect(window[0].beforeCreation).toBe(false);
    expect(window[1].beforeCreation).toBe(false);
    expect(window[2].beforeCreation).toBe(true);
    expect(getDayColor(habit, window[2].date)).toBe("none");
  });

  it("calculates habit age from creation", () => {
    expect(habitAgeDays(makeHabit({ createdAt: today }), today)).toBe(1);
    expect(habitAgeDays(makeHabit({ createdAt: addDaysISO(today, -9) }), today)).toBe(10);
  });

  it("finds the Monday-based week range", () => {
    expect(getWeekRange("2026-10-27")).toEqual({
      start: "2026-10-26",
      end: "2026-11-01",
    });
  });
});

describe("local dates", () => {
  it("formats the date in the requested time zone", () => {
    const instant = new Date("2026-10-27T02:00:00Z");

    expect(dateISOInTimeZone(instant, "America/New_York")).toBe("2026-10-26");
    expect(dateISOInTimeZone(instant, "Asia/Tokyo")).toBe("2026-10-27");
  });

  it("shifts the day boundary by dayStartHour", () => {
    const instant = new Date("2026-10-27T06:00:00Z"); // 02:00 in New York

    expect(dateISOInTimeZone(instant, "America/New_York")).toBe("2026-10-27");
    expect(dateISOInTimeZone(instant, "America/New_York", 4)).toBe("2026-10-26");
  });

  it("falls back safely for an unknown time zone", () => {
    expect(() =>
      dateISOInTimeZone(new Date("2026-10-27T12:00:00Z"), "Not/AZone")
    ).not.toThrow();
  });
});

describe("streaks and percentages", () => {
  const today = todayISO();

  it("counts consecutive days ending today", () => {
    const habit = makeHabit({
      goalType: "yes",
      required: 1,
      createdAt: addDaysISO(today, -10),
      completedDates: [
        addDaysISO(today, -2),
        addDaysISO(today, -1),
        today,
      ],
    });
    expect(calculateStreak(habit, today)).toBe(3);
  });

  it("counts a streak ending yesterday", () => {
    const habit = makeHabit({
      goalType: "yes",
      required: 1,
      createdAt: addDaysISO(today, -10),
      completedDates: [addDaysISO(today, -1)],
    });
    expect(calculateStreak(habit, today)).toBe(1);
  });

  it("breaks on gaps and empty input", () => {
    const habit = makeHabit({
      goalType: "yes",
      required: 1,
      createdAt: addDaysISO(today, -10),
    });
    expect(calculateStreak(habit, today)).toBe(0);

    const gap = { ...habit, completedDates: [addDaysISO(today, -3)] };
    expect(calculateStreak(gap, today)).toBe(0);
  });

  it("ignores off-schedule and skipped days", () => {
    // 2026-10-26 is a Monday.
    const habit = makeHabit({
      goalType: "yes",
      required: 1,
      createdAt: "2026-10-19",
      schedule: { type: "weekdays", weekdays: [1, 2, 3, 4, 5] },
      completedDates: ["2026-10-23", "2026-10-26"],
    });

    expect(calculateStreak(habit, "2026-10-26")).toBe(2);

    const withSkip = withDayValue(habit, "2026-10-26", null, { skipped: true });
    expect(calculateStreak(withSkip, "2026-10-26")).toBe(1);
  });

  it("tracks the best streak", () => {
    const habit = makeHabit({
      goalType: "yes",
      required: 1,
      createdAt: "2026-01-01",
      completedDates: [
        "2026-01-01",
        "2026-01-02",
        "2026-01-03",
        // gap on the 4th
        "2026-01-05",
        "2026-01-06",
      ],
    });

    expect(calculateBestStreak(habit, "2026-01-10")).toBe(3);
  });

  it("computes percentage kept since creation", () => {
    const habit = makeHabit({
      createdAt: addDaysISO(today, -2),
      goalType: "yes",
      required: 1,
      completedDates: [addDaysISO(today, -2), today],
    });

    expect(percentKeptSinceCreation(habit, today)).toBeCloseTo((2 / 3) * 100);
  });

  it("excludes off-schedule days from percentages", () => {
    // Monday 2026-10-19 through Sunday 2026-10-25; weekdays only.
    const habit = makeHabit({
      createdAt: "2026-10-19",
      goalType: "yes",
      required: 1,
      schedule: { type: "weekdays", weekdays: [1, 2, 3, 4, 5] },
      completedDates: ["2026-10-20", "2026-10-21"],
    });

    expect(percentKeptSinceCreation(habit, "2026-10-25")).toBeCloseTo((2 / 5) * 100);
  });

  it("excludes skipped days from percentages", () => {
    const habit = makeHabit({
      createdAt: "2026-10-20",
      goalType: "yes",
      required: 1,
      completedDates: ["2026-10-20"],
    });
    const withSkip = withDayValue(habit, "2026-10-21", null, { skipped: true });

    expect(percentKeptSinceCreation(withSkip, "2026-10-22")).toBeCloseTo(50);
  });

  it("scores weekly achievements from achieved daily progress", () => {
    let habit = makeHabit({ period: "weekly", required: 1 });
    habit = withDayValue(habit, "2026-10-26", 2);
    habit = withDayValue(habit, "2026-10-27", 1);

    expect(getWeeklyAchieved(habit, "2026-10-26")).toBe(3);
  });

  it("computes percentage kept over the last N days", () => {
    const habit = makeHabit({
      createdAt: addDaysISO(today, -9),
      goalType: "yes",
      required: 1,
      completedDates: [today],
    });

    expect(percentKeptLastDays(habit, 10, today)).toBeCloseTo(10);
  });
});

describe("notes and rest days", () => {
  it("treats a note without a value as neutral", () => {
    const habit = makeHabit({ goalType: "yes", required: 1 });
    const noted = withDayValue(habit, "2026-10-26", null, {
      note: "  Resting today  ",
    });

    expect(isNoteOnly(noted, "2026-10-26")).toBe(true);
    expect(getDayStatus(noted, "2026-10-26")).toBe("noted");
    expect(getDayColor(noted, "2026-10-26")).toBe("noted");
    expect(noted.completedDates).not.toContain("2026-10-26");
    expect(noted.dailyProgress["2026-10-26"]).toMatchObject({
      value: 0,
      achieved: false,
      note: "Resting today",
    });
  });

  it("does not let a note-only day break a streak or count in percentages", () => {
    const habit = makeHabit({
      goalType: "yes",
      required: 1,
      createdAt: "2026-10-20",
      completedDates: ["2026-10-25", "2026-10-27"],
    });
    const withNote = withDayValue(habit, "2026-10-26", null, {
      note: "Travelling",
    });

    expect(calculateStreak(withNote, "2026-10-27")).toBe(2);
    // 8 calendar days, minus the neutral note-only day = 7 scored days.
    expect(percentKeptSinceCreation(withNote, "2026-10-27")).toBeCloseTo(
      (2 / 7) * 100
    );
  });

  it("keeps an existing note when saving a value and clears it with null", () => {
    let habit = withDayValue(makeHabit(), "2026-10-26", 4, { note: "steady" });
    habit = withDayValue(habit, "2026-10-26", 6);

    expect(habit.dailyProgress["2026-10-26"].note).toBe("steady");
    expect(habit.dailyProgress["2026-10-26"].value).toBe(6);

    habit = withDayValue(habit, "2026-10-26", 6, { note: null });
    expect(habit.dailyProgress["2026-10-26"].note).toBeUndefined();
    expect(habit.dailyProgress["2026-10-26"].value).toBe(6);
  });

  it("removes a day when a blank note is saved without a value", () => {
    const habit = makeHabit();
    const cleared = withDayValue(habit, "2026-10-26", null, { note: "   " });

    expect(cleared.dailyProgress["2026-10-26"]).toBeUndefined();
  });

  it("keeps skipped days neutral and can unskip them", () => {
    const habit = makeHabit();
    const skipped = withDayValue(habit, "2026-10-26", null, {
      skipped: true,
      note: "Holiday",
    });
    const unskipped = withDayValue(skipped, "2026-10-26", null, {
      skipped: false,
    });

    expect(isNoteOnly(skipped, "2026-10-26")).toBe(false);
    expect(getDayStatus(skipped, "2026-10-26")).toBe("skipped");
    expect(percentKeptSinceCreation(skipped, "2026-10-26")).toBe(0);

    // Unskipping keeps the note, so the day becomes a neutral note-only day.
    expect(getDayStatus(unskipped, "2026-10-26")).toBe("noted");

    const cleared = withDayValue(unskipped, "2026-10-26", null, {
      skipped: false,
      note: null,
    });
    expect(cleared.dailyProgress["2026-10-26"]).toBeUndefined();
  });

  it("describes schedules in Monday-first order", () => {
    expect(describeSchedule({ type: "daily" })).toBe("Every day");
    expect(describeSchedule({ type: "timesPerWeek", timesPerWeek: 3 })).toBe(
      "3× per week"
    );
    expect(
      describeSchedule({ type: "weekdays", weekdays: [0, 6, 1, 3] })
    ).toBe("Mon, Wed, Sat, Sun");
  });
});

describe("weekly evaluation", () => {
  it("identifies weekly goals and times-per-week schedules", () => {
    expect(isWeeklyEvaluation(makeHabit({ period: "weekly" }))).toBe(true);
    expect(
      isWeeklyEvaluation(
        makeHabit({ schedule: { type: "timesPerWeek", timesPerWeek: 3 } })
      )
    ).toBe(true);
    expect(isWeeklyEvaluation(makeHabit())).toBe(false);
  });

  it("reports weekly recorded days as logged rather than day-level completion", () => {
    let habit = makeHabit({
      period: "weekly",
      required: 10,
      createdAt: "2026-10-26",
    });

    habit = withDayValue(habit, "2026-10-26", 10);
    expect(getDayStatus(habit, "2026-10-26")).toBe("logged");
    expect(getDayColor(habit, "2026-10-26")).toBe("logged");
    expect(isDayAchieved(habit, "2026-10-26")).toBe(true);
    expect(isAchieved(habit, "2026-10-26", "2026-10-27")).toBe(true);
  });

  it("snapshots the weekly target from the first entry in the week", () => {
    let habit = makeHabit({
      period: "weekly",
      required: 10,
      createdAt: "2026-10-26",
    });

    expect(getWeekTarget(habit, "2026-10-26")).toBe(10);

    habit = withDayValue(habit, "2026-10-26", 4);
    expect(habit.dailyProgress["2026-10-26"].target).toBe(10);

    const retargeted = { ...habit, required: 20 };
    expect(getWeekTarget(retargeted, "2026-10-26")).toBe(10);
    expect(getWeekTarget(retargeted, "2026-11-02")).toBe(20);
  });

  it("adds units across the week and evaluates ended weeks", () => {
    const habit = makeHabit({
      period: "weekly",
      required: 10,
      minimum: 5,
      createdAt: "2026-10-19",
    });
    let progress = withDayValue(habit, "2026-10-19", 3);
    progress = withDayValue(progress, "2026-10-20", 3);

    expect(getWeeklyAchieved(progress, "2026-10-19")).toBe(6);

    const week = getWeekProgress(progress, "2026-10-19", "2026-11-02");
    expect(week).toMatchObject({
      weekStart: "2026-10-19",
      weekEnd: "2026-10-25",
      target: 10,
      achieved: 6,
      status: "partial",
      ended: true,
    });

    const belowMinimum = withDayValue(habit, "2026-10-19", 3);
    expect(
      getWeekProgress(belowMinimum, "2026-10-19", "2026-11-02").status
    ).toBe("failed");

    const empty = getWeekProgress(habit, "2026-10-19", "2026-11-02");
    expect(empty.status).toBe("failed");
  });

  it("does not fail the current week while it is still in progress", () => {
    let habit = makeHabit({
      period: "weekly",
      required: 10,
      createdAt: "2026-10-26",
    });

    let week = getWeekProgress(habit, "2026-10-26", "2026-10-28");
    expect(week.status).toBe("empty");
    expect(week.ended).toBe(false);
    expect(week.daysRemaining).toBe(4);

    habit = withDayValue(habit, "2026-10-26", 4);
    week = getWeekProgress(habit, "2026-10-26", "2026-10-28");
    expect(week.status).toBe("partial");
  });

  it("treats a fully skipped week as neutral", () => {
    const habit = makeHabit({
      period: "weekly",
      required: 2,
      createdAt: "2026-10-05",
    });
    let skipped = habit;
    for (let i = 0; i < 7; i++) {
      skipped = withDayValue(skipped, addDaysISO("2026-10-12", i), null, {
        skipped: true,
      });
    }

    const week = getWeekProgress(skipped, "2026-10-12", "2026-11-02");
    expect(week.status).toBe("skipped");
    expect(getWeekTarget(skipped, "2026-10-12")).toBe(2);
  });

  it("counts times-per-week by achieved days, not units", () => {
    const schedule = { type: "timesPerWeek" as const, timesPerWeek: 3 };
    const habit = makeHabit({
      required: 8,
      schedule,
      createdAt: "2026-10-26",
    });

    let progress = withDayValue(habit, "2026-10-26", 8);
    progress = withDayValue(progress, "2026-10-27", 8);
    progress = withDayValue(progress, "2026-10-28", 4); // partial day

    expect(getWeekTarget(progress, "2026-10-26")).toBe(3);
    expect(getWeeklyAchieved(progress, "2026-10-26")).toBe(2);

    const week = getWeekProgress(progress, "2026-10-26", "2026-10-28");
    expect(week.status).toBe("partial");
    expect(isDayAchieved(progress, "2026-10-26")).toBe(true);
    expect(isAchieved(progress, "2026-10-26", "2026-10-28")).toBe(false);

    const complete = withDayValue(progress, "2026-10-28", 8);
    expect(getWeekProgress(complete, "2026-10-26", "2026-10-28").status).toBe(
      "achieved"
    );
    expect(isAchieved(complete, "2026-10-26", "2026-10-28")).toBe(true);
  });

  it("keeps times-per-week day statuses day-level", () => {
    const habit = makeHabit({
      required: 8,
      minimum: 4,
      schedule: { type: "timesPerWeek", timesPerWeek: 3 },
      createdAt: "2026-10-26",
    });
    const achieved = withDayValue(habit, "2026-10-26", 8);
    const failed = withDayValue(habit, "2026-10-27", 1);

    expect(getDayStatus(achieved, "2026-10-26")).toBe("achieved");
    expect(getDayStatus(failed, "2026-10-27")).toBe("failed");
    expect(isDayFailed(failed, "2026-10-27")).toBe(true);
  });

  it("counts consecutive achieved weeks, ignoring an incomplete current week", () => {
    const habit = makeHabit({
      period: "weekly",
      required: 2,
      createdAt: "2026-10-05",
    });
    let progress = withDayValue(habit, "2026-10-05", 2);
    progress = withDayValue(progress, "2026-10-12", 2);
    progress = withDayValue(progress, "2026-10-19", 2);

    expect(calculateStreak(progress, "2026-10-28")).toBe(3);

    // A partially logged current week still does not break the streak.
    progress = withDayValue(progress, "2026-10-26", 1);
    expect(
      getWeekProgress(progress, "2026-10-26", "2026-10-28").status
    ).toBe("partial");
    expect(calculateStreak(progress, "2026-10-28")).toBe(3);
  });

  it("skips neutral weeks inside a weekly streak", () => {
    const habit = makeHabit({
      period: "weekly",
      required: 2,
      createdAt: "2026-10-05",
    });
    let progress = withDayValue(habit, "2026-10-05", 2);
    for (let i = 0; i < 7; i++) {
      progress = withDayValue(progress, addDaysISO("2026-10-12", i), null, {
        skipped: true,
      });
    }
    progress = withDayValue(progress, "2026-10-19", 2);

    expect(
      getWeekProgress(progress, "2026-10-12", "2026-10-28").status
    ).toBe("skipped");
    expect(calculateStreak(progress, "2026-10-28")).toBe(2);
  });

  it("tracks the best weekly streak", () => {
    const habit = makeHabit({
      period: "weekly",
      required: 2,
      createdAt: "2026-10-05",
    });
    let progress = withDayValue(habit, "2026-10-05", 2);
    progress = withDayValue(progress, "2026-10-12", 2);
    // Miss the week of 2026-10-19.
    progress = withDayValue(progress, "2026-10-26", 2);

    expect(calculateBestStreak(progress, "2026-10-28")).toBe(2);
  });

  it("computes weekly percentages excluding skipped and unstarted weeks", () => {
    const habit = makeHabit({
      period: "weekly",
      required: 2,
      createdAt: "2026-10-05",
    });
    let progress = withDayValue(habit, "2026-10-05", 2);
    for (let i = 0; i < 7; i++) {
      progress = withDayValue(progress, addDaysISO("2026-10-12", i), null, {
        skipped: true,
      });
    }
    progress = withDayValue(progress, "2026-10-19", 2);
    // Week of 2026-10-26 has no entries and counts as a missed week.

    expect(percentKeptSinceCreation(progress, "2026-11-01")).toBeCloseTo(
      (2 / 3) * 100
    );
  });
});
