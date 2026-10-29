import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must use YYYY-MM-DD")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "Invalid calendar date");

export const usernameSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Username must be at least 3 characters")
    .max(32, "Username is too long")
    .regex(
      /^[a-z0-9_-]+$/,
      "Use only letters, numbers, underscores, and dashes"
    ),
});

export const profileInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Profile name is required")
    .max(80, "Profile name is too long"),
});

export const profileAvatarSchema = z
  .string()
  .max(2_000_000, "Picture is too large")
  .regex(
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/,
    "Unsupported image format"
  );

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export const profileUpdateSchema = z
  .object({
    avatar: profileAvatarSchema.nullable().optional(),
    timeZone: z
      .string()
      .trim()
      .max(64)
      .refine(isValidTimeZone, "Unknown time zone")
      .nullable()
      .optional(),
    dayStartHour: z.number().int().min(0).max(23).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update",
  });

export const habitScheduleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("daily") }),
  z.object({
    type: z.literal("weekdays"),
    weekdays: z
      .array(z.number().int().min(0).max(6))
      .min(1, "Pick at least one weekday")
      .max(7),
  }),
  z.object({
    type: z.literal("timesPerWeek"),
    timesPerWeek: z.number().int().min(1).max(7),
  }),
]);

export const habitReminderSchema = z.object({
  enabled: z.boolean(),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Reminder time must use HH:mm"),
});

export const habitInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Habit name is required")
    .max(120, "Habit name is too long"),
  goalType: z.enum(["yes", "time", "count"]),
  required: z
    .number()
    .finite()
    .positive("Required amount must be greater than zero")
    .max(1_000_000)
    .optional(),
  minimum: z.number().finite().nonnegative().max(1_000_000).optional(),
  unit: z.string().trim().max(40).optional(),
  period: z.enum(["daily", "weekly"]),
  schedule: habitScheduleSchema.optional(),
  category: z.string().trim().max(40).optional(),
  color: z.string().trim().max(32).optional(),
  emoji: z.string().trim().max(16).optional(),
  reminder: habitReminderSchema.optional(),
  createdAt: isoDate.optional(),
});

export const habitUpdateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Habit name is required")
      .max(120, "Habit name is too long")
      .optional(),
    goalType: z.enum(["yes", "time", "count"]).optional(),
    required: z
      .number()
      .finite()
      .positive("Required amount must be greater than zero")
      .max(1_000_000)
      .optional(),
    minimum: z
      .number()
      .finite()
      .nonnegative()
      .max(1_000_000)
      .nullable()
      .optional(),
    unit: z.string().trim().max(40).nullable().optional(),
    period: z.enum(["daily", "weekly"]).optional(),
    schedule: habitScheduleSchema.optional(),
    category: z.string().trim().max(40).nullable().optional(),
    color: z.string().trim().max(32).nullable().optional(),
    emoji: z.string().trim().max(16).nullable().optional(),
    reminder: habitReminderSchema.nullable().optional(),
    archived: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update",
  });

export const categoryRenameSchema = z.object({
  from: z.string().trim().min(1, "Category name is required").max(40),
  to: z.string().trim().max(40).nullable(),
});

export const reorderHabitsSchema = z.object({
  habitIds: z
    .array(z.string().trim().min(1))
    .min(1, "Provide at least one habit")
    .max(2_000),
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2_048),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
});

export const pushSubscribeSchema = z.object({
  profileId: z.string().trim().min(1).max(200),
  subscription: pushSubscriptionSchema,
});

export const pushEndpointSchema = z.object({
  endpoint: z.string().url().max(2_048),
});

export const pushTestSchema = z.object({
  profileId: z.string().trim().min(1).max(200),
});

export const dayValueSchema = z.object({
  value: z.number().finite().nonnegative().max(1_000_000).nullable(),
  note: z.string().trim().max(500).nullable().optional(),
  skipped: z.boolean().optional(),
});

export const toggleDaySchema = z.object({
  date: isoDate.optional(),
});

export const dateParamSchema = isoDate;

const legacyHabitSchema = z.object({
  name: z.string().trim().min(1).max(120),
  goalType: z.enum(["yes", "time", "count"]),
  required: z.number().finite().positive().max(1_000_000),
  minimum: z.number().finite().nonnegative().max(1_000_000).optional(),
  unit: z.string().trim().max(40).optional(),
  period: z.enum(["daily", "weekly"]),
  createdAt: isoDate,
  completedDates: z.array(isoDate).max(20_000),
  dailyProgress: z
    .record(
      isoDate,
      z.object({
        value: z.number().finite().nonnegative(),
        achieved: z.boolean(),
      })
    )
    .default({}),
});

export const importSchema = z.object({
  profiles: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        habits: z.array(legacyHabitSchema).max(2_000),
      })
    )
    .max(50),
});

const backupProgressSchema = z.object({
  value: z.number().finite().nonnegative().max(1_000_000),
  achieved: z.boolean().optional(),
  target: z.number().finite().nonnegative().max(1_000_000).optional(),
  note: z.string().trim().max(500).optional(),
  skipped: z.boolean().optional(),
});

const backupHabitSchema = z.object({
  id: z.string().trim().min(1).max(200).optional(),
  name: z.string().trim().min(1).max(120),
  goalType: z.enum(["yes", "time", "count"]),
  required: z.number().finite().positive().max(1_000_000).optional(),
  minimum: z.number().finite().nonnegative().max(1_000_000).optional(),
  unit: z.string().trim().max(40).optional(),
  period: z.enum(["daily", "weekly"]),
  schedule: habitScheduleSchema.optional(),
  sortOrder: z.number().int().nonnegative().max(100_000).optional(),
  createdAt: isoDate,
  completedDates: z.array(isoDate).max(20_000).default([]),
  dailyProgress: z.record(isoDate, backupProgressSchema).default({}),
  archivedAt: isoDate.optional(),
  category: z.string().trim().max(40).optional(),
  color: z.string().trim().max(32).optional(),
  emoji: z.string().trim().max(16).optional(),
  reminder: habitReminderSchema.optional(),
});

export const backupProfileSchema = z.object({
  id: z.string().trim().min(1).max(200).optional(),
  name: z.string().trim().min(1).max(80),
  avatar: profileAvatarSchema.optional(),
  timeZone: z.string().trim().max(64).optional(),
  dayStartHour: z.number().int().min(0).max(23).optional(),
  habits: z.array(backupHabitSchema).max(2_000),
});

/** A full backup file (current or legacy shape) offered for restore. */
export const backupSchema = z.object({
  version: z.number().int().min(1).max(2).optional(),
  exportedAt: z.string().optional(),
  profiles: z
    .array(backupProfileSchema)
    .min(1, "The backup has no profiles")
    .max(50),
});

export const restoreSchema = z.object({
  mode: z.enum(["merge", "replace"]),
  backup: backupSchema,
});

export type BackupInput = z.infer<typeof backupSchema>;
