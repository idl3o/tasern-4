import { OllamaRequestError } from "./errors";
import { sameModel } from "./models";
import { parseChatLine, parsePullLine, parseShow, parseTags } from "./parse";
import type { OllamaPath, OllamaTransport } from "./transport";
import type { ChatEvent, ChatRequest, ModelDetails, ModelName, PullProgress } from "./types";

export interface OllamaClientOptions {
  /** Abort a stream after this long without a line. Cold-loading a large model counts. */
  idleTimeoutMs?: number;
  /** Deadline for one non-streaming request. */
  requestTimeoutMs?: number;
  /** Idle limit for a pull; verifying a multi-gigabyte layer is silent for a while. */
  pullIdleTimeoutMs?: number;
}

export interface OllamaClient {
  /** Installed models with their capabilities (cached per name after the first lookup). */
  listModels(signal?: AbortSignal): Promise<ModelDetails[]>;
  /** Streams one chat turn as content, thinking and done events. */
  chat(request: ChatRequest, signal?: AbortSignal): AsyncGenerator<ChatEvent, void, undefined>;
  /**
   * Loads a model into memory without generating, so the first turn skips the load.
   * `numCtx` must match the chat requests': a different context size reloads the model.
   */
  warm(model: ModelName, numCtx: number, keepAlive: string, signal?: AbortSignal): Promise<void>;
  /** Downloads a model, yielding progress; throws if Ollama reports a failure. */
  pull(model: string, signal?: AbortSignal): AsyncGenerator<PullProgress, void, undefined>;
}

/**
 * An AbortSignal that fires after `ms` without a kick(), or when `outer` aborts.
 * Lets callers tell a stall (`stalled`) from a cancellation.
 */
function watchdog(ms: number, outer: AbortSignal | undefined) {
  const controller = new AbortController();
  let stalled = false;
  const fire = () => {
    stalled = true;
    controller.abort();
  };
  let timer = setTimeout(fire, ms);
  const onOuter = () => controller.abort();
  if (outer?.aborted) controller.abort();
  outer?.addEventListener("abort", onOuter, { once: true });
  return {
    signal: controller.signal,
    get stalled() {
      return stalled;
    },
    kick() {
      clearTimeout(timer);
      timer = setTimeout(fire, ms);
    },
    /** Stops the timer and aborts anything still in flight. */
    dispose() {
      clearTimeout(timer);
      outer?.removeEventListener("abort", onOuter);
      controller.abort();
    },
  };
}

type Watchdog = ReturnType<typeof watchdog>;

/** Rewrites an abort into the error that explains it: a stall, or the caller cancelling. */
function explain(e: unknown, dog: Watchdog, ms: number, outer: AbortSignal | undefined): unknown {
  if (dog.stalled) return new OllamaRequestError({ kind: "stalled", afterMs: ms });
  if (outer?.aborted) return new OllamaRequestError({ kind: "aborted" });
  return e;
}

function chatBody(request: ChatRequest): object {
  return {
    model: request.model,
    messages: request.messages,
    stream: true,
    keep_alive: request.keepAlive,
    options: { num_ctx: request.numCtx },
    ...(request.think === undefined ? {} : { think: request.think }),
  };
}

export function createOllamaClient(
  transport: OllamaTransport,
  { idleTimeoutMs = 120_000, requestTimeoutMs = 5_000, pullIdleTimeoutMs = 300_000 }: OllamaClientOptions = {}
): OllamaClient {
  const detailsCache = new Map<ModelName, ModelDetails>();

  /** A streamed endpoint's lines, aborted as "stalled" after `idleMs` without one. */
  async function* streamLines(path: OllamaPath, body: object, idleMs: number, outer?: AbortSignal) {
    const dog = watchdog(idleMs, outer);
    try {
      for await (const line of transport.lines(path, body, dog.signal)) {
        dog.kick();
        yield line;
      }
    } catch (e) {
      throw explain(e, dog, idleMs, outer);
    } finally {
      dog.dispose();
    }
  }

  async function request(path: "/api/tags" | "/api/show", body: object | undefined, outer?: AbortSignal) {
    const dog = watchdog(requestTimeoutMs, outer);
    try {
      return await transport.json(path, body, dog.signal);
    } catch (e) {
      throw explain(e, dog, requestTimeoutMs, outer);
    } finally {
      dog.dispose();
    }
  }

  async function details(name: ModelName, signal?: AbortSignal): Promise<ModelDetails> {
    const cached = detailsCache.get(name);
    if (cached) return cached;
    try {
      const parsed = parseShow(name, await request("/api/show", { model: name }, signal));
      detailsCache.set(name, parsed);
      return parsed;
    } catch (e) {
      // Ollama answered but couldn't describe this one model: offer it with unknown
      // capabilities rather than hide the rest. Losing Ollama itself still throws.
      const answered = e instanceof OllamaRequestError && (e.error.kind === "server" || e.error.kind === "protocol");
      if (!answered) throw e;
      console.warn(`[Ollama] /api/show failed for ${name}:`, e.message);
      return { name, family: null, parameterSize: null, capabilities: null, contextLength: null };
    }
  }

  return {
    async listModels(signal) {
      const names = parseTags(await request("/api/tags", undefined, signal));
      return Promise.all(names.map((name) => details(name, signal)));
    },

    async *chat(chatRequest, signal) {
      for await (const line of streamLines("/api/chat", chatBody(chatRequest), idleTimeoutMs, signal)) {
        yield* parseChatLine(line, chatRequest.model);
      }
    },

    async warm(model, numCtx, keepAlive, signal) {
      // An empty message list loads the model and returns done_reason "load".
      const body = { model, messages: [], keep_alive: keepAlive, options: { num_ctx: numCtx } };
      for await (const line of streamLines("/api/chat", body, idleTimeoutMs, signal)) {
        parseChatLine(line, model);
      }
    },

    async *pull(model, signal) {
      for await (const line of streamLines("/api/pull", { model, stream: true }, pullIdleTimeoutMs, signal)) {
        yield parsePullLine(line, model);
      }
      // A re-pulled model may have new capabilities; "llama3.2" is cached as "llama3.2:latest".
      for (const name of Array.from(detailsCache.keys())) {
        if (sameModel(name, model)) detailsCache.delete(name);
      }
    },
  };
}
