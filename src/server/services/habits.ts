import { randomUUID } from "node:crypto";
import type { Habit, HabitInput, HabitUpdateInput } from "@/lib/types";
import {
  getActual,
  getTarget,
  isDayAchieved,
  todayISO,
  withDayValue,
  type DayValueOptions,
} from "@/lib/domain/habits";
import type { HabitDoc } from "../db/documents";
import { AppError } from "../errors";
import {
  findHabit,
  insertHabit,
  listHabits,
  nextHabitSortOrder,
  removeHabit,
  renameHabitCategory,
  setHabitSortOrders,
  toHabit,
  updateHabitFields,
  updateHabitProgress,
} from "../repositories/habits";
import { requireOwnedProfile } from "./profiles";

function toDoc(habit: Habit, userId: string, profileId: string): HabitDoc {
  return {
    _id: habit.id,
    userId,
    profileId,
    name: habit.name,
    goalType: habit.goalType,
    required: habit.required,
    minimum: habit.minimum,
    unit: habit.unit,
    period: habit.period,
    schedule: habit.schedule,
    sortOrder: habit.sortOrder,
    createdAt: habit.createdAt,
    completedDates: habit.completedDates,
    dailyProgress: habit.dailyProgress,
    archivedAt: habit.archivedAt,
    category: habit.category,
    color: habit.color,
    emoji: habit.emoji,
    reminder: habit.reminder,
  };
}

