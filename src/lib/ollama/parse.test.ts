import { describe, expect, it } from "vitest";
import { OllamaRequestError } from "./errors";
import { parseChatLine, parseErrorBody, parseShow, parseTags } from "./parse";
import { fixture, fixtureJson, fixtureLines } from "./testing";
import type { ChatEvent, ModelName } from "./types";

const name = (s: string) => s as ModelName;

function errorOf(fn: () => unknown) {
  try {
    fn();
  } catch (e) {
    if (e instanceof OllamaRequestError) return e.error;
    throw e;
  }
  throw new Error("expected an OllamaRequestError");
}

describe("parseTags", () => {
  it("reads model names as Ollama lists them", () => {
    expect(parseTags(fixtureJson("tags.json"))).toEqual([
      "gpt-oss:20b",
      "gemma4:latest",
      "gemma4:e4b-it-qat",
      "gemma4:26b-a4b-it-qat",
      "llama3.2:latest",
    ]);
  });

  it("rejects a body without a models array as a protocol error", () => {
    expect(errorOf(() => parseTags({ nope: [] })).kind).toBe("protocol");
  });
});

describe("parseShow", () => {
  it("reads capabilities, family and context length", () => {
    const gemma = parseShow(name("gemma4:e4b-it-qat"), fixtureJson("show-gemma4-e4b.json"));
    expect(gemma.capabilities?.has("thinking")).toBe(true);
    expect(gemma.capabilities?.has("completion")).toBe(true);
    expect(gemma.family).toBe("gemma4");
    expect(gemma.contextLength).toBe(131072);

    const llama = parseShow(name("llama3.2:latest"), fixtureJson("show-llama3.2.json"));
    expect(llama.capabilities?.has("thinking")).toBe(false);
    expect(llama.parameterSize).toBe("3.2B");
  });

  it("reports capabilities as unknown when an older Ollama omits them", () => {
    expect(parseShow(name("old:1b"), { details: {} }).capabilities).toBeNull();
  });
});

describe("parseChatLine", () => {
  const events = (file: string): ChatEvent[] =>
    fixtureLines(file).flatMap((line) => parseChatLine(line, "m"));

  it("turns a plain stream into content then done with token counts", () => {
    const all = events("chat-llama3.2.ndjson");
    const done = all.at(-1);
    expect(all.slice(0, -1).every((e) => e.type === "content")).toBe(true);
    expect(done).toMatchObject({ type: "done", reason: "length" });
    expect(done?.type === "done" && done.promptTokens).toBeGreaterThan(0);
  });

  it("separates thinking from content, so reasoning never reaches the story", () => {
    const all = events("chat-gemma4-thinking.ndjson");
    expect(all.filter((e) => e.type === "thinking").length).toBeGreaterThan(100);
    expect(all.some((e) => e.type === "content")).toBe(false);
    expect(all.at(-1)).toMatchObject({ type: "done", reason: "length" });
  });

  it("converts load_duration from nanoseconds to milliseconds", () => {
    const [done] = parseChatLine('{"done":true,"done_reason":"stop","load_duration":9957297700}', "m");
    expect(done).toMatchObject({ type: "done", loadMs: 9957.2977 });
  });

  it("throws an error line as a typed error", () => {
    expect(errorOf(() => parseChatLine('{"error":"model requires more system memory (12 GiB)"}', "m")).kind).toBe(
      "out-of-memory"
    );
  });

  it("throws an unparseable line as a protocol error instead of skipping it", () => {
    expect(errorOf(() => parseChatLine("{not json", "m")).kind).toBe("protocol");
  });
});

describe("parseErrorBody", () => {
  it("extracts Ollama's message, or falls back to the raw text", () => {
    expect(parseErrorBody(fixture("error-model-missing.json"))).toBe("model 'nope:1b' not found");
    expect(parseErrorBody("<html>Bad Gateway</html>")).toBe("<html>Bad Gateway</html>");
  });
});
