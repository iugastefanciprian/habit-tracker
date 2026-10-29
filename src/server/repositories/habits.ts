import type { Habit } from "@/lib/types";
import type { HabitDoc } from "../db/documents";
import { getDb } from "../db/mongodb";

function habits() {
  return getDb().then((db) => db.collection<HabitDoc>("habits"));
}

export function toHabit(doc: HabitDoc): Habit {
  return {
    id: doc._id,
    name: doc.name,
    goalType: doc.goalType,
    required: doc.required,
    minimum: doc.minimum ?? undefined,
    unit: doc.unit ?? undefined,
    period: doc.period,
    schedule: doc.schedule ?? { type: "daily" },
    sortOrder: doc.sortOrder ?? 0,
    createdAt: doc.createdAt,
    completedDates: doc.completedDates,
    dailyProgress: doc.dailyProgress,
    archivedAt: doc.archivedAt,
    category: doc.category ?? undefined,
    color: doc.color,
    emoji: doc.emoji,
    reminder: doc.reminder,
  };
}

export async function listHabits(
  userId: string,
  profileId: string
): Promise<HabitDoc[]> {
  return (await habits())
    .find({ userId, profileId })
    .sort({ sortOrder: 1, createdAt: 1, _id: 1 })
    .toArray();
}

export async function findHabit(
  userId: string,
  profileId: string,
  habitId: string
): Promise<HabitDoc | null> {
  return (await habits()).findOne({
    _id: habitId,
    userId,
    profileId,
  });
}

export async function insertHabit(doc: HabitDoc): Promise<void> {
  await (await habits()).insertOne(doc);
}

/** Highest current position plus one, so a new habit is appended. */
export async function nextHabitSortOrder(
  userId: string,
  profileId: string
): Promise<number> {
  const last = await (await habits())
    .find({ userId, profileId })
    .sort({ sortOrder: -1, createdAt: -1 })
    .limit(1)
    .next();
  return (last?.sortOrder ?? -1) + 1;
}

export async function updateHabitFields(
  userId: string,
  profileId: string,
  habitId: string,
  fields: Partial<HabitDoc>,
  unset: string[] = []
): Promise<HabitDoc | null> {
  const update: {
    $set?: Partial<HabitDoc>;
    $unset?: Record<string, "">;
  } = {};
  if (Object.keys(fields).length > 0) update.$set = fields;
  if (unset.length > 0) {
    update.$unset = Object.fromEntries(unset.map((key) => [key, ""]));
  }
  if (!update.$set && !update.$unset) return findHabit(userId, profileId, habitId);

  return (await habits()).findOneAndUpdate(
    { _id: habitId, userId, profileId },
    update,
    { returnDocument: "after" }
  );
}

export async function setHabitSortOrders(
  userId: string,
  profileId: string,
  entries: { id: string; sortOrder: number }[]
): Promise<void> {
  if (entries.length === 0) return;
  await (await habits()).bulkWrite(
    entries.map((entry) => ({
      updateOne: {
        filter: { _id: entry.id, userId, profileId },
        update: { $set: { sortOrder: entry.sortOrder } },
      },
    }))
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Renames (or clears, when `to` is null) every habit in a category. */
export async function renameHabitCategory(
  userId: string,
  profileId: string,
  from: string,
  to: string | null
): Promise<number> {
  const filter = {
    userId,
    profileId,
    category: { $regex: `^${escapeRegExp(from)}$`, $options: "i" },
  };
  const update: { $set?: { category: string }; $unset?: { category: "" } } =
    to === null ? { $unset: { category: "" } } : { $set: { category: to } };
  const result = await (await habits()).updateMany(filter, update);
  return result.modifiedCount;
}

export async function updateHabitProgress(
  userId: string,
  profileId: string,
  habitId: string,
  progress: Pick<HabitDoc, "completedDates" | "dailyProgress">
): Promise<HabitDoc | null> {
  return (await habits()).findOneAndUpdate(
    { _id: habitId, userId, profileId },
    {
      $set: {
        completedDates: progress.completedDates,
        dailyProgress: progress.dailyProgress,
      },
    },
    { returnDocument: "after" }
  );
}

export async function removeHabit(
  userId: string,
  profileId: string,
  habitId: string
): Promise<boolean> {
  const result = await (await habits()).deleteOne({
    _id: habitId,
    userId,
    profileId,
  });
  return result.deletedCount === 1;
}

/** Removes every habit for a user; used by a full backup restore. */
export async function removeAllHabits(userId: string): Promise<number> {
  const result = await (await habits()).deleteMany({ userId });
  return result.deletedCount;
}
