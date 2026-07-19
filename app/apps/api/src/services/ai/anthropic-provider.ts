import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config/env";
import type { AICompletionParams, AICompletionResult, AIProvider } from "./types";

/**
 * Thin adapter over the Anthropic SDK. Business logic never imports
 * @anthropic-ai/sdk directly -- only this file does.
 */
export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  private client: Anthropic | null = null;

  constructor() {
    if (env.ANTHROPIC_API_KEY) {
      this.client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    }
  }

  isConfigured(): boolean {
    return Boolean(env.ANTHROPIC_API_KEY);
  }

  async complete(params: AICompletionParams): Promise<AICompletionResult> {
    if (!this.client) {
      throw new Error("AnthropicProvider no configurado (falta ANTHROPIC_API_KEY).");
    }
    const model = env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

    const messages: Anthropic.MessageParam[] = params.messages.map((m) => {
      if (m.role === "tool") {
        return {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: m.toolCallId, content: m.content }],
        } satisfies Anthropic.MessageParam;
      }
      if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
        const blocks: Array<Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam> = [];
        if (m.content) blocks.push({ type: "text", text: m.content });
        for (const tc of m.toolCalls) {
          blocks.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.input });
        }
        return { role: "assistant", content: blocks } satisfies Anthropic.MessageParam;
      }
      return { role: m.role, content: m.content } satisfies Anthropic.MessageParam;
    });

    const response = await this.client.messages.create({
      model,
      max_tokens: 1024,
      system: params.system,
      messages,
      tools: params.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
      })),
    });

    let content = "";
    const toolCalls: AICompletionResult["toolCalls"] = [];
    for (const block of response.content) {
      if (block.type === "text") content += block.text;
      if (block.type === "tool_use") {
        toolCalls.push({ id: block.id, name: block.name, input: block.input as Record<string, unknown> });
      }
    }

    return {
      content,
      toolCalls,
      stopReason: response.stop_reason === "tool_use" ? "tool_use" : response.stop_reason === "max_tokens" ? "max_tokens" : "end_turn",
      usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
    };
  }
}
