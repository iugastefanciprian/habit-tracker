import { describe, expect, it } from "vitest";
import type { Habit } from "@/lib/types";
import {
  filterByCategory,
  groupHabitsByCategory,
  habitCategory,
  listCategories,
  matchesCategory,
  searchHabits,
} from "@/lib/domain/categories";

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

describe("habit categories", () => {
  it("trims categories and treats blanks as uncategorized", () => {
    expect(habitCategory(makeHabit({ category: "  Health  " }))).toBe("Health");
    expect(habitCategory(makeHabit({ category: "   " }))).toBeNull();
    expect(habitCategory(makeHabit())).toBeNull();
  });

  it("compares categories case-insensitively", () => {
    const habit = makeHabit({ category: "Health" });
    expect(matchesCategory(habit, "health")).toBe(true);
    expect(matchesCategory(habit, "HEALTH ")).toBe(true);
    expect(matchesCategory(habit, "Fitness")).toBe(false);
    expect(matchesCategory(makeHabit(), "Health")).toBe(false);
  });

  it("lists distinct categories in first-appearance order", () => {
    const habits = [
      makeHabit({ id: "a", category: "Health" }),
      makeHabit({ id: "b", category: "Mind" }),
      makeHabit({ id: "c", category: "health" }),
      makeHabit({ id: "d" }),
    ];

    expect(listCategories(habits)).toEqual(["Health", "Mind"]);
  });

  it("groups case variants and puts uncategorized last", () => {
    const habits = [
      makeHabit({ id: "a", category: "Health" }),
      makeHabit({ id: "b" }),
      makeHabit({ id: "c", category: "Mind" }),
      makeHabit({ id: "d", category: "health" }),
    ];

    const groups = groupHabitsByCategory(habits);
    expect(groups.map((group) => group.label)).toEqual([
      "Health",
      "Mind",
      "Uncategorized",
    ]);
    expect(groups[0].habits.map((habit) => habit.id)).toEqual(["a", "d"]);
    expect(groups[1].habits.map((habit) => habit.id)).toEqual(["c"]);
    expect(groups[2].category).toBeNull();
    expect(groups[2].habits.map((habit) => habit.id)).toEqual(["b"]);
  });

  it("omits the uncategorized group when every habit has a category", () => {
    const groups = groupHabitsByCategory([
      makeHabit({ id: "a", category: "Health" }),
    ]);
    expect(groups).toHaveLength(1);
  });

  it("filters by category, uncategorized, and all", () => {
    const habits = [
      makeHabit({ id: "a", category: "Health" }),
      makeHabit({ id: "b" }),
    ];

    expect(filterByCategory(habits, undefined)).toHaveLength(2);
    expect(filterByCategory(habits, null).map((habit) => habit.id)).toEqual([
      "b",
    ]);
    expect(filterByCategory(habits, "health").map((habit) => habit.id)).toEqual([
      "a",
    ]);
  });

  it("searches names and categories", () => {
    const habits = [
      makeHabit({ id: "a", name: "Drink water", category: "Health" }),
      makeHabit({ id: "b", name: "Read", category: "Mind" }),
    ];

    expect(searchHabits(habits, "water").map((habit) => habit.id)).toEqual(["a"]);
    expect(searchHabits(habits, "MIND").map((habit) => habit.id)).toEqual(["b"]);
    expect(searchHabits(habits, "  ")).toHaveLength(2);
    expect(searchHabits(habits, "nope")).toHaveLength(0);
  });
});
