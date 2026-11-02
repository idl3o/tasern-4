// Desktop transport: requests go through the Rust proxy (src-tauri/src/ollama_proxy.rs).
// The packaged Windows app is served from http://tauri.localhost, an origin Ollama's
// default CORS policy refuses; Rust sends no Origin header, so it is never refused.

import { OllamaRequestError } from "./errors";
import { httpError, type OllamaPath, type OllamaTransport } from "./transport";

interface ProxyReply {
  status: number;
  body: string;
}

/** What the proxy sends over a stream's channel: lines, then exactly one end. */
type StreamMessage = { kind: "line"; line: string } | { kind: "end"; status: number; body: string };

function isStreamMessage(v: unknown): v is StreamMessage {
  if (typeof v !== "object" || v === null || !("kind" in v)) return false;
  if (v.kind === "line") return "line" in v && typeof v.line === "string";
  return v.kind === "end" && "status" in v && typeof v.status === "number" && "body" in v;
}

/** The proxy rejects with "unreachable: …", "aborted", or a plain message. */
function invokeError(e: unknown, signal: AbortSignal): OllamaRequestError {
  const message = typeof e === "string" ? e : e instanceof Error ? e.message : String(e);
  if (signal.aborted || message === "aborted") return new OllamaRequestError({ kind: "aborted" });
  if (message.startsWith("unreachable")) return new OllamaRequestError({ kind: "unreachable" });
  return new OllamaRequestError({ kind: "server", status: null, message });
}

let nextStreamId = 1;

async function* proxyLines(path: OllamaPath, body: object, signal: AbortSignal) {
  const { invoke, Channel } = await import("@tauri-apps/api/core");
  const id = nextStreamId++;
  const queue: StreamMessage[] = [];
  let wake: (() => void) | null = null;
  let failure: OllamaRequestError | null = null;

  const channel = new Channel<unknown>((msg) => {
    if (isStreamMessage(msg)) queue.push(msg);
    else failure = new OllamaRequestError({ kind: "protocol", message: "malformed proxy message" });
    wake?.();
  });
  const cancel = () => void invoke("ollama_cancel", { id });
  signal.addEventListener("abort", cancel, { once: true });
  let ended = false;
  invoke("ollama_stream", { id, path, body, onLine: channel }).catch((e: unknown) => {
    failure = invokeError(e, signal);
    wake?.();
  });

  try {
    for (;;) {
      const msg = queue.shift();
      if (msg?.kind === "line") yield msg.line;
      else if (msg?.kind === "end") {
        ended = true;
        if (msg.status >= 400) throw httpError(msg.status, msg.body, body);
        return;
      } else if (failure) throw failure;
      else await new Promise<void>((resolve) => (wake = resolve));
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    if (!ended) cancel(); // consumer stopped early: stop Ollama generating
  }
}

export function createTauriTransport(): OllamaTransport {
  return {
    async json(path, body, signal) {
      const { invoke } = await import("@tauri-apps/api/core");
      let reply: ProxyReply;
      try {
        reply = await invoke<ProxyReply>("ollama_request", { path, body: body ?? null });
      } catch (e) {
        throw invokeError(e, signal);
      }
      if (signal.aborted) throw new OllamaRequestError({ kind: "aborted" });
      if (reply.status >= 400) throw httpError(reply.status, reply.body, body);
      try {
        const data: unknown = JSON.parse(reply.body);
        return data;
      } catch {
        throw new OllamaRequestError({ kind: "protocol", message: `${path} returned invalid JSON` });
      }
    },
    lines: proxyLines,
  };
}
