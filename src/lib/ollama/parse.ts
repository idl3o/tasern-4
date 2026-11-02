// The boundary: Ollama's JSON is untyped until one of these has narrowed it.

import { classifyServerError, OllamaRequestError } from "./errors";
import type { ChatEvent, ModelDetails, ModelName, PullProgress } from "./types";

type JsonObject = Record<string, unknown>;

const isObject = (v: unknown): v is JsonObject =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

const protocolError = (message: string) => new OllamaRequestError({ kind: "protocol", message });

/** Model names from a /api/tags response. */
export function parseTags(json: unknown): ModelName[] {
  if (!isObject(json) || !Array.isArray(json.models)) {
    throw protocolError("/api/tags has no models array");
  }
  return json.models.map((m: unknown, i) => {
    if (!isObject(m) || typeof m.name !== "string") {
      throw protocolError(`/api/tags model ${i} has no name`);
    }
    return m.name as ModelName; // branded here, at the boundary
  });
}

/** Capabilities, family and context length from a /api/show response. */
export function parseShow(name: ModelName, json: unknown): ModelDetails {
  if (!isObject(json)) throw protocolError(`/api/show for ${name} is not an object`);
  const details = isObject(json.details) ? json.details : {};
  const info = isObject(json.model_info) ? json.model_info : {};
  const ctxKey = Object.keys(info).find((k) => k.endsWith(".context_length"));
  const ctx = ctxKey === undefined ? undefined : info[ctxKey];
  return {
    name,
    family: typeof details.family === "string" ? details.family : null,
    parameterSize: typeof details.parameter_size === "string" ? details.parameter_size : null,
    capabilities: Array.isArray(json.capabilities)
      ? new Set(json.capabilities.filter((c: unknown): c is string => typeof c === "string"))
      : null,
    contextLength: typeof ctx === "number" ? ctx : null,
  };
}

/** The message in an Ollama error body (`{"error": "..."}`), else the raw text. */
export function parseErrorBody(text: string): string {
  try {
    const json: unknown = JSON.parse(text);
    if (isObject(json) && typeof json.error === "string") return json.error;
  } catch {
    // Not JSON (e.g. a proxy's HTML page): the raw text is the message.
  }
  return text.trim() || "no error message";
}

/** One NDJSON stream line as an object; a line reporting an error throws it typed. */
function parseStreamLine(line: string, model: string | null): JsonObject {
  let json: unknown;
  try {
    json = JSON.parse(line);
  } catch {
    throw protocolError(`unparseable stream line: ${line.slice(0, 80)}`);
  }
  if (!isObject(json)) throw protocolError("stream line is not an object");
  if (typeof json.error === "string") {
    throw new OllamaRequestError(classifyServerError(null, json.error, model));
  }
  return json;
}

/**
 * The events in one NDJSON line of a streamed /api/chat response. A line that
 * reports an error throws it as an {@link OllamaRequestError}.
 */
export function parseChatLine(line: string, model: string | null): ChatEvent[] {
  const json = parseStreamLine(line, model);
  const events: ChatEvent[] = [];
  const message = isObject(json.message) ? json.message : {};
  if (typeof message.thinking === "string" && message.thinking) {
    events.push({ type: "thinking", text: message.thinking });
  }
  if (typeof message.content === "string" && message.content) {
    events.push({ type: "content", text: message.content });
  }
  if (json.done === true) {
    events.push({
      type: "done",
      reason: typeof json.done_reason === "string" ? json.done_reason : "stop",
      promptTokens: num(json.prompt_eval_count),
      evalTokens: num(json.eval_count),
      loadMs: num(json.load_duration) / 1e6, // Ollama reports nanoseconds
    });
  }
  return events;
}

/**
 * One line of a streamed /api/pull response. Ollama answers a pull of a missing
 * model with HTTP 200 and then an error line, which throws here.
 */
export function parsePullLine(line: string, model: string | null): PullProgress {
  const json = parseStreamLine(line, model);
  if (typeof json.status !== "string") throw protocolError("pull line has no status");
  return {
    status: json.status,
    total: typeof json.total === "number" ? json.total : null,
    completed: typeof json.completed === "number" ? json.completed : null,
  };
}
