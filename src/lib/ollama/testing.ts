// Test helpers: recorded Ollama responses and a scriptable transport.

import { readFileSync } from "node:fs";
import type { OllamaPath, OllamaTransport } from "./transport";

/** A file from __fixtures__ (responses recorded from Ollama 0.40.13, trimmed). */
export function fixture(name: string): string {
  return readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf-8");
}

export function fixtureJson(name: string): unknown {
  return JSON.parse(fixture(name)) as unknown;
}

export function fixtureLines(name: string): string[] {
  return fixture(name).split("\n").filter(Boolean);
}

export interface Call {
  path: OllamaPath;
  body: object | undefined;
}

/** A transport answering from handlers, recording every call. */
export function scriptedTransport(handlers: {
  json?: (path: OllamaPath, body: object | undefined) => unknown;
  lines?: (path: OllamaPath, body: object, signal: AbortSignal) => AsyncIterable<string>;
}): OllamaTransport & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    async json(path, body) {
      calls.push({ path, body });
      if (!handlers.json) throw new Error(`unexpected json call to ${path}`);
      return handlers.json(path, body);
    },
    lines(path, body, signal) {
      calls.push({ path, body });
      if (!handlers.lines) throw new Error(`unexpected lines call to ${path}`);
      return handlers.lines(path, body, signal);
    },
  };
}

export async function* fromArray<T>(items: readonly T[]): AsyncGenerator<T, void, undefined> {
  for (const item of items) yield item;
}

/** A stream that never yields and rejects once `signal` aborts, like a hung server. */
export async function* hangUntilAborted(signal: AbortSignal): AsyncGenerator<string, void, undefined> {
  await new Promise<never>((_, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
  });
  yield ""; // unreachable; satisfies the generator type
}

/** Drains an async iterable into an array. */
export async function collect<T>(items: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of items) out.push(item);
  return out;
}

/** A scripted stand-in for Ollama's HTTP API, for UI tests that fake only the network. */
export interface FakeOllama {
  fetch: typeof fetch;
  /** Whether anything answers; when false, requests fail like a closed port. */
  up: boolean;
  /** Installed model names; a pull adds to it. */
  models: string[];
  /** Narrator turns requested so far: the last user message of each /api/chat. */
  turns: string[];
  /** Bodies of model-management chats (empty messages): warm-ups and unloads. */
  management: Array<{ model: string; keep_alive: unknown }>;
  /** Make the next narrator reply stall after its first chunk until released. */
  hold(): () => void;
  /** Narrator replies the client cancelled mid-stream. */
  cancelled: number;
  /** prompt_eval_count reported when a narrator reply ends; raise it to fill the budget. */
  promptTokens: number;
  /** History messages each narrator request carried (excluding system and the prompt). */
  histories: number[];
  /** Memory-extraction requests seen. */
  extractions: number;
}

const NARRATION_CHOICES =
  "[CHOICE: Look around | approach:perception]\n[CHOICE: Draw steel | approach:combat]\n[CHOICE: Call out | approach:chaos]";

function narratorReply(system: string, last: string, turn: number): string {
  if (system.includes("story analyst")) return JSON.stringify({ summary: "A traveller arrived.", currentLocation: "The Drain" });
  if (system.includes("Chronicler")) return "[WORLD_EVENT: Smoke rises over Orklin.]";
  // Every action prompt mentions rolls, so the trigger is a phrase only a test types.
  if (last.includes("roll for it")) {
    return `Narration ${turn}: the ground shifts beneath you.\n[ROLL_REQUIRED: keep your footing | approach:perception]`;
  }
  return `Narration ${turn}: the drain's wind settles around you.\n${NARRATION_CHOICES}`;
}

function ndjson(
  text: string,
  gate: Promise<void> | null,
  signal: AbortSignal | null | undefined,
  promptTokens: number
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const line = (o: object) => encoder.encode(JSON.stringify(o) + "\n");
  const half = Math.ceil(text.length / 2);
  return new ReadableStream({
    async start(controller) {
      controller.enqueue(line({ message: { role: "assistant", content: text.slice(0, half) }, done: false }));
      if (gate) {
        await Promise.race([gate, new Promise<void>((resolve) => signal?.addEventListener("abort", () => resolve()))]);
        if (signal?.aborted) return controller.error(new DOMException("aborted", "AbortError"));
      }
      controller.enqueue(line({ message: { role: "assistant", content: text.slice(half) }, done: false }));
      controller.enqueue(line({ done: true, done_reason: "stop", prompt_eval_count: promptTokens, eval_count: 40, load_duration: 0 }));
      controller.close();
    },
  });
}

export function createFakeOllama(models: string[] = ["gemma4:latest", "llama3.2:latest"]): FakeOllama {
  let gate: Promise<void> | null = null;
  const fake: FakeOllama = {
    up: true,
    models: [...models],
    turns: [],
    management: [],
    cancelled: 0,
    promptTokens: 120,
    histories: [],
    extractions: 0,
    hold() {
      let release = () => undefined as void;
      gate = new Promise<void>((resolve) => (release = resolve));
      return () => release();
    },
    async fetch(input, init) {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      if (!fake.up) throw new TypeError("Failed to fetch");
      if (init?.mode === "no-cors") return new Response(null, { status: 200 });
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
      switch (url.pathname) {
        case "/api/tags":
          return Response.json({ models: fake.models.map((name) => ({ name })) });
        case "/api/show":
          return Response.json({ capabilities: ["completion"], details: { family: "test" }, model_info: {} });
        case "/api/chat": {
          const messages = (body.messages ?? []) as Array<{ role: string; content: string }>;
          if (messages.length === 0) {
            fake.management.push({ model: String(body.model), keep_alive: body.keep_alive });
            const reason = body.keep_alive === 0 ? "unload" : "load";
            return new Response(JSON.stringify({ done: true, done_reason: reason }) + "\n");
          }
          const system = messages.find((m) => m.role === "system")?.content ?? "";
          const last = messages.at(-1)?.content ?? "";
          const narrator = !system.includes("story analyst") && !system.includes("Chronicler");
          if (narrator) {
            fake.turns.push(last);
            fake.histories.push(messages.length - 2);
          }
          if (system.includes("story analyst")) fake.extractions++;
          const held = narrator ? gate : null;
          if (narrator) gate = null;
          if (held) init?.signal?.addEventListener("abort", () => fake.cancelled++);
          return new Response(ndjson(narratorReply(system, last, fake.turns.length), held, init?.signal, fake.promptTokens));
        }
        case "/api/pull": {
          const lines = [
            { status: "pulling manifest" },
            { status: "pulling 6a0746a1ec1a", total: 2_000, completed: 1_000 },
            { status: "pulling 6a0746a1ec1a", total: 2_000, completed: 2_000 },
            { status: "success" },
          ];
          fake.models.push(`${String(body.model)}:latest`);
          return new Response(lines.map((l) => `${JSON.stringify(l)}\n`).join(""));
        }
        default:
          return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
      }
    },
  };
  return fake;
}
