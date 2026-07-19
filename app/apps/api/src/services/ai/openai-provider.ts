import OpenAI from "openai";
import { env } from "../../config/env";
import type { AICompletionParams, AICompletionResult, AIProvider } from "./types";

/** Thin adapter over the OpenAI SDK. Only this file imports "openai". */
export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  private client: OpenAI | null = null;

  constructor() {
    if (env.OPENAI_API_KEY) {
      this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    }
  }

  isConfigured(): boolean {
    return Boolean(env.OPENAI_API_KEY);
  }

  async complete(params: AICompletionParams): Promise<AICompletionResult> {
    if (!this.client) {
      throw new Error("OpenAIProvider no configurado (falta OPENAI_API_KEY).");
    }
    const model = env.OPENAI_MODEL || "gpt-4o-mini";

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: params.system },
      ...params.messages.map((m): OpenAI.Chat.ChatCompletionMessageParam => {
        if (m.role === "tool") {
          return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
        }
        if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
          return {
            role: "assistant",
            content: m.content || null,
            tool_calls: m.toolCalls.map((tc) => ({
              id: tc.id,
              type: "function",
              function: { name: tc.name, arguments: JSON.stringify(tc.input) },
            })),
          };
        }
        return { role: m.role, content: m.content };
      }),
    ];

    const response = await this.client.chat.completions.create({
      model,
      messages,
      tools: params.tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.inputSchema },
      })),
      tool_choice: "auto",
    });

    const choice = response.choices[0];
    const toolCalls = (choice.message.tool_calls ?? []).map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      input: JSON.parse(tc.function.arguments || "{}"),
    }));

    return {
      content: choice.message.content ?? "",
      toolCalls,
      stopReason: toolCalls.length > 0 ? "tool_use" : choice.finish_reason === "length" ? "max_tokens" : "end_turn",
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      },
    };
  }
}
