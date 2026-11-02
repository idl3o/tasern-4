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
