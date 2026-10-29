import { describe, expect, it } from "vitest";
import {
  HABIT_COLORS,
  HABIT_TEMPLATES,
  SUGGESTED_TEMPLATES,
} from "@/lib/domain/templates";

describe("habit templates", () => {
  it("has unique ids and complete display fields", () => {
    const ids = HABIT_TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const template of HABIT_TEMPLATES) {
      expect(template.name.trim()).not.toBe("");
      expect(template.description.trim()).not.toBe("");
      expect(template.category.trim()).not.toBe("");
      expect(template.emoji.trim()).not.toBe("");
      expect(HABIT_COLORS).toContain(template.color);
    }
  });

  it("uses valid goal targets", () => {
    for (const template of HABIT_TEMPLATES) {
      expect(template.required).toBeGreaterThan(0);
      if (template.goalType === "yes") {
        expect(template.required).toBe(1);
      }
      if (template.minimum !== undefined) {
        expect(template.minimum).toBeGreaterThanOrEqual(0);
        expect(template.minimum).toBeLessThanOrEqual(template.required);
      }
      expect(["daily", "weekly"]).toContain(template.period);
    }
  });

  it("uses valid schedules", () => {
    for (const template of HABIT_TEMPLATES) {
      const schedule = template.schedule;
      if (schedule.type === "weekdays") {
        expect(schedule.weekdays.length).toBeGreaterThan(0);
        for (const day of schedule.weekdays) {
          expect(day).toBeGreaterThanOrEqual(0);
          expect(day).toBeLessThanOrEqual(6);
        }
      }
      if (schedule.type === "timesPerWeek") {
        expect(schedule.timesPerWeek).toBeGreaterThanOrEqual(1);
        expect(schedule.timesPerWeek).toBeLessThanOrEqual(7);
      }
    }
  });

  it("suggests templates that exist", () => {
    expect(SUGGESTED_TEMPLATES.length).toBeGreaterThan(0);
    for (const template of SUGGESTED_TEMPLATES) {
      expect(HABIT_TEMPLATES).toContain(template);
    }
  });
});
