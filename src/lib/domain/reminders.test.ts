import { describe, expect, it } from "vitest";
import type { Habit } from "@/lib/types";
import { withDayValue } from "@/lib/domain/habits";
import {
  formatReminderTime,
  getActiveReminders,
  isHandledToday,
  isReminderDue,
  localMinutes,
  parseReminderTime,
} from "@/lib/domain/reminders";

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "habit-1",
    name: "Water",
    goalType: "count",
    required: 8,
    period: "daily",
    schedule: { type: "daily" },
    sortOrder: 0,
    createdAt: "2026-01-01",
    completedDates: [],
    dailyProgress: {},
    ...overrides,
  };
}

const TODAY = "2026-10-27";

describe("reminder times", () => {
  it("parses and formats HH:mm", () => {
    expect(parseReminderTime("00:00")).toBe(0);
    expect(parseReminderTime("08:30")).toBe(510);
    expect(parseReminderTime("23:59")).toBe(1439);
    expect(parseReminderTime("24:00")).toBeNull();
    expect(parseReminderTime("8:30")).toBeNull();
    expect(parseReminderTime("noon")).toBeNull();
    expect(formatReminderTime(510)).toBe("08:30");
    expect(formatReminderTime(0)).toBe("00:00");
    expect(formatReminderTime(1440)).toBe("00:00");
  });

  it("reads local minutes in the profile time zone", () => {
    const now = new Date("2026-10-27T12:34:00Z");
    expect(localMinutes(now, "UTC")).toBe(754);
    expect(localMinutes(now, "Europe/Berlin")).toBe(814);
    // An unknown zone falls back to the device clock, like `todayISO` does.
    expect(localMinutes(now, "Not/AZone")).toBe(localMinutes(now));
  });
});

describe("due reminders", () => {
  const reminded = (overrides: Partial<Habit> = {}) =>
    makeHabit({ reminder: { enabled: true, time: "09:00" }, ...overrides });

  it("is due once its time has passed", () => {
    expect(isReminderDue(reminded(), TODAY, 539)).toBe(false);
    expect(isReminderDue(reminded(), TODAY, 540)).toBe(true);
    expect(isReminderDue(reminded(), TODAY, 600)).toBe(true);
  });

  it("ignores disabled, invalid, and off-schedule reminders", () => {
    expect(
      isReminderDue(reminded({ reminder: { enabled: false, time: "09:00" } }), TODAY, 600)
    ).toBe(false);
    expect(
      isReminderDue(reminded({ reminder: { enabled: true, time: "9:00" } }), TODAY, 600)
    ).toBe(false);
    expect(
      isReminderDue(
        reminded({ schedule: { type: "weekdays", weekdays: [1] } }),
        TODAY,
        600
      )
    ).toBe(false);
    expect(
      isReminderDue(reminded({ createdAt: "2026-10-28" }), TODAY, 600)
    ).toBe(false);
  });

  it("stops once the day is handled or skipped", () => {
    const done = withDayValue(reminded(), TODAY, 8);
    expect(isReminderDue(done, TODAY, 600)).toBe(false);

    const noted = withDayValue(reminded(), TODAY, null, { note: "Away" });
    expect(isHandledToday(noted, TODAY)).toBe(true);
    expect(isReminderDue(noted, TODAY, 600)).toBe(false);

    const skipped = withDayValue(reminded(), TODAY, null, { skipped: true });
    expect(isReminderDue(skipped, TODAY, 600)).toBe(false);
  });

  it("keeps weekly goals due until something is logged", () => {
    const weekly = reminded({ period: "weekly", required: 3 });
    expect(isReminderDue(weekly, TODAY, 600)).toBe(true);
    expect(
      isReminderDue(withDayValue(weekly, TODAY, 1), TODAY, 600)
    ).toBe(false);
  });

  it("lists active reminders by time and honours dismissals", () => {
    const late = makeHabit({
      id: "late",
      name: "Late",
      reminder: { enabled: true, time: "20:00" },
    });
    const early = makeHabit({
      id: "early",
      name: "Early",
      reminder: { enabled: true, time: "07:00" },
    });
    const noReminder = makeHabit({ id: "none", name: "No reminder" });

    expect(
      getActiveReminders([late, noReminder, early], TODAY, 21 * 60).map(
        (habit) => habit.id
      )
    ).toEqual(["early", "late"]);

    expect(
      getActiveReminders([late, early], TODAY, 21 * 60, ["early"]).map(
        (habit) => habit.id
      )
    ).toEqual(["late"]);

    expect(getActiveReminders([late, early], TODAY, 60)).toEqual([]);
  });
});
