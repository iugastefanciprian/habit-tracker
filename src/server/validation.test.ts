import { describe, expect, it } from "vitest";
import {
  backupSchema,
  categoryRenameSchema,
  dayValueSchema,
  habitInputSchema,
  habitScheduleSchema,
  habitUpdateSchema,
  profileUpdateSchema,
  pushEndpointSchema,
  pushSubscribeSchema,
  reorderHabitsSchema,
  restoreSchema,
  usernameSchema,
} from "@/server/validation";

describe("username validation", () => {
  it("trims and lowercases usernames", () => {
    expect(usernameSchema.parse({ username: "  Alice_01  " }).username).toBe(
      "alice_01"
    );
  });

  it("accepts letters, numbers, underscores, and dashes", () => {
    expect(
      usernameSchema.parse({ username: "habit-tracker_42" }).username
    ).toBe("habit-tracker_42");
  });

  it("rejects short usernames", () => {
    expect(() => usernameSchema.parse({ username: "ab" })).toThrow();
  });

  it("rejects spaces and symbols", () => {
    expect(() => usernameSchema.parse({ username: "not valid" })).toThrow();
    expect(() => usernameSchema.parse({ username: "user@name" })).toThrow();
  });
});

describe("habit schedule validation", () => {
  it("accepts daily, weekday, and times-per-week schedules", () => {
    expect(habitScheduleSchema.parse({ type: "daily" })).toEqual({ type: "daily" });
    expect(
      habitScheduleSchema.parse({ type: "weekdays", weekdays: [1, 3, 5] })
    ).toEqual({ type: "weekdays", weekdays: [1, 3, 5] });
    expect(
      habitScheduleSchema.parse({ type: "timesPerWeek", timesPerWeek: 3 })
    ).toEqual({ type: "timesPerWeek", timesPerWeek: 3 });
  });

  it("rejects invalid weekday numbers", () => {
    expect(() =>
      habitScheduleSchema.parse({ type: "weekdays", weekdays: [7] })
    ).toThrow();
    expect(() =>
      habitScheduleSchema.parse({ type: "weekdays", weekdays: [] })
    ).toThrow();
  });

  it("defaults nothing and keeps a daily habit valid when schedule is omitted", () => {
    const parsed = habitInputSchema.parse({
      name: "Read",
      goalType: "yes",
      period: "daily",
    });

    expect(parsed.schedule).toBeUndefined();
    expect(parsed.createdAt).toBeUndefined();
  });
});

describe("habit update validation", () => {
  it("accepts a partial edit", () => {
    expect(habitUpdateSchema.parse({ name: "Read more" })).toEqual({
      name: "Read more",
    });
  });

  it("accepts null to clear optional fields and an archive flag", () => {
    expect(
      habitUpdateSchema.parse({
        minimum: null,
        unit: null,
        archived: true,
      })
    ).toEqual({ minimum: null, unit: null, archived: true });
  });

  it("rejects an empty update", () => {
    expect(() => habitUpdateSchema.parse({})).toThrow();
  });

  it("rejects negative values", () => {
    expect(() => habitUpdateSchema.parse({ required: 0 })).toThrow();
    expect(() => habitUpdateSchema.parse({ minimum: -1 })).toThrow();
  });
});

describe("day value validation", () => {
  it("accepts values, notes, and skips", () => {
    expect(
      dayValueSchema.parse({
        value: 8,
        note: "  steady  ",
        skipped: false,
      })
    ).toEqual({ value: 8, note: "steady", skipped: false });
  });

  it("accepts a note-only day and a null note to clear it", () => {
    expect(dayValueSchema.parse({ value: null, note: "rest" })).toEqual({
      value: null,
      note: "rest",
    });
    expect(dayValueSchema.parse({ value: 4, note: null })).toEqual({
      value: 4,
      note: null,
    });
  });

  it("accepts skipped days without a value", () => {
    expect(dayValueSchema.parse({ value: null, skipped: true })).toEqual({
      value: null,
      skipped: true,
    });
  });

  it("rejects missing or negative values and overlong notes", () => {
    expect(() => dayValueSchema.parse({ note: "hi" })).toThrow();
    expect(() => dayValueSchema.parse({ value: -1 })).toThrow();
    expect(() =>
      dayValueSchema.parse({ value: 1, note: "x".repeat(501) })
    ).toThrow();
  });
});

describe("reorder validation", () => {
  it("accepts an ordered list of habit ids", () => {
    expect(
      reorderHabitsSchema.parse({ habitIds: ["a", "b"] })
    ).toEqual({ habitIds: ["a", "b"] });
  });

  it("rejects an empty list", () => {
    expect(() => reorderHabitsSchema.parse({ habitIds: [] })).toThrow();
  });
});

