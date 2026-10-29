import { describe, expect, it } from "vitest";
import type { Habit } from "@/lib/types";
import { withDayValue } from "@/lib/domain/habits";
import {
  countKept,
  getMilestones,
  KEPT_MILESTONES,
  STREAK_MILESTONES,
} from "@/lib/domain/milestones";

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "habit-1",
    name: "Read",
    goalType: "yes",
    required: 1,
    period: "daily",
    schedule: { type: "daily" },
    sortOrder: 0,
    createdAt: "2026-01-01",
    completedDates: [],
    dailyProgress: {},
    ...overrides,
  };
}

describe("getMilestones", () => {
  it("counts kept days and best streak and exposes the closest next badge", () => {
    const habit = {
      ...makeHabit(),
      completedDates: [
        "2026-01-01",
        "2026-01-02",
        "2026-01-03",
        "2026-01-04",
        "2026-01-05",
        "2026-01-06",
        "2026-01-07",
      ],
    };

    const summary = getMilestones(habit, "2026-01-07");

    expect(summary.unit).toBe("day");
    expect(summary.bestStreak).toBe(7);
    expect(summary.currentStreak).toBe(7);
    expect(summary.totalKept).toBe(7);
    expect(summary.achieved.map((item) => item.id)).toEqual([
      "streak-3",
      "streak-7",
      "kept-1",
    ]);
    // 7/10 kept beats 7/14 streak.
    expect(summary.next?.id).toBe("kept-10");
    expect(summary.next?.remaining).toBe(3);
  });

  it("does not count skipped, note-only, or missed days", () => {
    let habit = makeHabit();
    habit = withDayValue(habit, "2026-01-01", 1);
    habit = withDayValue(habit, "2026-01-02", 1);
    habit = withDayValue(habit, "2026-01-03", null, { skipped: true });
    habit = withDayValue(habit, "2026-01-04", null, { note: "Sick" });
    habit = withDayValue(habit, "2026-01-05", 1);

    expect(countKept(habit, "2026-01-05")).toBe(3);

    const summary = getMilestones(habit, "2026-01-05");
    expect(summary.bestStreak).toBe(3);
    expect(summary.achieved.map((item) => item.id)).toContain("kept-1");
    expect(summary.achieved.map((item) => item.id)).not.toContain("kept-10");
  });

  it("uses weeks for weekly goals", () => {
    const habit = makeHabit({
      goalType: "count",
      period: "weekly",
      required: 3,
      dailyProgress: {
        "2026-01-05": { value: 3, achieved: true, target: 3 },
        "2026-01-12": { value: 3, achieved: true, target: 3 },
        "2026-01-19": { value: 2, achieved: false, target: 3 },
        "2026-01-26": { value: 3, achieved: true, target: 3 },
      },
    });

    const summary = getMilestones(habit, "2026-02-01");

    expect(summary.unit).toBe("week");
    expect(summary.totalKept).toBe(3);
    expect(summary.achieved.map((item) => item.id)).toContain("kept-1");
    expect(summary.achieved.map((item) => item.id)).not.toContain("kept-10");
    expect(summary.next?.kind).toBe("streak");
  });

  it("exposes the milestone thresholds in ascending order", () => {
    expect(STREAK_MILESTONES).toEqual([...STREAK_MILESTONES].sort((a, b) => a - b));
    expect(KEPT_MILESTONES).toEqual([...KEPT_MILESTONES].sort((a, b) => a - b));
  });
});
