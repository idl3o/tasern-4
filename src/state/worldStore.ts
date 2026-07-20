"use client";

import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import { seedWorld } from "@/lib/world/seed";
import { advanceWorld } from "@/lib/world/sim";
import { WORLD_VERSION, type WorldState, type WorldEvent } from "@/lib/world/types";

// localStorage wrapper that never throws on quota — the world is a single small blob.
const guardedStorage: StateStorage = {
  getItem: (name) => (typeof window !== "undefined" ? window.localStorage.getItem(name) : null),
  setItem: (name, value) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(name, value);
    } catch (e) {
      console.error(`[worldStore] Failed to write ${name} to localStorage:`, e);
    }
  },
  removeItem: (name) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

export interface WorldStore {
  world: WorldState | null;
  _hasHydrated: boolean;

  setHasHydrated: (v: boolean) => void;
  ensureSeeded: () => void;
  resetWorld: () => void;
  // Advance the world one tick, folding in the player's current affinity totals.
  tick: (currentTotals: Record<string, number>) => void;
  // Append world-dreamer-generated canon events.
  applyDreamerEvents: (events: WorldEvent[]) => void;
}

export const useWorldStore = create<WorldStore>()(
  persist(
    (set, get) => ({
      world: null,
      _hasHydrated: false,

      setHasHydrated: (v) => set({ _hasHydrated: v }),

      // Create a fresh Tasern the first time (or after a wipe). Idempotent.
      ensureSeeded: () => {
        if (!get().world) set({ world: seedWorld(Date.now()) });
      },

      resetWorld: () => set({ world: seedWorld(Date.now()) }),

      tick: (currentTotals) => {
        const current = get().world ?? seedWorld(Date.now());
        const next = advanceWorld(current, currentTotals);
        set({ world: { ...next, updatedAt: Date.now() } });
      },

      applyDreamerEvents: (events) => {
        const current = get().world;
        if (!current || events.length === 0) return;
        set({
          world: {
            ...current,
            events: [...current.events, ...events].slice(-40),
            updatedAt: Date.now(),
          },
        });
      },
    }),
    {
      name: "tasern-world",
      version: WORLD_VERSION,
      // Rehydrate manually after mount (matches storyStore) to avoid SSR mismatch.
      skipHydration: true,
      storage: createJSONStorage(() => guardedStorage),
      partialize: (state) => ({ world: state.world }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        state?.ensureSeeded();
      },
    }
  )
);