describe("category and appearance validation", () => {
  it("accepts a category, colour, and emoji when creating a habit", () => {
    const parsed = habitInputSchema.parse({
      name: "Water",
      goalType: "count",
      required: 8,
      period: "daily",
      category: "  Health  ",
      color: "#06b6d4",
      emoji: "💧",
    });

    expect(parsed.category).toBe("Health");
    expect(parsed.color).toBe("#06b6d4");
    expect(parsed.emoji).toBe("💧");
  });

  it("accepts null to clear a category, colour, or emoji", () => {
    expect(
      habitUpdateSchema.parse({
        category: null,
        color: null,
        emoji: null,
      })
    ).toEqual({ category: null, color: null, emoji: null });
  });

  it("accepts a reminder on create and clears it on update", () => {
    expect(
      habitInputSchema.parse({
        name: "Water",
        goalType: "count",
        required: 8,
        period: "daily",
        reminder: { enabled: true, time: "08:30" },
      }).reminder
    ).toEqual({ enabled: true, time: "08:30" });

    expect(habitUpdateSchema.parse({ reminder: null })).toEqual({
      reminder: null,
    });
    expect(
      habitUpdateSchema.parse({
        reminder: { enabled: false, time: "21:05" },
      }).reminder
    ).toEqual({ enabled: false, time: "21:05" });
  });

  it("rejects malformed reminder times", () => {
    expect(() =>
      habitUpdateSchema.parse({
        reminder: { enabled: true, time: "8:30" },
      })
    ).toThrow();
    expect(() =>
      habitUpdateSchema.parse({
        reminder: { enabled: true, time: "25:00" },
      })
    ).toThrow();
  });

  it("rejects overlong categories", () => {
    expect(() =>
      habitUpdateSchema.parse({ category: "x".repeat(41) })
    ).toThrow();
  });

  it("requires a source category and allows clearing the target", () => {
    expect(categoryRenameSchema.parse({ from: "Health", to: null })).toEqual({
      from: "Health",
      to: null,
    });
    expect(() => categoryRenameSchema.parse({ from: "  ", to: "Fit" })).toThrow();
    expect(() => categoryRenameSchema.parse({ from: "Health" })).toThrow();
  });
});

describe("profile update validation", () => {
  it("accepts calendar settings and clearing them", () => {
    expect(
      profileUpdateSchema.parse({
        timeZone: "Europe/Berlin",
        dayStartHour: 4,
      })
    ).toEqual({ timeZone: "Europe/Berlin", dayStartHour: 4 });

    expect(
      profileUpdateSchema.parse({ timeZone: null, dayStartHour: null })
    ).toEqual({ timeZone: null, dayStartHour: null });
  });

  it("rejects unknown time zones and out-of-range hours", () => {
    expect(() =>
      profileUpdateSchema.parse({ timeZone: "Not/AZone" })
    ).toThrow();
    expect(() => profileUpdateSchema.parse({ dayStartHour: -1 })).toThrow();
    expect(() => profileUpdateSchema.parse({ dayStartHour: 24 })).toThrow();
    expect(() => profileUpdateSchema.parse({ dayStartHour: 2.5 })).toThrow();
  });

  it("rejects an empty profile update", () => {
    expect(() => profileUpdateSchema.parse({})).toThrow();
  });
});

describe("backup validation", () => {
  const habit = {
    name: "Water",
    goalType: "count",
    required: 8,
    period: "daily",
    createdAt: "2026-01-01",
  };

  it("accepts a version 2 backup with optional metadata", () => {
    const parsed = backupSchema.parse({
      version: 2,
      exportedAt: "2026-10-27T10:00:00.000Z",
      profiles: [
        {
          id: "profile-1",
          name: "Stefan",
          timeZone: "Europe/Berlin",
          dayStartHour: 4,
          habits: [
            {
              ...habit,
              category: "Health",
              reminder: { enabled: true, time: "08:30" },
              dailyProgress: { "2026-01-02": { value: 8, note: "easy" } },
            },
          ],
        },
      ],
    });

    expect(parsed.profiles[0].habits[0].completedDates).toEqual([]);
    expect(parsed.profiles[0].habits[0].reminder).toEqual({
      enabled: true,
      time: "08:30",
    });
  });

  it("accepts a bare legacy backup and defaults its collections", () => {
    const parsed = backupSchema.parse({
      version: 1,
      profiles: [{ name: "Old", habits: [habit] }],
    });

    expect(parsed.profiles[0].habits[0].dailyProgress).toEqual({});
  });

  it("rejects empty backups, bad dates, and bad reminder times", () => {
    expect(() => backupSchema.parse({ profiles: [] })).toThrow();
    expect(() =>
      backupSchema.parse({
        profiles: [
          { name: "P", habits: [{ ...habit, createdAt: "2026-02-30" }] },
        ],
      })
    ).toThrow();
    expect(() =>
      backupSchema.parse({
        profiles: [
          {
            name: "P",
            habits: [
              {
                ...habit,
                reminder: { enabled: true, time: "8:30" },
              },
            ],
          },
        ],
      })
    ).toThrow();
  });

  it("restricts restore modes", () => {
    expect(
      restoreSchema.parse({ mode: "replace", backup: { profiles: [{ name: "P", habits: [] }] } })
        .mode
    ).toBe("replace");
    expect(() =>
      restoreSchema.parse({ mode: "overwrite", backup: { profiles: [{ name: "P", habits: [] }] } })
    ).toThrow();
  });
});

describe("push subscription validation", () => {
  const subscription = {
    endpoint: "https://push.example.com/abc",
    keys: { p256dh: "public-key", auth: "auth-secret" },
  };

  it("accepts a browser subscription for a profile", () => {
    expect(
      pushSubscribeSchema.parse({ profileId: "profile-1", subscription })
    ).toEqual({ profileId: "profile-1", subscription });
  });

  it("rejects a non-URL endpoint and missing keys", () => {
    expect(() =>
      pushSubscribeSchema.parse({
        profileId: "profile-1",
        subscription: { ...subscription, endpoint: "not-a-url" },
      })
    ).toThrow();
    expect(() =>
      pushSubscribeSchema.parse({
        profileId: "profile-1",
        subscription: { endpoint: subscription.endpoint, keys: {} },
      })
    ).toThrow();
  });

  it("validates unsubscribe endpoints", () => {
    expect(pushEndpointSchema.parse({ endpoint: subscription.endpoint })).toEqual({
      endpoint: subscription.endpoint,
    });
    expect(() => pushEndpointSchema.parse({ endpoint: "/relative" })).toThrow();
  });
});
