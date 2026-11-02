// Domain types for the Ollama client. Wire shapes stay inside parse.ts; everything
// past that boundary uses these.

/** A model name as Ollama lists it, e.g. "llama3.2:latest". */
export type ModelName = string & { readonly __brand: "OllamaModelName" };

export interface ModelDetails {
  name: ModelName;
  family: string | null;
  parameterSize: string | null;
  /**
   * Capabilities reported by /api/show, e.g. "completion", "thinking", "embedding";
   * null when this Ollama doesn't report them, or /api/show failed for the model.
   */
  capabilities: ReadonlySet<string> | null;
  contextLength: number | null;
}

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  model: ModelName;
  messages: readonly ChatMessage[];
  numCtx: number;
  /** How long Ollama keeps the model loaded after this request, e.g. "30m". */
  keepAlive: string;
  /** Sent only for models that report the "thinking" capability. */
  think?: boolean;
}

/** One event from a streamed /api/chat response. */
export type ChatEvent =
  | { type: "content"; text: string }
  | { type: "thinking"; text: string }
  | {
      type: "done";
      reason: string;
      promptTokens: number;
      evalTokens: number;
      loadMs: number;
    };
