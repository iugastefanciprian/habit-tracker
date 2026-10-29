import type { Habit, Profile } from "@/lib/types";
import { importLegacyData, listProfiles } from "@/lib/api/client";
import {
  clearLegacyData,
  markMigrated,
  readLegacyData,
  wasMigrated,
} from "@/lib/legacy";

function toImportHabit(habit: Habit) {
  return {
    name: habit.name,
    goalType: habit.goalType,
    required: habit.required,
    minimum: habit.minimum,
    unit: habit.unit,
    period: habit.period,
    createdAt: habit.createdAt,
    completedDates: habit.completedDates,
    dailyProgress: habit.dailyProgress,
  };
}

/**
 * True when there is local data that has not been checked/imported for this
 * account yet. Used to show the import status message.
 */
export function hasPendingLegacyImport(userId: string): boolean {
  return !wasMigrated(userId) && readLegacyData() !== null;
}

/**
 * Imports pre-MongoDB localStorage data once per user. Returns the imported
 * profiles when an import happened, or null when there was nothing to do.
 */
export async function ensureLegacyImport(
  userId: string
): Promise<Profile[] | null> {
  if (wasMigrated(userId)) return null;

  const legacy = readLegacyData();
  if (!legacy) {
    markMigrated(userId);
    return null;
  }

  const existing = await listProfiles();
  if (existing.length > 0) {
    // Never overwrite data that already lives on the server. Keep the local
    // copy untouched as a backup and stop retrying.
    markMigrated(userId);
    return null;
  }

  await importLegacyData({
    profiles: legacy.profiles.map(({ name, habits }) => ({
      name,
      habits: habits.map(toImportHabit),
    })),
  });

  const imported = await listProfiles();
  clearLegacyData(legacy);
  markMigrated(userId);
  return imported;
}
