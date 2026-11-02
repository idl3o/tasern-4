// Every way an Ollama request fails, as a value. The UI and the story engine match
// on `kind` instead of reading HTTP codes or exception text.

export type OllamaError =
  | { kind: "unreachable" }
  | { kind: "origin-blocked"; origin: string }
  | { kind: "model-missing"; model: string }
  | { kind: "out-of-memory"; message: string }
  | { kind: "stalled"; afterMs: number }
  | { kind: "aborted" }
  | { kind: "server"; status: number | null; message: string }
  | { kind: "protocol"; message: string };

/** Typed throw carrying an {@link OllamaError}; catch sites read `.error`. */
export class OllamaRequestError extends Error {
  constructor(readonly error: OllamaError) {
    super(describeOllamaError(error));
    this.name = "OllamaRequestError";
  }
}

function assertNever(x: never): never {
  throw new Error(`Unhandled Ollama error: ${JSON.stringify(x)}`);
}

/** A one-line explanation a player can act on. */
export function describeOllamaError(e: OllamaError): string {
  switch (e.kind) {
    case "unreachable":
      return "Ollama isn't running on this machine.";
    case "origin-blocked":
      return `Ollama is running but refuses requests from ${e.origin}. Add it to OLLAMA_ORIGINS and restart Ollama.`;
    case "model-missing":
      return `Ollama doesn't have the model "${e.model}". Pull it or choose another.`;
    case "out-of-memory":
      return `The model doesn't fit in memory; try a smaller one. (${e.message})`;
    case "stalled":
      return `Ollama stopped responding for ${Math.round(e.afterMs / 1000)}s.`;
    case "aborted":
      return "The request was cancelled.";
    case "server":
      return `Ollama returned an error${e.status ? ` (${e.status})` : ""}: ${e.message}`;
    case "protocol":
      return `Unexpected response from Ollama: ${e.message}`;
    default:
      return assertNever(e);
  }
}

/** Classifies an error Ollama reported, from an HTTP error body or a stream line. */
export function classifyServerError(
  status: number | null,
  message: string,
  model: string | null
): OllamaError {
  if (/model .*not found/i.test(message)) {
    return { kind: "model-missing", model: model ?? message };
  }
  if (/out of memory|more system memory|insufficient memory|unable to allocate/i.test(message)) {
    return { kind: "out-of-memory", message };
  }
  return { kind: "server", status, message };
}
