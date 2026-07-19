export interface RoiInput {
  interactionsAutomated: number;
  averageMinutesPerInteraction: number;
  configuredHourlyRate: number;
  upsellRevenue: number;
  aiCost: number;
  softwareCost: number;
}

export interface RoiResult {
  humanHoursSaved: number;
  humanCostAvoided: number;
  netSavings: number;
  roiPercentage: number;
}

/**
 * ROI formulas exactly as specified:
 *   humanHoursSaved = interactionsAutomated * averageMinutesPerInteraction / 60
 *   humanCostAvoided = humanHoursSaved * configuredHourlyRate
 *   netSavings = humanCostAvoided + upsellRevenue - aiCost - softwareCost
 *   roiPercentage = netSavings / (aiCost + softwareCost) * 100
 */
export function computeRoi(input: RoiInput): RoiResult {
  const humanHoursSaved = (input.interactionsAutomated * input.averageMinutesPerInteraction) / 60;
  const humanCostAvoided = humanHoursSaved * input.configuredHourlyRate;
  const netSavings = humanCostAvoided + input.upsellRevenue - input.aiCost - input.softwareCost;
  const denominator = input.aiCost + input.softwareCost;
  const roiPercentage = denominator === 0 ? 0 : (netSavings / denominator) * 100;

  return {
    humanHoursSaved: round2(humanHoursSaved),
    humanCostAvoided: round2(humanCostAvoided),
    netSavings: round2(netSavings),
    roiPercentage: round2(roiPercentage),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
