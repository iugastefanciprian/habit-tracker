import { randomUUID } from "node:crypto";
import type { Habit, Profile } from "@/lib/types";
import { withDayValue } from "@/lib/domain/habits";
import type { HabitDoc } from "../db/documents";
import { AppError } from "../errors";
import { countProfiles, insertProfile } from "../repositories/profiles";
import { insertHabit } from "../repositories/habits";

interface LegacyHabitInput {
  name: string;
  goalType: Habit["goalType"];
  required: number;
  minimum?: number;
  unit?: string;
  period: Habit["period"];
  createdAt: string;
  completedDates: string[];
  dailyProgress: Record<string, { value: number; achieved: boolean }>;
}

export interface ImportInput {
  profiles: { name: string; habits: LegacyHabitInput[] }[];
}

function rebuildHabit(input: LegacyHabitInput): Habit {
  let habit: Habit = {
    id: randomUUID(),
    name: input.name,
    goalType: input.goalType,
    required: input.goalType === "yes" ? 1 : input.required,
    minimum: input.minimum,
    unit: input.unit || undefined,
    period: input.period,
    schedule: { type: "daily" },
    sortOrder: 0,
    createdAt: input.createdAt,
    completedDates: [],
    dailyProgress: {},
  };

  if (input.goalType === "yes") {
    for (const date of input.completedDates) {
      habit = withDayValue(habit, date, 1);
    }
    return habit;
  }

  for (const [date, progress] of Object.entries(input.dailyProgress)) {
    if (date < habit.createdAt) continue;
    habit = withDayValue(habit, date, progress.value);
  }
  return habit;
}

export async function importLegacyData(
  userId: string,
  input: ImportInput
): Promise<Profile[]> {
  const existing = await countProfiles(userId);
  if (existing > 0) {
    throw new AppError(409, "This account already has profiles");
  }

  const imported: Profile[] = [];

  for (const legacyProfile of input.profiles) {
    const profileDoc = {
      _id: randomUUID(),
      userId,
      name: legacyProfile.name,
      createdAt: new Date().toISOString(),
    };
    const profile = await insertProfile(profileDoc);
    imported.push(profile);

    for (const legacyHabit of legacyProfile.habits) {
      const habit = rebuildHabit(legacyHabit);
      const doc: HabitDoc = {
        _id: habit.id,
        userId,
        profileId: profile.id,
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
      };
      await insertHabit(doc);
    }
  }

  return imported;
}
