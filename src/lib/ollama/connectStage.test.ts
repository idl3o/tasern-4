import { describe, expect, it } from "vitest";
import { deriveStage } from "./connectStage";

const base = { idle: false, checking: false, running: false, error: null };

describe("deriveStage", () => {
  it("starts with the gesture and shows checking while it runs", () => {
    expect(deriveStage({ ...base, idle: true })).toEqual({ stage: "start" });
    expect(deriveStage({ ...base, idle: true, checking: true })).toEqual({ stage: "checking" });
  });

  it("names the one step each failure calls for", () => {
    expect(deriveStage({ ...base, error: { kind: "unreachable" } })).toEqual({ stage: "install" });
    expect(deriveStage({ ...base, error: { kind: "origin-blocked", origin: "https://x" } })).toEqual({
      stage: "allow",
      origin: "https://x",
    });
    expect(deriveStage({ ...base, error: { kind: "loopback-denied", state: "prompt" } })).toEqual({
      stage: "browser",
      state: "prompt",
    });
    expect(deriveStage({ ...base, error: { kind: "server", status: 500, message: "boom" } }).stage).toBe("failed");
  });

  it("asks for a download once Ollama answers without a storyteller", () => {
    expect(deriveStage({ ...base, running: true })).toEqual({ stage: "download" });
  });
});
