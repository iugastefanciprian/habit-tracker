import type { ExportPayload } from "@/lib/types";
import { listHabits, toHabit } from "../repositories/habits";
import { listProfiles } from "../repositories/profiles";

/** Full account backup, including archived habits and profile pictures. */
export async function exportAllData(userId: string): Promise<ExportPayload> {
  const profiles = await listProfiles(userId);
  const exported = [];

  for (const profile of profiles) {
    const habits = (await listHabits(userId, profile.id)).map(toHabit);
    exported.push({ ...profile, habits });
  }

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    profiles: exported,
  };
}
