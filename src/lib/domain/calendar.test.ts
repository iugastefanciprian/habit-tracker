import { describe, expect, it } from "vitest";
import type { Habit } from "@/lib/types";
import {
  addMonths,
  canEditDay,
  getDayOverview,
  getMonthMatrix,
  getTrailingMonths,
  monthOf,
} from "@/lib/domain/calendar";
import { withDayValue } from "@/lib/domain/habits";

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

describe("month helpers", () => {
  it("normalizes dates to the start of the month", () => {
    expect(monthOf("2026-10-27")).toBe("2026-10-01");
    expect(monthOf("2026-10-01")).toBe("2026-10-01");
  });

  it("moves across year boundaries", () => {
    expect(addMonths("2026-12-01", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-01", -1)).toBe("2025-12-01");
    expect(addMonths("2026-01-15", 2)).toBe("2026-03-01");
  });

  it("lists trailing months oldest first", () => {
    expect(getTrailingMonths("2026-10-27", 3)).toEqual([
      "2026-08-01",
      "2026-09-01",
      "2026-10-01",
    ]);
  });
});

describe("month matrix", () => {
  it("builds a six-week Monday-first grid", () => {
    // 2026-02-01 is a Sunday, so the grid starts on Monday 2026-01-26.
    const weeks = getMonthMatrix("2026-02-01");
    expect(weeks).toHaveLength(6);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0][0].date).toBe("2026-01-26");
    expect(weeks[5][6].date).toBe("2026-03-08");
    expect(weeks.flat().filter((day) => day.inMonth)).toHaveLength(28);
  });

  it("includes leap days", () => {
    const dates = getMonthMatrix("2028-02-01")
      .flat()
      .map((day) => day.date);
    expect(dates).toContain("2028-02-29");
  });

  it("supports Sunday-first weeks", () => {
    const weeks = getMonthMatrix("2026-02-01", 0);
    expect(weeks[0][0].date).toBe("2026-02-01");
  });

  it("handles a month that starts on Monday without leading days", () => {
    // 2026-06-01 is a Monday.
    const weeks = getMonthMatrix("2026-06-01");
    expect(weeks[0][0]).toMatchObject({ date: "2026-06-01", inMonth: true });
  });
});

describe("day overview", () => {
  it("counts kept, logged, skipped, and off-schedule habits", () => {
    const kept = withDayValue(makeHabit({ id: "kept" }), "2026-10-26", 1);
    const skipped = withDayValue(makeHabit({ id: "skipped" }), "2026-10-26", null, {
      skipped: true,
    });
    const off = makeHabit({
      id: "off",
      schedule: { type: "weekdays", weekdays: [2] },
      createdAt: "2026-10-01",
    });
    const before = makeHabit({ id: "before", createdAt: "2026-10-27" });

    const overview = getDayOverview(
      [kept, skipped, off, before],
      "2026-10-26",
      "2026-10-26"
    );

    expect(overview).toMatchObject({
      scheduled: 1,
      kept: 1,
      logged: 1,
      skipped: 1,
      off: 1,
      completion: 100,
      hasData: true,
    });
  });

  it("counts a partial entry as logged but not kept", () => {
    const partial = withDayValue(
      makeHabit({ goalType: "count", required: 8 }),
      "2026-10-26",
      3
    );

    expect(
      getDayOverview([partial], "2026-10-26", "2026-10-26")
    ).toMatchObject({
      scheduled: 1,
      kept: 0,
      logged: 1,
      completion: 0,
    });
  });

  it("evaluates weekly habits by their week", () => {
    const weekly = withDayValue(
      makeHabit({ id: "weekly", period: "weekly", required: 2 }),
      "2026-10-26",
      1
    );

    expect(
      getDayOverview([weekly], "2026-10-26", "2026-10-27")
    ).toMatchObject({ scheduled: 1, kept: 0, logged: 1 });

    const complete = withDayValue(weekly, "2026-10-27", 1);
    expect(
      getDayOverview([complete], "2026-10-26", "2026-10-27")
    ).toMatchObject({ scheduled: 1, kept: 1 });
  });

  it("reports no data for a fully neutral day", () => {
    const skipped = withDayValue(makeHabit(), "2026-10-26", null, {
      skipped: true,
    });
    expect(
      getDayOverview([skipped], "2026-10-26", "2026-10-26")
    ).toMatchObject({
      scheduled: 0,
      kept: 0,
      skipped: 1,
      completion: 0,
      hasData: false,
    });
  });

  it("treats a note-only day as neutral", () => {
    const noted = withDayValue(makeHabit(), "2026-10-26", null, {
      note: "Travelling",
    });
    expect(
      getDayOverview([noted], "2026-10-26", "2026-10-26")
    ).toMatchObject({
      scheduled: 0,
      kept: 0,
      logged: 0,
      completion: 0,
      hasData: false,
    });
  });
});

describe("day editability", () => {
  const habit = makeHabit({ createdAt: "2026-10-10" });

  it("allows today and past days after creation", () => {
    expect(canEditDay(habit, "2026-10-26", "2026-10-26")).toBe(true);
    expect(canEditDay(habit, "2026-10-10", "2026-10-26")).toBe(true);
  });

  it("blocks future days and days before creation", () => {
    expect(canEditDay(habit, "2026-10-27", "2026-10-26")).toBe(false);
    expect(canEditDay(habit, "2026-10-09", "2026-10-26")).toBe(false);
  });
});
