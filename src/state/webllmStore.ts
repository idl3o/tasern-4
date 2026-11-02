"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type WebLLMStatus =
  | "idle"
  | "checking"
  | "downloading"
  | "loading"
  | "ready"
  | "error"
  | "unsupported";

export interface WebLLMModel {
  id: string;
  name: string;
  downloadSize: string;
}

// Gemma 4 E2B in two builds of the same weights: f16 needs the GPU's shader-f16
// feature; the f32 build runs without it, at a higher VRAM cost.
export const WEBLLM_MODELS = {
  f16: { id: "gemma-4-E2B-it-q4f16_1-MLC", name: "Gemma 4 E2B", downloadSize: "~2.8 GB" },
  f32: { id: "gemma-4-E2B-it-q4f32_1-MLC", name: "Gemma 4 E2B", downloadSize: "~2.8 GB" },
} as const satisfies Record<string, WebLLMModel>;

/** Picks the build this GPU can run, from its WebGPU adapter's feature set. */
export function selectModel(features: ReadonlySet<string>): WebLLMModel {
  return features.has("shader-f16") ? WEBLLM_MODELS.f16 : WEBLLM_MODELS.f32;
}

export interface WebLLMState {
  status: WebLLMStatus;
  progress: number;
  progressText: string;
  error: string | null;
  // Resolved per device by the WebGPU check; null until then.
  model: WebLLMModel | null;
  engine: any | null;

  // Preferences
  preferWebLLM: boolean;
  hasDeclinedWebLLM: boolean;

  // Actions
  setStatus: (status: WebLLMStatus) => void;
  setProgress: (progress: number, text?: string) => void;
  setError: (error: string | null) => void;
  setModel: (model: WebLLMModel | null) => void;
  setEngine: (engine: any) => void;
  setPreferWebLLM: (prefer: boolean) => void;
  setHasDeclined: (declined: boolean) => void;
  reset: () => void;
}

type PersistedPrefs = Pick<WebLLMState, "preferWebLLM" | "hasDeclinedWebLLM">;

export const useWebLLMStore = create<WebLLMState>()(
  persist(
    (set) => ({
      status: "idle",
      progress: 0,
      progressText: "",
      error: null,
      model: null,
      engine: null,
      preferWebLLM: true,
      hasDeclinedWebLLM: false,

      setStatus: (status) => set({ status }),
      setProgress: (progress, text) => set({ progress, progressText: text || "" }),
      setError: (error) => set({ error, status: error ? "error" : "idle" }),
      setModel: (model) => set({ model }),
      setEngine: (engine) => set({ engine, status: engine ? "ready" : "idle" }),
      setPreferWebLLM: (prefer) => set({ preferWebLLM: prefer }),
      setHasDeclined: (declined) => set({ hasDeclinedWebLLM: declined }),
      reset: () => set({
        status: "idle",
        progress: 0,
        progressText: "",
        error: null,
        engine: null,
      }),
    }),
    {
      name: "tasern-webllm",
      version: 2,
      // Rehydrate manually after mount (matches storyStore) to avoid SSR mismatch.
      skipHydration: true,
      partialize: (state): PersistedPrefs => ({
        preferWebLLM: state.preferWebLLM,
        hasDeclinedWebLLM: state.hasDeclinedWebLLM,
      }),
      // v1 also persisted hasDownloadedOnce and modelId. The model is now resolved per
      // device and resumed from the browser's model cache, so only preferences carry over.
      migrate: (persisted): PersistedPrefs => {
        const p: Record<string, unknown> =
          typeof persisted === "object" && persisted !== null ? { ...persisted } : {};
        return {
          preferWebLLM: typeof p.preferWebLLM === "boolean" ? p.preferWebLLM : true,
          hasDeclinedWebLLM: p.hasDeclinedWebLLM === true,
        };
      },
    }
  )
);
