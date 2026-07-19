import type { VoiceProvider } from "@hospitality-ai/integrations-sdk";
import { logger } from "../../config/logger";

export class MockVoiceProvider implements VoiceProvider {
  readonly name = "mock-voice";

  isConfigured(): boolean {
    return true;
  }

  async startCall(to: string, context: Record<string, unknown>) {
    const callId = `mock-call-${Date.now()}`;
    logger.debug({ to, context, callId }, "MockVoiceProvider.startCall");
    return { callId };
  }

  async endCall(callId: string) {
    logger.debug({ callId }, "MockVoiceProvider.endCall");
    return { ended: true };
  }
}
