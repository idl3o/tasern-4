"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { OllamaError } from "@/lib/ollama/errors";
import type { ModelDetails, ModelName } from "@/lib/ollama/types";

export type OllamaStatus = "checking" | "ready" | "unavailable";

export interface PullState {
  model: string;
  status: string;
  /** Share of the current layer downloaded, 0..1; null while Ollama gives no byte counts. */
  fraction: number | null;
}

export interface OllamaState {
  status: OllamaStatus;
  /** Chat-capable installed models, preferred first. */
  models: ModelDetails[];
  /** Why Ollama is unreachable; cleared by the next successful check. */
  error: OllamaError | null;
  /** The last request that failed while Ollama was up (warm, turn, pull); cleared by the next success. */
  lastFailure: OllamaError | null;
  /** The model loaded by this session's warm-up, and whether one is in flight. */
  warmed: ModelName | null;
  warming: boolean;
  /** True while the current turn is producing reasoning rather than story. */
  thinking: boolean;
  pull: PullState | null;
  /** The player's pick, persisted. Null means "use the best-ranked model". */
  chosenModel: string | null;
  setChosenModel: (name: string | null) => void;
}

// Runtime fields are written by the module-level monitor in useLocalOllama via
// setState; only the player's model choice is persisted.
export const useOllamaStore = create<OllamaState>()(
  persist(
    (set) => ({
      status: "checking",
      models: [],
      error: null,
      lastFailure: null,
      warmed: null,
      warming: false,
      thinking: false,
      pull: null,
      chosenModel: null,
      setChosenModel: (chosenModel) => set({ chosenModel }),
    }),
    {
      name: "tasern-ollama",
      version: 1,
      // Rehydrate manually after mount (matches the other stores) to avoid SSR mismatch.
      skipHydration: true,
      partialize: (state) => ({ chosenModel: state.chosenModel }),
    }
  )
);
