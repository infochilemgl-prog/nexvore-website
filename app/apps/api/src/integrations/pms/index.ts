import type { PMSAdapter } from "@hospitality-ai/integrations-sdk";
import { env } from "../../config/env";
import { MockPMSAdapter } from "./mock-pms.adapter";

let cached: PMSAdapter | null = null;

/**
 * PMS_PROVIDER=real would activate a concrete adapter once one is wired up
 * (e.g. a Cloudbeds/Guesty client) and PMS_API_KEY/PMS_BASE_URL are present.
 * No real PMS credentials were supplied for this build, so only the mock
 * adapter is implemented; this factory is where a real one would be added.
 */
export function getPMSAdapter(): PMSAdapter {
  if (cached) return cached;
  if (env.PMS_PROVIDER === "real" && env.PMS_API_KEY && env.PMS_BASE_URL) {
    // TODO: implement a real PMS adapter (Cloudbeds/Guesty/etc.) here.
    cached = new MockPMSAdapter();
  } else {
    cached = new MockPMSAdapter();
  }
  return cached;
}

export function pmsConnectionState(): { provider: string; configured: boolean } {
  return { provider: env.PMS_PROVIDER, configured: env.PMS_PROVIDER === "real" && Boolean(env.PMS_API_KEY) };
}
