"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safeUUID } from "@/lib/id";

// Per-story message arrays are stored under their own localStorage key so the
// main index stays small and only the active story's transcript is re-serialized
// on each save (avoids write amplification + quota blowups from one giant blob).
const MSG_KEY = (id: string) => `tasern-story-msgs-${id}`;

function hasLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

// Wraps setItem so a QuotaExceededError never throws uncaught; returns success.
function safeSetItem(key: string, value: string): boolean {
  if (!hasLocalStorage()) return true;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.error(`[storyStore] Failed to write ${key} to localStorage:`, e);
    return false;
  }
}

function writeMessages(id: string, messages: StoryMessage[]): boolean {
  return safeSetItem(MSG_KEY(id), JSON.stringify(messages));
}

function readMessages(id: string): StoryMessage[] {
  if (!hasLocalStorage()) return [];
  try {
    const raw = window.localStorage.getItem(MSG_KEY(id));
    return raw ? (JSON.parse(raw) as StoryMessage[]) : [];
  } catch {
    return [];
  }
}

function deleteMessages(id: string): void {
  if (!hasLocalStorage()) return;
  try {
    window.localStorage.removeItem(MSG_KEY(id));
  } catch {
    /* ignore */
  }
}

export interface StoryMessage {
  id: string;
  role: "narrator" | "player" | "system";
  content: string;
  timestamp: number;
  diceRoll?: number;
}

export interface InventoryItem {
  name: string;
  description: string;
}

export interface StoryMemory {
  characterName: string | null;
  currentLocation: string | null;
  keyEvents: string[];
  npcsEncountered: string[];
  beliefs: string[];
  beliefStrengths: Record<string, number>;
  // Strength the player holds each of the four approaches (Combat/Perception/
  // Nature/Chaos), reinforced by acting in them. Drives the d20 modifier.
  affinityStrengths: Record<string, number>;
  faction: string | null;
  summary: string;
  inventory: InventoryItem[];
  spells: InventoryItem[];
}

export interface SavedStory {
  id: string;
  title: string;
  messages: StoryMessage[];
  memory: StoryMemory;
  createdAt: number;
  updatedAt: number;
  messageCountAtLastExtraction: number;
}

// Keep only the strongest N beliefs so the map can't grow without bound.
function capBeliefStrengths(strengths: Record<string, number>, max = 20): Record<string, number> {
  const entries = Object.entries(strengths);
  if (entries.length <= max) return strengths;
  return Object.fromEntries(entries.sort(([, a], [, b]) => b - a).slice(0, max));
}

function emptyMemory(): StoryMemory {
  return {
    characterName: null,
    currentLocation: null,
    keyEvents: [],
    npcsEncountered: [],
    beliefs: [],
    beliefStrengths: {},
    affinityStrengths: {},
    faction: null,
    summary: "",
    inventory: [],
    spells: [],
  };
}

export interface StoryStore {
  stories: SavedStory[];
  activeStoryId: string | null;
  storageError: boolean;
  _hasHydrated: boolean;

  setHasHydrated: (v: boolean) => void;
  clearStorageError: () => void;
  getActiveStory: () => SavedStory | null;
  createStory: () => string;
  loadStory: (id: string) => void;
  deleteStory: (id: string) => void;
  setActiveMessages: (messages: StoryMessage[]) => void;
  updateMemory: (memory: StoryMemory) => void;
  reinforceBeliefs: (beliefs: string[]) => void;
  reinforceAffinity: (affinity: string, amount?: number) => void;
  updateTitle: (title: string) => void;
  setMessageCountAtLastExtraction: (count: number) => void;
  clearActiveStory: () => void;
  addItem: (name: string, description: string) => void;
  removeItem: (name: string) => void;
  addSpell: (name: string, description: string) => void;
  removeSpell: (name: string) => void;
}

