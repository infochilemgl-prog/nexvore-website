import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { AnthropicProvider } from "./anthropic-provider";
import { OpenAIProvider } from "./openai-provider";
import { MockAIProvider } from "./mock-provider";
import type { AIProvider } from "./types";

let cached: AIProvider | null = null;

/**
 * Selects the AI provider based on AI_PROVIDER. If a real provider is
 * selected but its API key is missing, the app still boots -- it falls back
 * to MockAIProvider and logs a loud warning, instead of crashing at startup.
 */
export function getAIProvider(): AIProvider {
  if (cached) return cached;

  if (env.AI_PROVIDER === "anthropic") {
    const provider = new AnthropicProvider();
    if (provider.isConfigured()) {
      cached = provider;
    } else {
      logger.warn("AI_PROVIDER=anthropic pero falta ANTHROPIC_API_KEY. Usando MockAIProvider como fallback.");
      cached = new MockAIProvider();
    }
  } else if (env.AI_PROVIDER === "openai") {
    const provider = new OpenAIProvider();
    if (provider.isConfigured()) {
      cached = provider;
    } else {
      logger.warn("AI_PROVIDER=openai pero falta OPENAI_API_KEY. Usando MockAIProvider como fallback.");
      cached = new MockAIProvider();
    }
  } else {
    cached = new MockAIProvider();
  }

  logger.info({ provider: cached.name }, "AI provider inicializado");
  return cached;
}

/** Test-only: reset the cached provider so tests can swap env vars. */
export function _resetAIProviderCache() {
  cached = null;
}
