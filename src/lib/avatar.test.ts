import { describe, expect, it } from "vitest";
import { profileGradient, profileInitials } from "@/lib/avatar";

describe("profile initials", () => {
  it("uses the first letters of the first and last words", () => {
    expect(profileInitials("Stefan Dragos")).toBe("SD");
    expect(profileInitials("  morning   routine  ")).toBe("MR");
  });

  it("uses two characters for a single word", () => {
    expect(profileInitials("Stefan")).toBe("ST");
  });

  it("falls back for empty names", () => {
    expect(profileInitials("   ")).toBe("?");
  });
});

describe("profile gradient", () => {
  it("is stable for the same profile id", () => {
    expect(profileGradient("profile-1")).toBe(profileGradient("profile-1"));
  });

  it("differs between profile ids", () => {
    expect(profileGradient("profile-1")).not.toBe(profileGradient("profile-2"));
  });

  it("produces a two-stop linear gradient", () => {
    expect(profileGradient("profile-1")).toMatch(
      /^linear-gradient\(135deg, hsl\(\d+ 72% 55%\), hsl\(\d+ 68% 38%\)\)$/
    );
  });
});
