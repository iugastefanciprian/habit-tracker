import { describe, expect, it } from "vitest";
import type { BackupInput } from "@/lib/domain/backup";
import { buildRestorePlan, describeBackup } from "@/lib/domain/backup";

function makeBackup(overrides: Partial<BackupInput> = {}): BackupInput {
  return {
    version: 2,
    exportedAt: "2026-10-27T10:00:00.000Z",
    profiles: [
      {
        id: "profile-1",
        name: "  Stefan  ",
        timeZone: "Europe/Berlin",
        dayStartHour: 4,
        habits: [
          {
            id: "habit-1",
            name: " Water ",
            goalType: "count",
            required: 8,
            unit: "glasses",
            period: "daily",
            schedule: { type: "weekdays", weekdays: [1, 2, 3] },
            sortOrder: 3,
            createdAt: "2026-01-01",
            completedDates: ["2026-01-03", "2026-01-02"],
            dailyProgress: {
              "2026-01-02": {
                value: 8,
                achieved: true,
                target: 8,
                note: "  easy  ",
              },
              "2026-01-03": { value: 0, achieved: false, skipped: true },
            },
            category: " Health ",
            color: "#22c55e",
            emoji: "💧",
            reminder: { enabled: true, time: "08:30" },
            archivedAt: "2026-02-01",
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("buildRestorePlan", () => {
  it("restores every field on a replace", () => {
    const plan = buildRestorePlan("user-1", makeBackup(), "replace", "2026-10-27T12:00:00.000Z");

    expect(plan.profileCount).toBe(1);
    expect(plan.habitCount).toBe(1);
    expect(plan.profiles[0]).toMatchObject({
      _id: "profile-1",
      userId: "user-1",
      name: "Stefan",
      timeZone: "Europe/Berlin",
      dayStartHour: 4,
      createdAt: "2026-10-27T12:00:00.000Z",
    });
    expect(plan.habits[0]).toMatchObject({
      _id: "habit-1",
      profileId: "profile-1",
      name: "Water",
      required: 8,
      unit: "glasses",
      period: "daily",
      schedule: { type: "weekdays", weekdays: [1, 2, 3] },
      sortOrder: 3,
      createdAt: "2026-01-01",
      archivedAt: "2026-02-01",
      category: "Health",
      color: "#22c55e",
      emoji: "💧",
      reminder: { enabled: true, time: "08:30" },
    });
    expect(plan.habits[0].completedDates).toEqual(["2026-01-02", "2026-01-03"]);
    expect(plan.habits[0].dailyProgress["2026-01-02"]).toEqual({
      value: 8,
      achieved: true,
      target: 8,
      note: "easy",
    });
    expect(plan.habits[0].dailyProgress["2026-01-03"]).toEqual({
      value: 0,
      achieved: false,
      target: 8,
      skipped: true,
    });
  });

  it("allocates new ids on a merge", () => {
    const plan = buildRestorePlan("user-1", makeBackup(), "merge");

    expect(plan.profiles[0]._id).not.toBe("profile-1");
    expect(plan.habits[0]._id).not.toBe("habit-1");
    expect(plan.habits[0].profileId).toBe(plan.profiles[0]._id);
  });

  it("deduplicates ids inside one backup", () => {
    const backup: BackupInput = {
      profiles: [
        { id: "same", name: "One", habits: [] },
        { id: "same", name: "Two", habits: [] },
      ],
    };
    const plan = buildRestorePlan("user-1", backup, "replace");

    expect(plan.profiles[0]._id).toBe("same");
    expect(plan.profiles[1]._id).not.toBe("same");
    expect(new Set(plan.profiles.map((profile) => profile._id)).size).toBe(2);
  });

  it("fills defaults for older backups", () => {
    const backup: BackupInput = {
      version: 1,
      profiles: [
        {
          name: "Old",
          habits: [
            {
              name: "Journal",
              goalType: "yes",
              required: 1,
              period: "daily",
              createdAt: "2025-05-01",
              completedDates: ["2025-05-02"],
              dailyProgress: {},
            },
            {
              name: "Run",
              goalType: "time",
              required: 30,
              period: "daily",
              createdAt: "2025-05-01",
              completedDates: [],
              dailyProgress: { "2025-05-02": { value: 30 } },
            },
          ],
        },
      ],
    };

    const plan = buildRestorePlan("user-1", backup, "merge");
    const [journal, run] = plan.habits;

    expect(journal.schedule).toEqual({ type: "daily" });
    expect(journal.sortOrder).toBe(0);
    expect(journal.dailyProgress["2025-05-02"]).toEqual({
      value: 1,
      achieved: true,
      target: 1,
    });
    expect(run.sortOrder).toBe(1);
    expect(run.dailyProgress["2025-05-02"]).toEqual({
      value: 30,
      achieved: true,
      target: 30,
    });
  });

  it("drops blank labels and unknown time zones", () => {
    const plan = buildRestorePlan(
      "user-1",
      {
        profiles: [
          {
            name: "Blank",
            timeZone: "Not/AZone",
            habits: [
              {
                name: "Habit",
                goalType: "yes",
                required: 1,
                period: "daily",
                createdAt: "2026-01-01",
                completedDates: [],
                dailyProgress: {},
                category: "   ",
                color: " ",
                emoji: "",
              },
            ],
          },
        ],
      },
      "replace"
    );

    expect(plan.profiles[0].timeZone).toBeUndefined();
    expect(plan.habits[0].category).toBeUndefined();
    expect(plan.habits[0].color).toBeUndefined();
    expect(plan.habits[0].emoji).toBeUndefined();
  });

  it("forces a yes goal to a single step", () => {
    const plan = buildRestorePlan(
      "user-1",
      {
        profiles: [
          {
            name: "P",
            habits: [
              {
                name: "Meditate",
                goalType: "yes",
                required: 5,
                minimum: 2,
                period: "daily",
                createdAt: "2026-01-01",
                completedDates: [],
                dailyProgress: {},
              },
            ],
          },
        ],
      },
      "replace"
    );

    expect(plan.habits[0].required).toBe(1);
    expect(plan.habits[0].minimum).toBeUndefined();
  });
});

describe("describeBackup", () => {
  it("counts profiles, habits, archive, and entries", () => {
    const backup = makeBackup();
    backup.profiles[0].habits.push({
      name: "Read",
      goalType: "count",
      required: 10,
      period: "daily",
      createdAt: "2026-03-01",
      completedDates: [],
      dailyProgress: { "2026-03-01": { value: 4 } },
    });

    expect(describeBackup(backup)).toEqual({
      profiles: 1,
      habits: 2,
      archivedHabits: 1,
      entries: 3,
    });
  });

  it("tolerates missing collections", () => {
    expect(
      describeBackup({ profiles: [{ name: "Empty", habits: [] }] })
    ).toEqual({ profiles: 1, habits: 0, archivedHabits: 0, entries: 0 });
  });
});
