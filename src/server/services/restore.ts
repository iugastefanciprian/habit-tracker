import type { Profile, RestoreMode, RestoreSummary } from "@/lib/types";
import { buildRestorePlan } from "@/lib/domain/backup";
import type { BackupInput } from "../validation";
import { insertHabit, removeAllHabits } from "../repositories/habits";
import {
  insertProfile,
  listProfiles,
  removeAllProfiles,
} from "../repositories/profiles";

export interface RestoreResult {
  profiles: Profile[];
  summary: RestoreSummary;
}

/**
 * Restores a parsed backup. `merge` appends the backup's profiles beside the
 * existing ones; `replace` clears the account first, so the file becomes the
 * whole account. Original profile ids survive a replace, which keeps the
 * browser's remembered profile valid.
 */
export async function restoreBackup(
  userId: string,
  backup: BackupInput,
  mode: RestoreMode
): Promise<RestoreResult> {
  const plan = buildRestorePlan(userId, backup, mode);

  if (mode === "replace") {
    await removeAllHabits(userId);
    await removeAllProfiles(userId);
  }

  for (const profile of plan.profiles) {
    await insertProfile(profile);
  }
  for (const habit of plan.habits) {
    await insertHabit(habit);
  }

  return {
    profiles: await listProfiles(userId),
    summary: {
      profiles: plan.profileCount,
      habits: plan.habitCount,
      mode,
    },
  };
}
