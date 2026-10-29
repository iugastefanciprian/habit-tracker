import type {
  DailyProgress,
  GoalPeriod,
  GoalType,
  HabitReminder,
  HabitSchedule,
  RestoreMode,
} from "@/lib/types";
import type { HabitDoc, ProfileDoc } from "@/server/db/documents";

export interface BackupProgressInput {
  value: number;
  achieved?: boolean;
  target?: number;
  note?: string;
  skipped?: boolean;
}

export interface BackupHabitInput {
  id?: string;
  name: string;
  goalType: GoalType;
  required?: number;
  minimum?: number;
  unit?: string;
  period: GoalPeriod;
  schedule?: HabitSchedule;
  sortOrder?: number;
  createdAt: string;
  completedDates: string[];
  dailyProgress: Record<string, BackupProgressInput>;
  archivedAt?: string;
  category?: string;
  color?: string;
  emoji?: string;
  reminder?: HabitReminder;
}

export interface BackupProfileInput {
  id?: string;
  name: string;
  avatar?: string;
  timeZone?: string;
  dayStartHour?: number;
  habits: BackupHabitInput[];
}

/** The profile/habit shape accepted from a backup file. */
export interface BackupInput {
  version?: number;
  exportedAt?: string;
  profiles: BackupProfileInput[];
}

export interface RestorePlan {
  profiles: ProfileDoc[];
  habits: HabitDoc[];
  profileCount: number;
  habitCount: number;
}

function cleanText(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Keeps a time zone only when the runtime recognises it. */
function cleanTimeZone(value: string | undefined): string | undefined {
  const trimmed = cleanText(value);
  if (!trimmed) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: trimmed }).format();
    return trimmed;
  } catch {
    return undefined;
  }
}

/**
 * Prefer the original id on a replace so the browser's remembered profile
 * keeps working; merge always allocates new ids to avoid collisions.
 */
function nextId(
  preferred: string | undefined,
  mode: RestoreMode,
  used: Set<string>
): string {
  if (mode === "replace" && preferred && !used.has(preferred)) {
    used.add(preferred);
    return preferred;
  }
  let id = globalThis.crypto.randomUUID();
  while (used.has(id)) id = globalThis.crypto.randomUUID();
  used.add(id);
  return id;
}

/**
 * Normalizes one recorded day. Older files omit `achieved` and `target`, so
 * they are derived from the habit goal instead of being dropped.
 */
function normalizeProgress(
  habit: BackupHabitInput,
  entry: BackupProgressInput
): DailyProgress {
  const value = entry.value;
  const target = entry.target ?? habit.required ?? 1;
  const progress: DailyProgress = {
    value,
    achieved: entry.achieved ?? value >= Math.max(1, target),
  };
  progress.target = target;
  const note = cleanText(entry.note);
  if (note) progress.note = note;
  if (entry.skipped) progress.skipped = true;
  return progress;
}

function planHabit(
  input: BackupHabitInput,
  userId: string,
  profileId: string,
  index: number,
  mode: RestoreMode,
  usedHabitIds: Set<string>
): HabitDoc {
  const dailyProgress: Record<string, DailyProgress> = {};
  for (const [date, entry] of Object.entries(input.dailyProgress)) {
    dailyProgress[date] = normalizeProgress(input, entry);
  }
  // A "yes" habit's completed dates are its recorded days, so keep the two in
  // sync even for files that only stored one of them.
  for (const date of input.completedDates) {
    dailyProgress[date] ??= { value: 1, achieved: true, target: 1 };
  }

  return {
    _id: nextId(input.id, mode, usedHabitIds),
    userId,
    profileId,
    name: input.name.trim(),
    goalType: input.goalType,
    required: input.goalType === "yes" ? 1 : input.required ?? 1,
    minimum: input.goalType === "yes" ? undefined : input.minimum,
    unit: cleanText(input.unit),
    period: input.period,
    schedule: input.schedule ?? { type: "daily" },
    sortOrder: input.sortOrder ?? index,
    createdAt: input.createdAt,
    completedDates: [...new Set(input.completedDates)].sort(),
    dailyProgress,
    archivedAt: input.archivedAt,
    category: cleanText(input.category),
    color: cleanText(input.color),
    emoji: cleanText(input.emoji),
    reminder: input.reminder,
  };
}

/**
 * Turns a parsed backup into database docs without touching MongoDB, so the
 * import rules are testable in isolation.
 */
export function buildRestorePlan(
  userId: string,
  backup: BackupInput,
  mode: RestoreMode,
  now: string = new Date().toISOString()
): RestorePlan {
  const usedProfileIds = new Set<string>();
  const usedHabitIds = new Set<string>();
  const profiles: ProfileDoc[] = [];
  const habits: HabitDoc[] = [];

  for (const input of backup.profiles) {
    const profileId = nextId(input.id, mode, usedProfileIds);
    profiles.push({
      _id: profileId,
      userId,
      name: input.name.trim(),
      avatar: input.avatar,
      timeZone: cleanTimeZone(input.timeZone),
      dayStartHour: input.dayStartHour,
      createdAt: now,
    });

    input.habits.forEach((habit, index) => {
      habits.push(
        planHabit(habit, userId, profileId, index, mode, usedHabitIds)
      );
    });
  }

  return {
    profiles,
    habits,
    profileCount: profiles.length,
    habitCount: habits.length,
  };
}

/**
 * Short human summary of a backup file, used by the restore preview before
 * anything is written.
 */
export function describeBackup(backup: BackupInput): {
  profiles: number;
  habits: number;
  archivedHabits: number;
  entries: number;
} {
  let habits = 0;
  let archivedHabits = 0;
  let entries = 0;
  for (const profile of backup.profiles ?? []) {
    for (const habit of profile.habits ?? []) {
      habits += 1;
      if (habit.archivedAt) archivedHabits += 1;
      entries += Object.keys(habit.dailyProgress ?? {}).length;
    }
  }
  return {
    profiles: (backup.profiles ?? []).length,
    habits,
    archivedHabits,
    entries,
  };
}
