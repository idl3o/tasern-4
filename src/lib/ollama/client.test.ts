import { afterEach, describe, expect, it, vi } from "vitest";
import { createOllamaClient } from "./client";
import { OllamaRequestError, type OllamaError } from "./errors";
import { collect, fixtureJson, fixtureLines, fromArray, hangUntilAborted, scriptedTransport } from "./testing";
import type { ChatRequest, ModelName } from "./types";

const request: ChatRequest = {
  model: "llama3.2:latest" as ModelName,
  messages: [{ role: "user", content: "hello" }],
  numCtx: 8192,
  keepAlive: "30m",
};

async function failure(promise: Promise<unknown>): Promise<OllamaError> {
  try {
    await promise;
  } catch (e) {
    if (e instanceof OllamaRequestError) return e.error;
    throw e;
  }
  throw new Error("expected an OllamaRequestError");
}

afterEach(() => {
  vi.useRealTimers();
});

describe("chat", () => {
  it("sends keep_alive, num_ctx and streaming, and omits think unless asked", async () => {
    const transport = scriptedTransport({ lines: () => fromArray(fixtureLines("chat-llama3.2.ndjson")) });
    const client = createOllamaClient(transport);
    await collect(client.chat(request));
    await collect(client.chat({ ...request, think: false }));
    expect(transport.calls[0]?.body).toEqual({
      model: "llama3.2:latest",
      messages: request.messages,
      stream: true,
      keep_alive: "30m",
      options: { num_ctx: 8192 },
    });
    expect(transport.calls[1]?.body).toMatchObject({ think: false });
  });

  it("streams the recorded reply as content and ends with done", async () => {
    const client = createOllamaClient(scriptedTransport({ lines: () => fromArray(fixtureLines("chat-llama3.2.ndjson")) }));
    const events = await collect(client.chat(request));
    const text = events.flatMap((e) => (e.type === "content" ? [e.text] : [])).join("");
    expect(text.length).toBeGreaterThan(0);
    expect(events.at(-1)?.type).toBe("done");
  });

  it("delivers content before a mid-stream error, then throws it typed", async () => {
    const lines = ['{"message":{"content":"You wake"}}', '{"error":"model runner has unexpectedly stopped"}'];
    const client = createOllamaClient(scriptedTransport({ lines: () => fromArray(lines) }));
    const seen: string[] = [];
    const error = await failure(
      (async () => {
        for await (const e of client.chat(request)) if (e.type === "content") seen.push(e.text);
      })()
    );
    expect(seen).toEqual(["You wake"]);
    expect(error).toEqual({ kind: "server", status: null, message: "model runner has unexpectedly stopped" });
  });

  it("reports a stream that goes quiet as stalled", async () => {
    vi.useFakeTimers();
    const client = createOllamaClient(
      scriptedTransport({ lines: (_path, _body, signal) => hangUntilAborted(signal) }),
      { idleTimeoutMs: 1000 }
    );
    const result = failure(collect(client.chat(request)));
    await vi.advanceTimersByTimeAsync(1001);
    expect(await result).toEqual({ kind: "stalled", afterMs: 1000 });
  });

  it("reports the caller cancelling as aborted, not stalled", async () => {
    const controller = new AbortController();
    const client = createOllamaClient(scriptedTransport({ lines: (_p, _b, signal) => hangUntilAborted(signal) }));
    const result = failure(collect(client.chat(request, controller.signal)));
    controller.abort();
    expect(await result).toEqual({ kind: "aborted" });
  });
});

