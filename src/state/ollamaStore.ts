"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { OllamaError } from "@/lib/ollama/errors";
import type { ModelDetails } from "@/lib/ollama/types";

export type OllamaStatus = "checking" | "ready" | "unavailable";

export interface OllamaState {
  status: OllamaStatus;
  /** Chat-capable installed models, preferred first. */
  models: ModelDetails[];
  /** The last failure, cleared by the next successful check. */
  error: OllamaError | null;
  /** The player's pick, persisted. Null means "use the best-ranked model". */
  chosenModel: string | null;
  setChosenModel: (name: string | null) => void;
}

// Runtime fields are written by the health monitor in useLocalOllama via setState;
// only the player's model choice is persisted.
export const useOllamaStore = create<OllamaState>()(
  persist(
    (set) => ({
      status: "checking",
      models: [],
      error: null,
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
