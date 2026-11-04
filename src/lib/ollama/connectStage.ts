// The web build's Ollama setup is a wizard, not a list: the player clicks Connect
// first and the app names the one step they are on, from what the attempt found.
// Mirrors the desktop OllamaSetup state machine, with the browser's own permission
// as the stage the desktop never has.

import type { OllamaError } from "./errors";

export type ConnectStage =
  | { stage: "start" }
  | { stage: "checking" }
  | { stage: "install" }
  | { stage: "allow"; origin: string }
  | { stage: "browser"; state: "denied" | "prompt" }
  | { stage: "download" }
  | { stage: "failed"; error: OllamaError };

export interface ConnectInputs {
  /** Nothing tried yet: the browser would ask first. */
  idle: boolean;
  checking: boolean;
  /** Ollama answered; the caller only renders the wizard when no model can chat. */
  running: boolean;
  error: OllamaError | null;
}

function assertNever(x: never): never {
  throw new Error(`Unhandled Ollama error: ${JSON.stringify(x)}`);
}

/** The single step the player is on. */
export function deriveStage(s: ConnectInputs): ConnectStage {
  if (s.checking) return { stage: "checking" };
  if (s.idle) return { stage: "start" };
  if (s.running) return { stage: "download" };
  if (!s.error) return { stage: "start" };
  switch (s.error.kind) {
    case "unreachable":
      return { stage: "install" };
    case "origin-blocked":
      return { stage: "allow", origin: s.error.origin };
    case "loopback-denied":
      return { stage: "browser", state: s.error.state };
    case "model-missing":
    case "out-of-memory":
    case "stalled":
    case "aborted":
    case "server":
    case "protocol":
      return { stage: "failed", error: s.error };
    default:
      return assertNever(s.error);
  }
}
