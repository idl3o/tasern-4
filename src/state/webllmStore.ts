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

export interface WebLLMState {
  status: WebLLMStatus;
  progress: number;
  progressText: string;
  error: string | null;
  modelId: string;
  engine: any | null;

  // Preferences
  preferWebLLM: boolean;
  hasDeclinedWebLLM: boolean;
  hasDownloadedOnce: boolean;

  // Actions
  setStatus: (status: WebLLMStatus) => void;
  setProgress: (progress: number, text?: string) => void;
  setError: (error: string | null) => void;
  setEngine: (engine: any) => void;
  setPreferWebLLM: (prefer: boolean) => void;
  setHasDeclined: (declined: boolean) => void;
  setHasDownloadedOnce: (downloaded: boolean) => void;
  reset: () => void;
}

// Recommended model for story generation
export const DEFAULT_MODEL = "Llama-3.2-3B-Instruct-q4f16_1-MLC";

// Alternative smaller models
export const AVAILABLE_MODELS = [
  { id: "Llama-3.2-3B-Instruct-q4f16_1-MLC", name: "Llama 3.2 3B", size: "~2GB", recommended: true },
  { id: "Llama-3.2-1B-Instruct-q4f16_1-MLC", name: "Llama 3.2 1B", size: "~1GB", recommended: false },
  { id: "Phi-3.5-mini-instruct-q4f16_1-MLC", name: "Phi 3.5 Mini", size: "~2GB", recommended: false },
];

export const useWebLLMStore = create<WebLLMState>()(
  persist(
    (set) => ({
      status: "idle",
      progress: 0,
      progressText: "",
      error: null,
      modelId: DEFAULT_MODEL,
      engine: null,
      preferWebLLM: true,
      hasDeclinedWebLLM: false,
      hasDownloadedOnce: false,

      setStatus: (status) => set({ status }),
      setProgress: (progress, text) => set({ progress, progressText: text || "" }),
      setError: (error) => set({ error, status: error ? "error" : "idle" }),
      setEngine: (engine) => set({ engine, status: engine ? "ready" : "idle" }),
      setPreferWebLLM: (prefer) => set({ preferWebLLM: prefer }),
      setHasDeclined: (declined) => set({ hasDeclinedWebLLM: declined }),
      setHasDownloadedOnce: (downloaded) => set({ hasDownloadedOnce: downloaded }),
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
      partialize: (state) => ({
        preferWebLLM: state.preferWebLLM,
        hasDeclinedWebLLM: state.hasDeclinedWebLLM,
        hasDownloadedOnce: state.hasDownloadedOnce,
        modelId: state.modelId,
      }),
    }
  )
);