export const useStoryStore = create<StoryStore>()(
  persist(
    (set, get) => ({
      stories: [],
      activeStoryId: null,
      storageError: false,
      _hasHydrated: false,

      setHasHydrated: (v) => set({ _hasHydrated: v }),
      clearStorageError: () => set({ storageError: false }),

      getActiveStory: () => {
        const { stories, activeStoryId } = get();
        if (!activeStoryId) return null;
        return stories.find((s) => s.id === activeStoryId) || null;
      },

      createStory: () => {
        const id = safeUUID();
        const now = Date.now();
        const title = `Story - ${new Date(now).toLocaleDateString()}`;
        const story: SavedStory = {
          id,
          title,
          messages: [],
          memory: emptyMemory(),
          createdAt: now,
          updatedAt: now,
          messageCountAtLastExtraction: 0,
        };
        set((state) => ({
          stories: [story, ...state.stories],
          activeStoryId: id,
        }));
        return id;
      },

      loadStory: (id) => {
        set({ activeStoryId: id });
      },

      deleteStory: (id) => {
        deleteMessages(id);
        set((state) => ({
          stories: state.stories.filter((s) => s.id !== id),
          activeStoryId: state.activeStoryId === id ? null : state.activeStoryId,
        }));
      },

      setActiveMessages: (messages) => {
        const { activeStoryId } = get();
        if (!activeStoryId) return;
        const ok = writeMessages(activeStoryId, messages);
        set((state) => ({
          stories: state.stories.map((s) =>
            s.id === activeStoryId
              ? { ...s, messages, updatedAt: Date.now() }
              : s
          ),
          storageError: ok ? state.storageError : true,
        }));
      },

      updateMemory: (memory) => {
        const { activeStoryId } = get();
        if (!activeStoryId) return;
        set((state) => ({
          stories: state.stories.map((s) =>
            s.id === activeStoryId
              ? {
                  ...s,
                  memory: {
                    ...memory,
                    beliefStrengths: capBeliefStrengths({
                      ...(s.memory.beliefStrengths || {}),
                      ...(memory.beliefStrengths || {}),
                    }),
                    // Affinity strengths are managed by reinforceAffinity, never by
                    // extraction — always keep the existing values.
                    affinityStrengths: {
                      ...(s.memory.affinityStrengths || {}),
                      ...(memory.affinityStrengths || {}),
                    },
                  },
                  updatedAt: Date.now(),
                }
              : s
          ),
        }));
      },

      reinforceBeliefs: (beliefs) => {
        const { activeStoryId } = get();
        if (!activeStoryId || beliefs.length === 0) return;
        set((state) => ({
          stories: state.stories.map((s) => {
            if (s.id !== activeStoryId) return s;
            const next = { ...(s.memory.beliefStrengths || {}) };
            for (const belief of beliefs) {
              const key = belief.trim();
              if (!key) continue;
              next[key] = (next[key] || 0) + 1;
            }
            return { ...s, memory: { ...s.memory, beliefStrengths: next } };
          }),
        }));
      },

      reinforceAffinity: (affinity, amount = 1) => {
        const { activeStoryId } = get();
        const key = affinity.trim();
        if (!activeStoryId || !key) return;
        set((state) => ({
          stories: state.stories.map((s) => {
            if (s.id !== activeStoryId) return s;
            const next = { ...(s.memory.affinityStrengths || {}) };
            next[key] = (next[key] || 0) + amount;
            return { ...s, memory: { ...s.memory, affinityStrengths: next } };
          }),
        }));
      },

      updateTitle: (title) => {
        const { activeStoryId } = get();
        if (!activeStoryId) return;
        set((state) => ({
          stories: state.stories.map((s) =>
            s.id === activeStoryId ? { ...s, title } : s
          ),
        }));
      },

      setMessageCountAtLastExtraction: (count) => {
        const { activeStoryId } = get();
        if (!activeStoryId) return;
        set((state) => ({
          stories: state.stories.map((s) =>
            s.id === activeStoryId
              ? { ...s, messageCountAtLastExtraction: count }
              : s
          ),
        }));
      },

      clearActiveStory: () => {
        set({ activeStoryId: null });
      },

      addItem: (name, description) => {
        const { activeStoryId } = get();
        if (!activeStoryId) return;
        set((state) => ({
          stories: state.stories.map((s) =>
            s.id === activeStoryId
              ? {
                  ...s,
                  memory: {
                    ...s.memory,
                    inventory: s.memory.inventory.some((i) => i.name === name)
                      ? s.memory.inventory
                      : [...s.memory.inventory, { name, description }],
                  },
                }
              : s
          ),
        }));
      },

      removeItem: (name) => {
        const { activeStoryId } = get();
        if (!activeStoryId) return;
        set((state) => ({
          stories: state.stories.map((s) =>
            s.id === activeStoryId
              ? {
                  ...s,
                  memory: {
                    ...s.memory,
                    inventory: s.memory.inventory.filter((i) => i.name !== name),
                  },
                }
              : s
          ),
        }));
      },

      addSpell: (name, description) => {
        const { activeStoryId } = get();
        if (!activeStoryId) return;
        set((state) => ({
          stories: state.stories.map((s) =>
            s.id === activeStoryId
              ? {
                  ...s,
                  memory: {
                    ...s.memory,
                    spells: s.memory.spells.some((sp) => sp.name === name)
                      ? s.memory.spells
                      : [...s.memory.spells, { name, description }],
                  },
                }
              : s
          ),
        }));
      },

      removeSpell: (name) => {
        const { activeStoryId } = get();
        if (!activeStoryId) return;
        set((state) => ({
          stories: state.stories.map((s) =>
            s.id === activeStoryId
              ? {
                  ...s,
                  memory: {
                    ...s.memory,
                    spells: s.memory.spells.filter((sp) => sp.name !== name),
                  },
                }
              : s
          ),
        }));
      },
    }),
    {
      name: "tasern-stories",
      version: 3,
      // Rehydrate manually in an effect (see useHydrateStories) so the first client
      // render matches the server-prerendered (empty) HTML — avoids hydration mismatch.
      skipHydration: true,
      // Index only: messages live under their own per-story keys, so we persist
      // the story records with an empty messages array (reattached on merge).
      partialize: (state) => ({
        stories: state.stories.map((s) => ({ ...s, messages: [] as StoryMessage[] })),
        activeStoryId: state.activeStoryId,
      }),
      migrate: (persistedState: unknown, version: number) => {
        if (!persistedState || typeof persistedState !== "object") return persistedState;
        const state = persistedState as { stories?: SavedStory[]; activeStoryId?: string | null };
        if (Array.isArray(state.stories)) {
          state.stories = state.stories.map((s) => {
            const memory = { ...emptyMemory(), ...(s.memory || {}) };
            // v2 (and earlier) stored messages inline; lift them into per-story keys.
            if (version < 3 && Array.isArray(s.messages)) {
              writeMessages(s.id, s.messages);
            }
            return { ...s, memory };
          });
        }
        return state;
      },
      // Reattach each story's messages from its per-story key, normalize memory,
      // and validate the persisted activeStoryId still exists.
      merge: (persisted, current) => {
        const p = (persisted || {}) as { stories?: SavedStory[]; activeStoryId?: string | null };
        const stories: SavedStory[] = Array.isArray(p.stories)
          ? p.stories.map((s) => ({
              ...s,
              memory: { ...emptyMemory(), ...(s.memory || {}) },
              messages: readMessages(s.id),
            }))
          : [];
        const activeStoryId =
          p.activeStoryId && stories.some((s) => s.id === p.activeStoryId) ? p.activeStoryId : null;
        return { ...current, stories, activeStoryId };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
