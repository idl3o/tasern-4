"use client";

import { useCallback, useEffect, useRef } from "react";
import { useWebLLMStore, DEFAULT_MODEL } from "@/state/webllmStore";

// World context for the AI (same as server-side)
const SYSTEM_PROMPT = `You are the narrator for Tales of Tasern, an interactive fiction experience set in a unique fantasy world.

## THE WORLD

Tasern exists at the edge of reality, where time moves slowly and existence itself thins toward Oblivion. It orbits twin suns:
- The Tear: A wound in reality where endless unmaking fire roars
- The Castle of Light: A sun-castle forged from belief where local gods dwell

Three moons watch over Tasern:
- White Moon: Frozen wasteland ruled by ice dragons. Pure hunger.
- Green Moon: Endless jungle where life grows without restraint.
- Blue Moon: Endless ocean where pirates sail seas that rise into sky.

## THE RULE OF BELIEF

In Tasern, BELIEF IS MAGIC. What enough minds hold true becomes true. Gods rise from prayers. Fear feeds monsters. Hope feeds miracles.

## NARRATIVE STYLE

- Write in second person ("You see...", "You feel...")
- Rich, evocative prose with sensory detail
- Let the world feel alive and reactive
- Actions have consequences; belief has weight
- Never break character or reference game mechanics
- Keep responses to 2-4 paragraphs`;

export function useWebLLM() {
  const {
    status,
    progress,
    progressText,
    error,
    engine,
    preferWebLLM,
    hasDeclinedWebLLM,
    setStatus,
    setProgress,
    setError,
    setEngine,
    setPreferWebLLM,
    setHasDeclined,
    reset,
  } = useWebLLMStore();

  const initializingRef = useRef(false);

  // Check WebGPU support
  const checkSupport = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined") return false;

    try {
      if (!("gpu" in navigator)) {
        console.log("[WebLLM] WebGPU not available in navigator");
        return false;
      }

      const gpu = (navigator as any).gpu;
      const adapter = await gpu.requestAdapter();

      if (!adapter) {
        console.log("[WebLLM] No WebGPU adapter found");
        return false;
      }

      console.log("[WebLLM] WebGPU supported");
      return true;
    } catch (e) {
      console.log("[WebLLM] WebGPU check failed:", e);
      return false;
    }
  }, []);

  // Initialize WebLLM engine
  const initialize = useCallback(async () => {
    if (initializingRef.current || engine || status === "ready") {
      return;
    }

    initializingRef.current = true;
    setStatus("checking");

    try {
      // Check WebGPU support
      const supported = await checkSupport();
      if (!supported) {
        setStatus("unsupported");
        initializingRef.current = false;
        return;
      }

      setStatus("downloading");
      setProgress(0, "Loading WebLLM...");

      // Dynamic import to avoid SSR issues
      const { CreateMLCEngine } = await import("@mlc-ai/web-llm");

      const newEngine = await CreateMLCEngine(DEFAULT_MODEL, {
        initProgressCallback: (report) => {
          const pct = Math.round(report.progress * 100);
          setProgress(pct, report.text);

          if (report.progress === 1) {
            setStatus("loading");
          }
        },
      });

      setEngine(newEngine);
      setStatus("ready");
      console.log("[WebLLM] Engine ready");
    } catch (e) {
      console.error("[WebLLM] Initialization failed:", e);
      setError(e instanceof Error ? e.message : "Failed to initialize WebLLM");
    } finally {
      initializingRef.current = false;
    }
  }, [engine, status, checkSupport, setStatus, setProgress, setError, setEngine]);

  // Generate text with streaming
  const generate = useCallback(
    async function* (prompt: string, history?: Array<{ role: string; content: string }>) {
      if (!engine || status !== "ready") {
        throw new Error("WebLLM not ready");
      }

      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system", content: SYSTEM_PROMPT },
      ];

      // Add history
      if (history) {
        for (const msg of history) {
          if (msg.role === "narrator") {
            messages.push({ role: "assistant", content: msg.content });
          } else if (msg.role === "player") {
            messages.push({ role: "user", content: msg.content });
          }
        }
      }

      // Add current prompt
      messages.push({ role: "user", content: prompt });

      try {
        const chunks = await engine.chat.completions.create({
          messages,
          temperature: 0.8,
          max_tokens: 1024,
          stream: true,
        });

        for await (const chunk of chunks) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            yield delta;
          }
        }
      } catch (e) {
        console.error("[WebLLM] Generation failed:", e);
        throw e;
      }
    },
    [engine, status]
  );

  // Non-streaming generate for simpler use cases
  const generateComplete = useCallback(
    async (prompt: string, history?: Array<{ role: string; content: string }>): Promise<string> => {
      let result = "";
      for await (const chunk of generate(prompt, history)) {
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
