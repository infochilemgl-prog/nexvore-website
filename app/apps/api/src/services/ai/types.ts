export interface AIToolDefinition {
  name: string;
  description: string;
  /** JSON schema (draft-07-ish), generated from the tool's Zod schema. */
  inputSchema: Record<string, unknown>;
}

export type AIRole = "system" | "user" | "assistant" | "tool";

export interface AIToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface AIToolResultMessage {
  role: "tool";
  toolCallId: string;
  toolName: string;
  content: string;
}

export interface AIUserMessage {
  role: "user";
  content: string;
}

export interface AIAssistantMessage {
  role: "assistant";
  content: string;
  toolCalls?: AIToolCall[];
}

export type AIMessage = AIUserMessage | AIAssistantMessage | AIToolResultMessage;

export interface AICompletionResult {
  content: string;
  toolCalls: AIToolCall[];
  stopReason: "tool_use" | "end_turn" | "max_tokens";
  usage: { inputTokens: number; outputTokens: number };
}

export interface AICompletionParams {
  system: string;
  messages: AIMessage[];
  tools: AIToolDefinition[];
  /** Free-form hint used only by MockAIProvider to pick a scripted behaviour. */
  mockHint?: string;
}

export interface AIProvider {
  readonly name: string;
  isConfigured(): boolean;
  complete(params: AICompletionParams): Promise<AICompletionResult>;
}
