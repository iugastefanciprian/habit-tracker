import type { Habit, Profile } from "@/lib/types";

const PROFILES_KEY = "habitTracker.profiles";
const habitsKey = (profileId: string) => `habitTracker.habits.${profileId}`;
const migratedKey = (userId: string) => `habitTracker.migrated.${userId}`;

export interface LegacyProfile {
  id: string;
  name: string;
  habits: Habit[];
}

export interface LegacyData {
  profiles: LegacyProfile[];
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Reads the pre-MongoDB localStorage shape. Returns null when there is no
 * legacy data (or it cannot be parsed safely).
 */
export function readLegacyData(): LegacyData | null {
  if (typeof window === "undefined") return null;

  const profiles = readJson<Profile[]>(PROFILES_KEY, []);
  if (!Array.isArray(profiles) || profiles.length === 0) return null;

  const withHabits: LegacyProfile[] = [];
  for (const profile of profiles) {
    if (!profile || typeof profile.id !== "string" || typeof profile.name !== "string") {
      continue;
    }
    const habits = readJson<Habit[]>(habitsKey(profile.id), []);
    withHabits.push({
      id: profile.id,
      name: profile.name,
      habits: Array.isArray(habits) ? habits : [],
    });
  }

  return withHabits.length > 0 ? { profiles: withHabits } : null;
}

export function clearLegacyData(data: LegacyData) {
  if (typeof window === "undefined") return;
  try {
    for (const profile of data.profiles) {
      localStorage.removeItem(habitsKey(profile.id));
    }
    localStorage.removeItem(PROFILES_KEY);
  } catch {
    // Ignore storage failures; import already succeeded on the server.
  }
}

export function wasMigrated(userId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(migratedKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function markMigrated(userId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(migratedKey(userId), "1");
  } catch {
    // Ignore storage failures.
  }
}
