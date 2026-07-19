import { describe, expect, it } from "vitest";
import { datesOverlap, validateDateRange, validateRestaurantServiceWindow } from "../services/reservations/availability";

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

  it("detects an overlap between two same-day restaurant table slots (datetime granularity)", () => {
    // Table booked 20:00-22:00; a new request for 21:00-23:00 on the same table overlaps.
    const existingIn = new Date("2026-08-10T20:00:00");
    const existingOut = new Date("2026-08-10T22:00:00");
    expect(datesOverlap(existingIn, existingOut, new Date("2026-08-10T21:00:00"), new Date("2026-08-10T23:00:00"))).toBe(true);
  });

  it("does not flag back-to-back same-day table slots as overlapping", () => {
    // Table booked 20:00-22:00; a new request starting exactly at 22:00 is fine (back-to-back).
    const existingIn = new Date("2026-08-10T20:00:00");
    const existingOut = new Date("2026-08-10T22:00:00");
    expect(datesOverlap(existingIn, existingOut, new Date("2026-08-10T22:00:00"), new Date("2026-08-10T23:30:00"))).toBe(false);
  });

  it("does not flag two different same-day slots on the same table as overlapping (lunch vs dinner)", () => {
    const lunchIn = new Date("2026-08-10T13:00:00");
    const lunchOut = new Date("2026-08-10T15:00:00");
    expect(datesOverlap(lunchIn, lunchOut, new Date("2026-08-10T20:00:00"), new Date("2026-08-10T22:00:00"))).toBe(false);
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

  it("DATE granularity (hotel): accepts a same-day checkIn regardless of clock time", () => {
    // now is 18:00 on Aug 10th; checkIn is midnight Aug 10th (no time-of-day given, as hotel
    // dates typically are) -- must NOT be rejected as "past" just because 18:00 > 00:00.
    const now = new Date("2026-08-10T18:00:00");
    expect(validateDateRange(new Date("2026-08-10T00:00:00"), new Date("2026-08-12T00:00:00"), now, "DATE")).toBeNull();
  });

  it("DATETIME granularity (restaurant): rejects a same-day slot that has already elapsed", () => {
    // now is 15:00; a table booking requested for 13:00 the same day already passed -- this is
    // exactly the hotel-oriented "date-level" assumption bug this granularity distinction fixes.
    const now = new Date("2026-08-10T15:00:00");
    const result = validateDateRange(new Date("2026-08-10T13:00:00"), new Date("2026-08-10T15:00:00"), now, "DATETIME");
    expect(result).toMatch(/ya paso/);
  });

  it("DATETIME granularity (restaurant): accepts a same-day slot still in the future", () => {
    const now = new Date("2026-08-10T15:00:00");
    const result = validateDateRange(new Date("2026-08-10T20:00:00"), new Date("2026-08-10T22:00:00"), now, "DATETIME");
    expect(result).toBeNull();
  });
});

describe("validateRestaurantServiceWindow", () => {
  const property = {
    closedWeekdays: [1], // Monday
    lunchOpen: "12:30",
    lunchClose: "16:00",
    dinnerOpen: "19:30",
    dinnerClose: "23:30",
  };

  it("rejects a booking on a closed weekday", () => {
    // 2026-08-10 is a Monday.
    const result = validateRestaurantServiceWindow(property, new Date("2026-08-10T13:00:00"));
    expect(result).toMatch(/cerrado/);
  });

  it("accepts a booking inside the lunch window", () => {
    // 2026-08-11 is a Tuesday.
    expect(validateRestaurantServiceWindow(property, new Date("2026-08-11T13:30:00"))).toBeNull();
  });

  it("accepts a booking inside the dinner window", () => {
    expect(validateRestaurantServiceWindow(property, new Date("2026-08-11T20:30:00"))).toBeNull();
  });

  it("rejects a booking between lunch and dinner service", () => {
    const result = validateRestaurantServiceWindow(property, new Date("2026-08-11T17:00:00"));
    expect(result).toMatch(/fuera del horario/);
  });

  it("does not block when no service windows are configured", () => {
    expect(validateRestaurantServiceWindow({ closedWeekdays: [] }, new Date("2026-08-11T04:00:00"))).toBeNull();
  });
});
