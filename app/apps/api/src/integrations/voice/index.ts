import type { VoiceProvider } from "@hospitality-ai/integrations-sdk";
import { env } from "../../config/env";
import { MockVoiceProvider } from "./mock-voice.provider";

let cached: VoiceProvider | null = null;

export function getVoiceProvider(): VoiceProvider {
  if (cached) return cached;
  // VAPI_API_KEY / BLAND_API_KEY are read here for a future real adapter;
  // none were supplied for this build so only the mock is implemented.
  cached = new MockVoiceProvider();
  return cached;
}

export function voiceConnectionState(): { provider: string; configured: boolean } {
  if (env.VOICE_PROVIDER === "vapi") return { provider: "vapi", configured: Boolean(env.VAPI_API_KEY) };
  if (env.VOICE_PROVIDER === "bland") return { provider: "bland", configured: Boolean(env.BLAND_API_KEY) };
  return { provider: "mock", configured: true };
}
