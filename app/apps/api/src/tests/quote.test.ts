import { describe, expect, it } from "vitest";
import { computeQuote } from "../services/reservations/quote";

describe("computeQuote", () => {
  it("computes nights * rate + cleaning fee + services - discounts + taxes", () => {
    const result = computeQuote({
      basePrice: 100000,
      cleaningFee: 20000,
      checkIn: new Date("2026-08-10"),
      checkOut: new Date("2026-08-13"),
      services: [{ label: "Spa", amount: 30000 }],
      discounts: [{ label: "Descuento fidelidad", amount: 10000 }],
      taxRate: 0.19,
      currency: "CLP",
    });

    expect(result.nights).toBe(3);
    expect(result.lodgingSubtotal).toBe(300000);
    expect(result.subtotalBeforeTax).toBe(300000 + 20000 + 30000 - 10000);
    expect(result.taxes).toBe(Math.round(result.subtotalBeforeTax * 0.19 * 100) / 100);
    expect(result.total).toBe(result.subtotalBeforeTax + result.taxes);
  });

  it("handles zero nights safely", () => {
    const result = computeQuote({
      basePrice: 50000,
      cleaningFee: 0,
      checkIn: new Date("2026-08-10"),
      checkOut: new Date("2026-08-10"),
    });
    expect(result.nights).toBe(0);
    expect(result.total).toBe(0);
  });

  it("FLAT mode (restaurant table): a free reservation totals 0 and has no lodging/cleaning line items", () => {
    const result = computeQuote({
      basePrice: 0,
      cleaningFee: 0,
      checkIn: new Date("2026-08-10T20:00:00"),
      checkOut: new Date("2026-08-10T22:00:00"), // 2-hour same-day window, not a full night
      pricingMode: "FLAT",
    });
    expect(result.pricingMode).toBe("FLAT");
    expect(result.nights).toBe(0);
    expect(result.total).toBe(0);
    // Never a nonsensical "0 noche(s) x 0" or "Tarifa de aseo: 0" line for a free table booking.
    expect(result.lineItems.some((li) => /noche/i.test(li.label))).toBe(false);
    expect(result.lineItems).toEqual([]);
  });

  it("FLAT mode (restaurant table): a flat reservation fee is charged once, not multiplied by nights", () => {
    const result = computeQuote({
      basePrice: 5000, // flat table-reservation fee, NOT a nightly rate
      cleaningFee: 0,
      checkIn: new Date("2026-08-10T20:00:00"),
      checkOut: new Date("2026-08-10T22:00:00"),
      pricingMode: "FLAT",
    });
    expect(result.total).toBe(5000); // would be 0 under NIGHTLY math (differenceInCalendarDays = 0)
    expect(result.lineItems).toEqual([{ label: "Reserva de mesa", amount: 5000 }]);
  });

  it("FLAT mode still applies services and taxes on top of the flat fee", () => {
    const result = computeQuote({
      basePrice: 5000,
      cleaningFee: 0,
      checkIn: new Date("2026-08-10T20:00:00"),
      checkOut: new Date("2026-08-10T22:00:00"),
      services: [{ label: "Botella de vino", amount: 15000 }],
      taxRate: 0.19,
      pricingMode: "FLAT",
    });
    expect(result.subtotalBeforeTax).toBe(20000);
    expect(result.taxes).toBe(Math.round(20000 * 0.19 * 100) / 100);
    expect(result.total).toBe(result.subtotalBeforeTax + result.taxes);
  });

  it("NIGHTLY mode is unaffected by the pricingMode addition (default behavior unchanged)", () => {
    const result = computeQuote({
      basePrice: 100000,
      cleaningFee: 20000,
      checkIn: new Date("2026-08-10"),
      checkOut: new Date("2026-08-13"),
    });
    expect(result.pricingMode).toBe("NIGHTLY");
    expect(result.nights).toBe(3);
    expect(result.lineItems[0].label).toMatch(/noche/);
  });
});
