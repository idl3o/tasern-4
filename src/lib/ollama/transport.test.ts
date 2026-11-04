import { describe, expect, it } from "vitest";
import { classifyServerError, describeOllamaError, OllamaRequestError, type OllamaError } from "./errors";
import { collect, fixture } from "./testing";
import { createHttpTransport } from "./transport";

async function failure(promise: Promise<unknown>): Promise<OllamaError> {
  try {
    await promise;
  } catch (e) {
    if (e instanceof OllamaRequestError) return e.error;
    throw e;
  }
  throw new Error("expected an OllamaRequestError");
}

/** A fetch whose CORS request fails like a browser's, with a no-cors probe outcome. */
function corsFailingFetch(probeSucceeds: boolean): typeof fetch {
  return async (_input, init) => {
    if (init?.mode === "no-cors" && probeSucceeds) return new Response(null, { status: 200 });
    throw new TypeError("Failed to fetch");
  };
}

const never = new AbortController().signal;

describe("createHttpTransport", () => {
  it("tells a refused origin apart from a closed port", async () => {
    const blocked = createHttpTransport("http://ollama.test", corsFailingFetch(true));
    const down = createHttpTransport("http://ollama.test", corsFailingFetch(false));
    expect((await failure(blocked.json("/api/tags", undefined, never))).kind).toBe("origin-blocked");
    expect(await failure(down.json("/api/tags", undefined, never))).toEqual({ kind: "unreachable" });
  });

  it("names the browser's own refusal before blaming Ollama", async () => {
    const down = corsFailingFetch(false);
    const denied = createHttpTransport("http://ollama.test", down, async () => "denied");
    const dismissed = createHttpTransport("http://ollama.test", down, async () => "prompt");
    const granted = createHttpTransport("http://ollama.test", down, async () => "granted");
    expect(await failure(denied.json("/api/tags", undefined, never))).toEqual({ kind: "loopback-denied", state: "denied" });
    expect(await failure(dismissed.json("/api/tags", undefined, never))).toEqual({ kind: "loopback-denied", state: "prompt" });
    expect(await failure(granted.json("/api/tags", undefined, never))).toEqual({ kind: "unreachable" });
  });

  it("declares the loopback target on every request, as Chrome requires", async () => {
    const inits: RequestInit[] = [];
    const transport = createHttpTransport("http://ollama.test", async (_input, init) => {
      inits.push(init ?? {});
      return Response.json({});
    });
    await transport.json("/api/tags", undefined, never);
    await transport.json("/api/show", { model: "m" }, never);
    expect(inits.map((i) => (i as { targetAddressSpace?: string }).targetAddressSpace)).toEqual(["loopback", "loopback"]);
  });

  it("keeps Ollama's message from an HTTP error body", async () => {
    const transport = createHttpTransport("http://ollama.test", async () =>
      new Response(fixture("error-model-missing.json"), { status: 404 })
    );
    expect(await failure(transport.json("/api/show", { model: "nope:1b" }, never))).toEqual({
      kind: "model-missing",
      model: "nope:1b",
    });
  });

  it("reports a request the caller cancelled as aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const transport = createHttpTransport("http://ollama.test", async () => {
      throw new DOMException("aborted", "AbortError");
    });
    expect(await failure(transport.json("/api/tags", undefined, controller.signal))).toEqual({ kind: "aborted" });
  });

  it("streams a response body as NDJSON lines", async () => {
    const transport = createHttpTransport("http://ollama.test", async () => new Response('{"a":1}\n{"b":2}\n'));
    expect(await collect(transport.lines("/api/chat", { model: "m" }, never))).toEqual(['{"a":1}', '{"b":2}']);
  });
});

describe("errors", () => {
  it("classifies Ollama's messages by what the player can do about them", () => {
    expect(classifyServerError(404, "model 'x' not found", "x")).toEqual({ kind: "model-missing", model: "x" });
    expect(classifyServerError(500, "model requires more system memory (9.6 GiB)", "x").kind).toBe("out-of-memory");
    expect(classifyServerError(500, "something else", "x").kind).toBe("server");
  });

  it("describes every kind in words a player can act on", () => {
    const blocked = describeOllamaError({ kind: "origin-blocked", origin: "https://tasern-4.vercel.app" });
    expect(blocked).toMatch(/allow this site/i);
    expect(blocked).toContain("https://tasern-4.vercel.app");
    expect(describeOllamaError({ kind: "loopback-denied", state: "denied" })).toMatch(/your browser is blocking/i);
    expect(describeOllamaError({ kind: "loopback-denied", state: "prompt" })).toMatch(/choose allow/i);
  });
});
