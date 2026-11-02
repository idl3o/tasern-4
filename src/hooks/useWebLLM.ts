"use client";

import { useCallback, useEffect } from "react";
import { useWebLLMStore, selectModel, type WebLLMModel } from "@/state/webllmStore";
import {
  WEBLLM_CONTEXT_TOKENS,
  MAX_REPLY_TOKENS,
  PROMPT_TOKEN_BUDGET,
  fitHistory,
} from "@/lib/contextBudget";

// lib.dom in this TypeScript version has no WebGPU declarations; this is the slice used.
interface GPULike {
  requestAdapter(): Promise<{ features: ReadonlySet<string> } | null>;
}

// Module scope rather than per hook instance: several components mount useWebLLM,
// and the engine must be created, and the cache resumed, exactly once.
let initInFlight: Promise<void> | null = null;
let resumeChecked = false;

async function detectModel(): Promise<WebLLMModel | null> {
  if (typeof navigator === "undefined" || !("gpu" in navigator)) return null;
  // Present per the `in` check above; only the declaration is missing from lib.dom.
  const gpu = (navigator as Navigator & { gpu: GPULike }).gpu;
  try {
    const adapter = await gpu.requestAdapter();
    return adapter ? selectModel(adapter.features) : null;
  } catch (e) {
    console.warn("[WebLLM] WebGPU adapter request failed:", e);
    return null;
  }
}

function isContextOverflow(e: unknown): boolean {
  return e instanceof Error && e.name === "ContextWindowSizeExceededError";
}

export function useWebLLM() {
  const {
    status,
    progress,
    progressText,
    error,
    model,
    engine,
    preferWebLLM,
    hasDeclinedWebLLM,
    setStatus,
    setProgress,
    setError,
    setModel,
    setEngine,
    setPreferWebLLM,
    setHasDeclined,
    reset,
  } = useWebLLMStore();

  // Resolve which build this GPU can run; marks the store unsupported if none.
  const checkSupport = useCallback(async (): Promise<WebLLMModel | null> => {
    const detected = await detectModel();
    setModel(detected);
    if (!detected) setStatus("unsupported");
    return detected;
  }, [setModel, setStatus]);

  // Initialize WebLLM engine
  const initialize = useCallback(async (): Promise<void> => {
    const current = useWebLLMStore.getState();
    if (current.engine || current.status === "ready") return;
    if (initInFlight) return initInFlight;

    initInFlight = (async () => {
      setStatus("checking");
      const target = current.model ?? (await checkSupport());
      if (!target) return;

      setStatus("downloading");
      setProgress(0, "Loading WebLLM...");
      try {
        // Dynamic import to avoid SSR issues
        const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
        const newEngine = await CreateMLCEngine(
          target.id,
          {
            initProgressCallback: (report) => {
              setProgress(Math.round(report.progress * 100), report.text);
              if (report.progress >= 1) setStatus("loading");
            },
          },
          // The prebuilt default (4096) cannot hold the system prompt plus history.
          { context_window_size: WEBLLM_CONTEXT_TOKENS }
        );
        setEngine(newEngine);
        console.log(`[WebLLM] ${target.id} ready`);
      } catch (e) {
        console.error("[WebLLM] Initialization failed:", e);
        setError(e instanceof Error ? e.message : "Failed to initialize WebLLM");
      }
    })().finally(() => {
      initInFlight = null;
    });
    return initInFlight;
  }, [checkSupport, setStatus, setProgress, setError, setEngine]);

  // Resume without a click when this device's build is already in the browser cache.
  // A different cached model (e.g. a former default) is not resumed, so changing the
  // default never starts a multi-gigabyte download the player didn't ask for.
  useEffect(() => {
    if (resumeChecked) return;
    resumeChecked = true;
    void (async () => {
      const target = await checkSupport();
      if (!target) return;
      const { hasModelInCache } = await import("@mlc-ai/web-llm");
      if (await hasModelInCache(target.id)) await initialize();
    })().catch((e: unknown) => console.warn("[WebLLM] Cache check failed:", e));
  }, [checkSupport, initialize]);

  // Generate text with streaming
  const generate = useCallback(
    async function* (
      prompt: string,
      systemPrompt: string,
      history?: ReadonlyArray<{ role: string; content: string }>
    ) {
      if (!engine || status !== "ready") {
        throw new Error("WebLLM not ready");
      }

      const turns = (history ?? []).flatMap<{ role: "user" | "assistant"; content: string }>((msg) =>
        msg.role === "narrator"
          ? [{ role: "assistant", content: msg.content }]
          : msg.role === "player"
            ? [{ role: "user", content: msg.content }]
            : []
      );

      // web-llm rejects an over-long prompt instead of truncating it, so fit the
      // history to the window; if the chars/4 estimate still undershot, retry once
      // keeping the newer half.
      let fitted = fitHistory(turns, [systemPrompt, prompt], PROMPT_TOKEN_BUDGET);
      for (let attempt = 0; ; attempt++) {
        let yielded = false;
        try {
          const chunks = await engine.chat.completions.create({
            messages: [
              { role: "system", content: systemPrompt },
              ...fitted,
              { role: "user", content: prompt },
            ],
            temperature: 0.8,
            max_tokens: MAX_REPLY_TOKENS,
            stream: true,
          });

          for await (const chunk of chunks) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) {
              yielded = true;
              yield delta;
            }
          }
          return;
        } catch (e) {
          if (!yielded && attempt === 0 && fitted.length > 0 && isContextOverflow(e)) {
            const keep = Math.floor(fitted.length / 2);
            console.warn(`[WebLLM] Prompt exceeded the context window; retrying with ${keep} of ${fitted.length} history turns`);
            fitted = fitted.slice(fitted.length - keep);
            continue;
          }
          console.error("[WebLLM] Generation failed:", e);
          throw e;
        }
      }
    },
    [engine, status]
  );

  // Non-streaming generate for simpler use cases
  const generateComplete = useCallback(
    async (
      prompt: string,
      systemPrompt: string,
      history?: ReadonlyArray<{ role: string; content: string }>
    ): Promise<string> => {
      let result = "";
      for await (const chunk of generate(prompt, systemPrompt, history)) {
        result += chunk;
      }
      return result;
    },
    [generate]
  );

  return {
    // State
    status,
    progress,
    progressText,
    error,
    model,
    isReady: status === "ready",
    isSupported: status !== "unsupported",
    isLoading: status === "downloading" || status === "loading",
    preferWebLLM,
    hasDeclinedWebLLM,

    // Actions
    initialize,
    generate,
    generateComplete,
    checkSupport,
    setPreferWebLLM,
    declineWebLLM: () => setHasDeclined(true),
    reset,
  };
}
