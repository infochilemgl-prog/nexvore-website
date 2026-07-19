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
});
