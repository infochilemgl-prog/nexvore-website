import { describe, expect, it } from "vitest";
import { datesOverlap, validateDateRange } from "../services/reservations/availability";

describe("datesOverlap", () => {
  it("detects an overlapping range", () => {
    const existingIn = new Date("2026-08-10");
    const existingOut = new Date("2026-08-15");
    expect(datesOverlap(existingIn, existingOut, new Date("2026-08-12"), new Date("2026-08-20"))).toBe(true);
  });

  it("does not flag back-to-back stays as overlapping", () => {
    const existingIn = new Date("2026-08-10");
    const existingOut = new Date("2026-08-15");
    expect(datesOverlap(existingIn, existingOut, new Date("2026-08-15"), new Date("2026-08-20"))).toBe(false);
  });

  it("detects a fully contained range", () => {
    expect(datesOverlap(new Date("2026-08-01"), new Date("2026-08-30"), new Date("2026-08-10"), new Date("2026-08-12"))).toBe(true);
  });
});

describe("validateDateRange", () => {
  it("rejects checkout <= checkin", () => {
    expect(validateDateRange(new Date("2026-08-10"), new Date("2026-08-10"))).toMatch(/posterior/);
  });

  it("rejects past dates", () => {
    expect(validateDateRange(new Date("2020-01-01"), new Date("2020-01-05"), new Date("2026-01-01"))).toMatch(/pasado/);
  });

  it("accepts a valid future range", () => {
    expect(validateDateRange(new Date("2026-08-10"), new Date("2026-08-12"), new Date("2026-01-01"))).toBeNull();
  });
});
