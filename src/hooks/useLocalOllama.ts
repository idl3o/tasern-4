"use client";

import { useCallback, useEffect, useMemo } from "react";
import { isTauri } from "@/hooks/useTauri";
import { createOllamaClient, type OllamaClient } from "@/lib/ollama/client";
import { OllamaRequestError, type OllamaError } from "@/lib/ollama/errors";
import { rankModels, selectModel } from "@/lib/ollama/models";
import { createHttpTransport } from "@/lib/ollama/transport";
import { createTauriTransport } from "@/lib/ollama/transportTauri";
import type { ChatMessage } from "@/lib/ollama/types";
import { useOllamaStore } from "@/state/ollamaStore";

const NUM_CTX = 8192;
// Long enough that a player reading between turns doesn't pay a cold reload
// (9-28s measured for gemma4/gpt-oss on an RX 7800 XT); Ollama's default is 5m.
const KEEP_ALIVE = "30m";
const POLL_READY_MS = 30_000;
const POLL_UNAVAILABLE_MS = 15_000;

export interface GenStats {
  promptTokens: number;
  evalTokens: number;
}

// One client and one health monitor per page, however many components use the hook.
let client: OllamaClient | null = null;
let users = 0;
let pollTimer: ReturnType<typeof setTimeout> | undefined;
let refreshing: Promise<void> | null = null;

function getClient(): OllamaClient {
  client ??= createOllamaClient(isTauri() ? createTauriTransport() : createHttpTransport());
  return client;
}

function toOllamaError(e: unknown): OllamaError {
  if (e instanceof OllamaRequestError) return e.error;
  return { kind: "protocol", message: e instanceof Error ? e.message : String(e) };
}

/** Re-reads Ollama's models now, then keeps polling while any component is mounted. */
function refresh(): Promise<void> {
  refreshing ??= (async () => {
    clearTimeout(pollTimer);
    try {
      const models = rankModels(await getClient().listModels());
      useOllamaStore.setState({ status: "ready", models, error: null });
    } catch (e) {
      useOllamaStore.setState({ status: "unavailable", models: [], error: toOllamaError(e) });
    } finally {
      refreshing = null;
      if (users > 0) {
        const ready = useOllamaStore.getState().status === "ready";
        pollTimer = setTimeout(() => void refresh(), ready ? POLL_READY_MS : POLL_UNAVAILABLE_MS);
      }
    }
  })();
  return refreshing;
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

export function useLocalOllama() {
  const { status, models, error, chosenModel, setChosenModel } = useOllamaStore();

  useEffect(() => {
    users++;
    if (users === 1) void refresh();
    return () => {
      users--;
      if (users === 0) clearTimeout(pollTimer);
    };
  }, []);

  const selected = useMemo(() => selectModel(models, chosenModel), [models, chosenModel]);

  // Streams narrator text. Thinking is dropped from the story but still resets the
  // stall timer; `onStats` receives Ollama's real token counts when the turn ends.
  const generate = useCallback(
    async function* (
      prompt: string,
      systemPrompt: string,
      history?: ReadonlyArray<{ role: string; content: string }>,
      onStats?: (stats: GenStats) => void
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
      try {
        for await (const event of getClient().chat(request)) {
          if (event.type === "content") yield event.text;
          else if (event.type === "done") onStats?.({ promptTokens: event.promptTokens, evalTokens: event.evalTokens });
        }
      } catch (e) {
        const failure = toOllamaError(e);
        useOllamaStore.setState({ error: failure });
        // Ollama went away or its models changed: re-read now rather than at the next poll.
        if (failure.kind === "unreachable" || failure.kind === "origin-blocked" || failure.kind === "model-missing") {
          void refresh();
        }
        throw e;
      }
    },
    [selected]
  );

  return {
    available: status === "ready" && selected !== null,
    isChecking: status === "checking",
    isRunning: status === "ready",
    models: models.map((m) => m.name),
    selectedModel: selected?.name ?? null,
    error,
    chooseModel: setChosenModel,
    generate,
  };
}
