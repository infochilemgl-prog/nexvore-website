import { describe, expect, it } from "vitest";
import { computeRoi } from "../services/reporting/roi";

describe("computeRoi", () => {
  it("matches the spec formulas exactly", () => {
    const result = computeRoi({
      interactionsAutomated: 120,
      averageMinutesPerInteraction: 6,
      configuredHourlyRate: 8000,
      upsellRevenue: 150000,
      aiCost: 20000,
      softwareCost: 50000,
    });

    const expectedHours = (120 * 6) / 60;
    const expectedCostAvoided = expectedHours * 8000;
    const expectedNet = expectedCostAvoided + 150000 - 20000 - 50000;
    const expectedRoi = (expectedNet / (20000 + 50000)) * 100;

    // computeRoi rounds each intermediate value to 2 decimals (for
    // human-readable reporting), so compare against the unrounded formula
    // with a tolerance appropriate for that compounding rounding, not exact
    // floating point equality.
    expect(result.humanHoursSaved).toBeCloseTo(expectedHours, 2);
    expect(result.humanCostAvoided).toBeCloseTo(expectedCostAvoided, 2);
    expect(result.netSavings).toBeCloseTo(expectedNet, 2);
    expect(result.roiPercentage).toBeCloseTo(expectedRoi, 1);
  });

  it("does not divide by zero when aiCost + softwareCost is 0", () => {
    const result = computeRoi({
      interactionsAutomated: 0,
      averageMinutesPerInteraction: 0,
      configuredHourlyRate: 0,
      upsellRevenue: 0,
      aiCost: 0,
      softwareCost: 0,
    });
    expect(result.roiPercentage).toBe(0);
  });
});
