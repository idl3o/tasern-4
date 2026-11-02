"use client";

import { useCallback, useEffect, useMemo } from "react";
import { createOllamaClient, type OllamaClient } from "@/lib/ollama/client";
import { OllamaRequestError, type OllamaError } from "@/lib/ollama/errors";
import { rankModels, selectModel } from "@/lib/ollama/models";
import { createHttpTransport } from "@/lib/ollama/transport";
import { createTauriTransport } from "@/lib/ollama/transportTauri";
import { isTauri } from "@/lib/platform";
import { CONTEXT_TOKENS } from "@/lib/chapters";
import type { ChatMessage, ModelName } from "@/lib/ollama/types";
import { useOllamaStore } from "@/state/ollamaStore";

// The chapter budget is measured against this window (see lib/chapters.ts).
const NUM_CTX = CONTEXT_TOKENS;
// Long enough that a player reading between turns doesn't pay a cold reload
// (9-28s measured for gemma4/gpt-oss on an RX 7800 XT); Ollama's default is 5m.
const KEEP_ALIVE = "30m";
const POLL_READY_MS = 30_000;
const POLL_UNAVAILABLE_MS = 15_000;

export interface GenStats {
  promptTokens: number;
  evalTokens: number;
}

// One client, one health monitor and one warm-up per page, however many
// components use the hook.
let client: OllamaClient | null = null;
let users = 0;
let pollTimer: ReturnType<typeof setTimeout> | undefined;
let refreshing: Promise<void> | null = null;
let warmingFor: ModelName | null = null;

function getClient(): OllamaClient {
  client ??= createOllamaClient(isTauri() ? createTauriTransport() : createHttpTransport());
  return client;
}

function toOllamaError(e: unknown): OllamaError {
  if (e instanceof OllamaRequestError) return e.error;
  return { kind: "protocol", message: e instanceof Error ? e.message : String(e) };
}

/** Re-reads Ollama's models now, then keeps polling while any component is mounted. */
export function recheckOllama(): Promise<void> {
  refreshing ??= (async () => {
    clearTimeout(pollTimer);
    try {
      const models = rankModels(await getClient().listModels());
      useOllamaStore.setState({ status: "ready", models, error: null });
    } catch (e) {
      useOllamaStore.setState({ status: "unavailable", models: [], error: toOllamaError(e), warmed: null });
    } finally {
      refreshing = null;
      if (users > 0) {
        const ready = useOllamaStore.getState().status === "ready";
        pollTimer = setTimeout(() => void recheckOllama(), ready ? POLL_READY_MS : POLL_UNAVAILABLE_MS);
      }
    }
  })();
  return refreshing;
}

/** Loads `model` ahead of the first turn and releases the model it replaces. */
function warm(model: ModelName): void {
  const { warmed } = useOllamaStore.getState();
  if (warmingFor === model || warmed === model) return;
  warmingFor = model;
  useOllamaStore.setState({ warming: true });
  void (async () => {
    try {
      if (warmed) {
        // Best effort: if it fails, keep_alive frees the old model anyway.
        await getClient().unload(warmed).catch((e: unknown) => console.warn("[Ollama] unload failed:", e));
      }
      await getClient().warm(model, NUM_CTX, KEEP_ALIVE);
      if (warmingFor === model) useOllamaStore.setState({ warmed: model, lastFailure: null });
      else await getClient().unload(model); // the player picked another meanwhile
    } catch (e) {
      if (warmingFor === model) useOllamaStore.setState({ lastFailure: toOllamaError(e) });
    } finally {
      if (warmingFor === model) {
        warmingFor = null;
        useOllamaStore.setState({ warming: false });
      }
    }
  })();
}