function cleanText(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeInput(input: HabitInput): HabitInput & { required: number } {
  return {
    name: input.name,
    goalType: input.goalType,
    required: input.goalType === "yes" ? 1 : input.required ?? 1,
    minimum: input.minimum,
    unit: input.unit || undefined,
    period: input.period,
    schedule: input.schedule ?? { type: "daily" },
    category: cleanText(input.category),
    color: cleanText(input.color),
    emoji: cleanText(input.emoji),
    reminder: input.reminder?.enabled ? input.reminder : undefined,
    createdAt: input.createdAt,
  };
}

async function requireOwnedHabit(
  userId: string,
  profileId: string,
  habitId: string
): Promise<Habit> {
  const doc = await findHabit(userId, profileId, habitId);
  if (!doc) throw new AppError(404, "Habit not found");
  return toHabit(doc);
}

export async function listHabitsForProfile(
  userId: string,
  profileId: string
): Promise<Habit[]> {
  await requireOwnedProfile(userId, profileId);
  return (await listHabits(userId, profileId)).map(toHabit);
}

export async function createHabitForProfile(
  userId: string,
  profileId: string,
  input: HabitInput
): Promise<Habit> {
  await requireOwnedProfile(userId, profileId);

  const normalized = normalizeInput(input);
  const habit: Habit = {
    id: randomUUID(),
    name: normalized.name,
    goalType: normalized.goalType,
    required: normalized.required,
    minimum: normalized.minimum,
    unit: normalized.unit,
    period: normalized.period,
    schedule: normalized.schedule ?? { type: "daily" },
    sortOrder: await nextHabitSortOrder(userId, profileId),
    createdAt: normalized.createdAt ?? todayISO(),
    completedDates: [],
    dailyProgress: {},
    category: normalized.category,
    color: normalized.color,
    emoji: normalized.emoji,
    reminder: normalized.reminder,
  };

  await insertHabit(toDoc(habit, userId, profileId));
  return habit;
}

/**
 * Edits habit settings without touching recorded days: past entries keep the
 * target snapshot they were written with. Archiving and restoring are part of
 * the same update.
 */
export async function updateHabitForProfile(
  userId: string,
  profileId: string,
  habitId: string,
  input: HabitUpdateInput
): Promise<Habit> {
  await requireOwnedProfile(userId, profileId);
  const existing = await findHabit(userId, profileId, habitId);
  if (!existing) throw new AppError(404, "Habit not found");

  const fields: Partial<HabitDoc> = {};
  const unset: string[] = [];

  if (input.name !== undefined) fields.name = input.name;
  if (input.goalType !== undefined) fields.goalType = input.goalType;

  const goalType = input.goalType ?? existing.goalType;
  if (goalType === "yes") {
    fields.required = 1;
  } else if (input.required !== undefined) {
    fields.required = input.required;
  }

  if (input.minimum === null) unset.push("minimum");
  else if (input.minimum !== undefined) fields.minimum = input.minimum;

  if (input.unit === null || input.unit === "") unset.push("unit");
  else if (input.unit !== undefined) fields.unit = input.unit;

  if (input.period !== undefined) fields.period = input.period;
  if (input.schedule !== undefined) fields.schedule = input.schedule;

  if (input.category === null || input.category === "") unset.push("category");
  else if (input.category !== undefined) fields.category = input.category.trim();

  if (input.color === null || input.color === "") unset.push("color");
  else if (input.color !== undefined) fields.color = input.color;

  if (input.emoji === null || input.emoji === "") unset.push("emoji");
  else if (input.emoji !== undefined) fields.emoji = input.emoji;

  if (input.reminder === null || input.reminder?.enabled === false) {
    unset.push("reminder");
  } else if (input.reminder !== undefined) {
    fields.reminder = input.reminder;
  }

  if (input.archived === true) {
    if (!existing.archivedAt) fields.archivedAt = new Date().toISOString();
  } else if (input.archived === false) {
    unset.push("archivedAt");
  }

  const doc = await updateHabitFields(
    userId,
    profileId,
    habitId,
    fields,
    unset
  );
  if (!doc) throw new AppError(404, "Habit not found");
  return toHabit(doc);
}

/**
 * Renames a category across every habit in the profile. Passing null moves
 * those habits to Uncategorized.
 */
export async function renameHabitCategoryForProfile(
  userId: string,
  profileId: string,
  from: string,
  to: string | null
): Promise<Habit[]> {
  await requireOwnedProfile(userId, profileId);
  await renameHabitCategory(userId, profileId, from, to?.trim() || null);
  return (await listHabits(userId, profileId)).map(toHabit);
}

export async function deleteHabitForProfile(
  userId: string,
  profileId: string,
  habitId: string
): Promise<void> {
  await requireOwnedProfile(userId, profileId);
  const existing = await findHabit(userId, profileId, habitId);
  if (!existing) throw new AppError(404, "Habit not found");
  if (!existing.archivedAt) {
    throw new AppError(
      409,
      "Archive the habit before deleting it permanently."
    );
  }

  const removed = await removeHabit(userId, profileId, habitId);
  if (!removed) throw new AppError(404, "Habit not found");
}

/**
 * Replaces the active habit order. Every non-archived habit must be listed
 * exactly once, which prevents partial or stale reorder requests.
 */
export async function reorderHabitsForProfile(
  userId: string,
  profileId: string,
  habitIds: string[]
): Promise<Habit[]> {
  await requireOwnedProfile(userId, profileId);
  const docs = await listHabits(userId, profileId);
  const activeIds = docs
    .filter((doc) => !doc.archivedAt)
    .map((doc) => doc._id);
  const requested = new Set(habitIds);

  const valid =
    habitIds.length === activeIds.length &&
    requested.size === habitIds.length &&
    activeIds.every((id) => requested.has(id));

  if (!valid) {
    throw new AppError(
      400,
      "Reorder every active habit exactly once."
    );
  }

  await setHabitSortOrders(
    userId,
    profileId,
    habitIds.map((id, sortOrder) => ({ id, sortOrder }))
  );
  return (await listHabits(userId, profileId)).map(toHabit);
}

export async function setDayValueForProfile(
  userId: string,
  profileId: string,
  habitId: string,
  date: string,
  value: number | null,
  options: DayValueOptions = {}
): Promise<Habit> {
  const habit = await requireOwnedHabit(userId, profileId, habitId);
  const updated = withDayValue(habit, date, value, options);

  if (updated === habit) {
    // Before the habit existed: nothing to persist.
    return habit;
  }

  const doc = await updateHabitProgress(userId, profileId, habitId, {
    completedDates: updated.completedDates,
    dailyProgress: updated.dailyProgress,
  });
  if (!doc) throw new AppError(404, "Habit not found");
  return toHabit(doc);
}

export async function toggleHabitForProfile(
  userId: string,
  profileId: string,
  habitId: string,
  date: string = todayISO()
): Promise<Habit> {
  const habit = await requireOwnedHabit(userId, profileId, habitId);

  // Weekly totals are logged one unit at a time; a second click removes the
  // day's contribution. Daily habits keep the existing done/undo behavior.
  if (habit.period === "weekly") {
    return setDayValueForProfile(
      userId,
      profileId,
      habitId,
      date,
      getActual(habit, date) > 0 ? null : 1
    );
  }

  const nextValue = isDayAchieved(habit, date)
    ? null
    : habit.goalType === "yes"
      ? 1
      : getTarget(habit, date);
  return setDayValueForProfile(userId, profileId, habitId, date, nextValue);
}
