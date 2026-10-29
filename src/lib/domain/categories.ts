import type { Habit } from "@/lib/types";

export const UNCATEGORIZED_LABEL = "Uncategorized";

/** The trimmed category name, or null when the habit has none. */
export function habitCategory(habit: Habit): string | null {
  const trimmed = habit.category?.trim();
  return trimmed ? trimmed : null;
}

/** Case-insensitive category comparison; null only matches uncategorized. */
export function matchesCategory(habit: Habit, category: string): boolean {
  const own = habitCategory(habit);
  return own !== null && own.toLowerCase() === category.trim().toLowerCase();
}

/**
 * Distinct category labels in the order they first appear in `habits`
 * (already sorted by the caller). Case variants collapse onto the first label.
 */
export function listCategories(habits: Habit[]): string[] {
  const seen = new Map<string, string>();
  for (const habit of habits) {
    const category = habitCategory(habit);
    if (!category) continue;
    const key = category.toLowerCase();
    if (!seen.has(key)) seen.set(key, category);
  }
  return [...seen.values()];
}

export interface CategoryGroup {
  /** Canonical label, or null for the uncategorized group. */
  category: string | null;
  label: string;
  habits: Habit[];
}

/**
 * Groups habits by category in first-appearance order, with uncategorized
 * habits last. Category matching is case-insensitive.
 */
export function groupHabitsByCategory(habits: Habit[]): CategoryGroup[] {
  const groups = new Map<string, CategoryGroup>();
  const uncategorized: Habit[] = [];

  for (const habit of habits) {
    const category = habitCategory(habit);
    if (!category) {
      uncategorized.push(habit);
      continue;
    }
    const key = category.toLowerCase();
    const existing = groups.get(key);
    if (existing) {
      existing.habits.push(habit);
    } else {
      groups.set(key, { category, label: category, habits: [habit] });
    }
  }

  const grouped = [...groups.values()];
  if (uncategorized.length > 0) {
    grouped.push({
      category: null,
      label: UNCATEGORIZED_LABEL,
      habits: uncategorized,
    });
  }
  return grouped;
}

/** Filters by category. `undefined` keeps everything and `null` is uncategorized. */
export function filterByCategory(
  habits: Habit[],
  category: string | null | undefined
): Habit[] {
  if (category === undefined) return habits;
  if (category === null) return habits.filter((habit) => !habitCategory(habit));
  return habits.filter((habit) => matchesCategory(habit, category));
}

/** Matches a habit name or category, case-insensitively. */
export function searchHabits(habits: Habit[], query: string): Habit[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return habits;
  return habits.filter((habit) => {
    const name = habit.name.toLowerCase();
    const category = habitCategory(habit)?.toLowerCase() ?? "";
    return name.includes(needle) || category.includes(needle);
  });
}
