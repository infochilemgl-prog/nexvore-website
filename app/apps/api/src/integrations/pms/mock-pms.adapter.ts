import type { PMSAdapter, PMSAvailabilityQuery, PMSReservationPayload } from "@hospitality-ai/integrations-sdk";
import { logger } from "../../config/logger";

export class MockPMSAdapter implements PMSAdapter {
  readonly name = "mock-pms";

  isConfigured(): boolean {
    return true;
  }

  async checkAvailability(query: PMSAvailabilityQuery) {
    logger.debug({ query }, "MockPMSAdapter.checkAvailability");
    return { available: true };
  }

  async pushReservation(payload: PMSReservationPayload) {
    logger.debug({ payload }, "MockPMSAdapter.pushReservation");
    return { externalId: `mock-pms-${Date.now()}`, syncedAt: new Date().toISOString() };
  }

  async cancelReservation(externalId: string) {
    logger.debug({ externalId }, "MockPMSAdapter.cancelReservation");
    return { cancelled: true };
  }
}