/** Downloads a model with progress in the store, then re-reads the model list. */
async function pullModel(model: string): Promise<void> {
  useOllamaStore.setState({ pull: { model, status: "starting", fraction: null }, lastFailure: null });
  try {
    for await (const p of getClient().pull(model)) {
      const fraction = p.total ? (p.completed ?? 0) / p.total : null;
      useOllamaStore.setState({ pull: { model, status: p.status, fraction } });
    }
    await recheckOllama();
  } catch (e) {
    useOllamaStore.setState({ lastFailure: toOllamaError(e) });
  } finally {
    useOllamaStore.setState({ pull: null });
  }
}

function toChatMessages(
  systemPrompt: string,
  history: ReadonlyArray<{ role: string; content: string }>,
  prompt: string
): ChatMessage[] {
  return [
    { role: "system", content: systemPrompt },
    ...history.flatMap<ChatMessage>((m) =>
      m.role === "narrator"
        ? [{ role: "assistant", content: m.content }]
        : m.role === "player"
          ? [{ role: "user", content: m.content }]
          : []
    ),
    { role: "user", content: prompt },
  ];
}

function recordFailure(e: unknown): void {
  const failure = toOllamaError(e);
  useOllamaStore.setState({ lastFailure: failure });
  // Ollama went away or its models changed: re-read now rather than at the next poll.
  if (failure.kind === "unreachable" || failure.kind === "origin-blocked" || failure.kind === "model-missing") {
    void recheckOllama();
  }
}

export function useLocalOllama() {
  const store = useOllamaStore();
  const { status, models, chosenModel } = store;

  useEffect(() => {
    users++;
    if (users === 1) void recheckOllama();
    return () => {
      users--;
      if (users === 0) clearTimeout(pollTimer);
    };
  }, []);

  const selected = useMemo(() => selectModel(models, chosenModel), [models, chosenModel]);
  const selectedName = selected?.name ?? null;

  useEffect(() => {
    if (status === "ready" && selectedName) warm(selectedName);
  }, [status, selectedName]);

  // Streams narrator text. Thinking is kept out of the story, but flags the store so
  // the UI can show the narrator considering; `onStats` gets Ollama's token counts.
  const generate = useCallback(
    async function* (
      prompt: string,
      systemPrompt: string,
      history?: ReadonlyArray<{ role: string; content: string }>,
      onStats?: (stats: GenStats) => void,
      signal?: AbortSignal
    ): AsyncGenerator<string, void, undefined> {
      if (!selected) throw new OllamaRequestError({ kind: "unreachable" });
      const request = {
        model: selected.name,
        messages: toChatMessages(systemPrompt, history ?? [], prompt),
        numCtx: NUM_CTX,
        keepAlive: KEEP_ALIVE,
        // Narration doesn't need visible reasoning, and it costs the player seconds.
        think: selected.capabilities?.has("thinking") ? false : undefined,
      };
      let storyStarted = false;
      try {
        for await (const event of getClient().chat(request, signal)) {
          if (event.type === "content") {
            if (!storyStarted) useOllamaStore.setState({ thinking: false });
            storyStarted = true;
            yield event.text;
          } else if (event.type === "thinking") {
            if (!storyStarted && !useOllamaStore.getState().thinking) useOllamaStore.setState({ thinking: true });
          } else {
            onStats?.({ promptTokens: event.promptTokens, evalTokens: event.evalTokens });
          }
        }
        useOllamaStore.setState({ lastFailure: null, warmed: selected.name });
      } catch (e) {
        // Cancelling (the player left the story) is not a failure to report.
        if (!signal?.aborted) recordFailure(e);
        throw e;
      } finally {
        useOllamaStore.setState({ thinking: false });
      }
    },
    [selected]
  );

  return {
    available: status === "ready" && selected !== null,
    isChecking: status === "checking",
    isRunning: status === "ready",
    models: models.map((m) => m.name),
    selectedModel: selectedName,
    error: store.error,
    lastFailure: store.lastFailure,
    warming: store.warming,
    thinking: store.thinking,
    pull: store.pull,
    chooseModel: store.setChosenModel,
    pullModel,
    recheck: recheckOllama,
    generate,
  };
}