describe("listModels", () => {
  const show: Record<string, string> = {
    "llama3.2:latest": "show-llama3.2.json",
    "gemma4:e4b-it-qat": "show-gemma4-e4b.json",
  };

  it("pairs every listed model with its capabilities, and caches them", async () => {
    const transport = scriptedTransport({
      json: (path, body) => {
        if (path === "/api/tags") return { models: [{ name: "llama3.2:latest" }, { name: "gemma4:e4b-it-qat" }] };
        const model = body && "model" in body ? String(body.model) : "";
        return fixtureJson(show[model] ?? "missing");
      },
    });
    const client = createOllamaClient(transport);
    const first = await client.listModels();
    await client.listModels();
    expect(first.map((m) => [m.name, m.capabilities?.has("thinking")])).toEqual([
      ["llama3.2:latest", false],
      ["gemma4:e4b-it-qat", true],
    ]);
    expect(transport.calls.filter((c) => c.path === "/api/show")).toHaveLength(2);
  });

  it("offers a model Ollama can't describe with unknown capabilities", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const client = createOllamaClient(
      scriptedTransport({
        json: (path) => {
          if (path === "/api/tags") return { models: [{ name: "broken:1b" }] };
          throw new OllamaRequestError({ kind: "server", status: 500, message: "corrupt manifest" });
        },
      })
    );
    expect((await client.listModels())[0]?.capabilities).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("still fails outright when Ollama itself is unreachable", async () => {
    const client = createOllamaClient(
      scriptedTransport({
        json: (path) => {
          if (path === "/api/tags") return { models: [{ name: "llama3.2:latest" }] };
          throw new OllamaRequestError({ kind: "unreachable" });
        },
      })
    );
    expect(await failure(client.listModels())).toEqual({ kind: "unreachable" });
  });
});

describe("warm", () => {
  it("loads the model with an empty message list, the chat's num_ctx and keep_alive", async () => {
    const transport = scriptedTransport({
      lines: () => fromArray(['{"message":{"role":"assistant","content":""},"done":true,"done_reason":"load"}']),
    });
    await createOllamaClient(transport).warm("gemma4:latest" as ModelName, 8192, "30m");
    expect(transport.calls[0]).toEqual({
      path: "/api/chat",
      body: { model: "gemma4:latest", messages: [], keep_alive: "30m", options: { num_ctx: 8192 } },
    });
  });

  it("throws when the model can't be loaded", async () => {
    const client = createOllamaClient(
      scriptedTransport({ lines: () => fromArray(['{"error":"model requires more system memory (19 GiB)"}']) })
    );
    expect((await failure(client.warm("big:70b" as ModelName, 8192, "30m"))).kind).toBe("out-of-memory");
  });
});

describe("unload", () => {
  it("asks Ollama to drop the model now", async () => {
    const transport = scriptedTransport({ lines: () => fromArray(['{"done":true,"done_reason":"unload"}']) });
    await createOllamaClient(transport).unload("gemma4:latest" as ModelName);
    expect(transport.calls[0]?.body).toEqual({ model: "gemma4:latest", messages: [], keep_alive: 0 });
  });
});

describe("pull", () => {
  it("yields each progress line, with byte counts where Ollama gives them", async () => {
    const client = createOllamaClient(scriptedTransport({ lines: () => fromArray(fixtureLines("pull-existing.ndjson")) }));
    const progress = await collect(client.pull("llama3.2"));
    expect(progress[0]).toEqual({ status: "pulling manifest", total: null, completed: null });
    expect(progress.some((p) => p.total !== null && p.completed === p.total)).toBe(true);
    expect(progress.at(-1)?.status).toBe("success");
  });

  it("treats Ollama's HTTP 200 plus error line for an unknown name as model-missing", async () => {
    const lines = ['{"status":"pulling manifest"}', '{"error":"pull model manifest: file does not exist"}'];
    const client = createOllamaClient(scriptedTransport({ lines: () => fromArray(lines) }));
    expect(await failure(collect(client.pull("nope-not-real:1b")))).toEqual({
      kind: "model-missing",
      model: "nope-not-real:1b",
    });
  });

  it("forgets cached capabilities for a re-pulled model, matching :latest", async () => {
    let shows = 0;
    const transport = scriptedTransport({
      json: (path) => {
        if (path === "/api/tags") return { models: [{ name: "llama3.2:latest" }] };
        shows++;
        return fixtureJson("show-llama3.2.json");
      },
      lines: () => fromArray(['{"status":"success"}']),
    });
    const client = createOllamaClient(transport);
    await client.listModels();
    await collect(client.pull("llama3.2"));
    await client.listModels();
    expect(shows).toBe(2);
  });
});
