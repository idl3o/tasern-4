// How requests reach Ollama. The browser build talks HTTP directly (subject to CORS);
// the desktop build goes through the Rust proxy, which sends no Origin header and so
// is never refused. Both raise OllamaRequestError and hand back untyped JSON or raw
// NDJSON lines; parsing stays in parse.ts, timing in client.ts.

import { classifyServerError, OllamaRequestError } from "./errors";
import { pageIsLoopback, queryLoopbackPermission, type LoopbackPermission } from "./loopbackPermission";
import { ndjsonLines, readerChunks } from "./ndjson";
import { parseErrorBody } from "./parse";

export type OllamaPath = "/api/version" | "/api/tags" | "/api/show" | "/api/chat" | "/api/pull";

export interface OllamaTransport {
  /** GET (no body) or POST a JSON endpoint; resolves the decoded body. */
  json(path: OllamaPath, body: object | undefined, signal: AbortSignal): Promise<unknown>;
  /** POST and yield the streamed NDJSON response line by line. */
  lines(path: OllamaPath, body: object, signal: AbortSignal): AsyncIterable<string>;
}

export const OLLAMA_URL = "http://localhost:11434";

/** The model a request body names, for error messages. */
export function modelOf(body: object | undefined): string | null {
  return body && "model" in body && typeof body.model === "string" ? body.model : null;
}

/** An HTTP error status plus Ollama's error body, as a typed throw. */
export function httpError(status: number, bodyText: string, body: object | undefined) {
  return new OllamaRequestError(classifyServerError(status, parseErrorBody(bodyText), modelOf(body)));
}

// Chrome needs the loopback target declared on an http:// request from an https:// page.
const LOOPBACK_INIT = { targetAddressSpace: "loopback" } as const;

/**
 * A CORS refusal, a closed port and a browser permission refusal all surface as the
 * same TypeError. The permission state and an opaque no-cors probe (which succeeds
 * whenever the server is up) tell them apart.
 */
async function diagnoseNetworkFailure(
  base: string,
  fetchImpl: typeof fetch,
  permission: () => Promise<LoopbackPermission>
) {
  if ((await permission()) === "denied") return new OllamaRequestError({ kind: "loopback-denied", state: "denied" });
  try {
    await fetchImpl(`${base}/api/version`, { ...LOOPBACK_INIT, mode: "no-cors", signal: AbortSignal.timeout(2000) });
    const origin = typeof location === "undefined" ? "this page" : location.origin;
    return new OllamaRequestError({ kind: "origin-blocked", origin });
  } catch {
    // Still unanswered after a public page's attempt: the player dismissed the browser's
    // question, and nothing can reach Ollama until it is answered. Otherwise nothing is listening.
    if ((await permission()) === "prompt" && !pageIsLoopback()) {
      return new OllamaRequestError({ kind: "loopback-denied", state: "prompt" });
    }
    return new OllamaRequestError({ kind: "unreachable" });
  }
}

/** Direct browser-to-Ollama transport. `fetchImpl` and `permission` are injectable for tests. */
export function createHttpTransport(
  base: string = OLLAMA_URL,
  fetchImpl: typeof fetch = (...args) => fetch(...args),
  permission: () => Promise<LoopbackPermission> = queryLoopbackPermission
): OllamaTransport {
  async function send(path: OllamaPath, body: object | undefined, signal: AbortSignal) {
    let res: Response;
    try {
      res = await fetchImpl(
        `${base}${path}`,
        body === undefined
          ? { ...LOOPBACK_INIT, signal }
          : { ...LOOPBACK_INIT, method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal }
      );
    } catch (e) {
      if (signal.aborted) throw new OllamaRequestError({ kind: "aborted" });
      throw await diagnoseNetworkFailure(base, fetchImpl, permission);
    }
    if (!res.ok) throw httpError(res.status, await res.text(), body);
    return res;
  }

  return {
    async json(path, body, signal) {
      const res = await send(path, body, signal);
      try {
        const data: unknown = await res.json();
        return data;
      } catch {
        if (signal.aborted) throw new OllamaRequestError({ kind: "aborted" });
        throw new OllamaRequestError({ kind: "protocol", message: `${path} returned invalid JSON` });
      }
    },
    async *lines(path, body, signal) {
      const res = await send(path, body, signal);
      if (!res.body) throw new OllamaRequestError({ kind: "protocol", message: `${path} has no body` });
      yield* ndjsonLines(readerChunks(res.body));
    },
  };
}
