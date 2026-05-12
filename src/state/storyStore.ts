"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

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

function emptyMemory(): StoryMemory {
  return {
    characterName: null,
    currentLocation: null,
    keyEvents: [],
    npcsEncountered: [],
    beliefs: [],
    beliefStrengths: {},
    faction: null,
    summary: "",
    inventory: [],
    spells: [],
  };
}

export interface StoryStore {
  stories: SavedStory[];
  activeStoryId: string | null;

  getActiveStory: () => SavedStory | null;
  createStory: () => string;
  loadStory: (id: string) => void;
  deleteStory: (id: string) => void;
  setActiveMessages: (messages: StoryMessage[]) => void;
  updateMemory: (memory: StoryMemory) => void;
  reinforceBeliefs: (beliefs: string[]) => void;
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

      getActiveStory: () => {
        const { stories, activeStoryId } = get();
        if (!activeStoryId) return null;
        return stories.find((s) => s.id === activeStoryId) || null;
      },

      createStory: () => {
        const id = crypto.randomUUID();
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
        set((state) => ({
          stories: state.stories.filter((s) => s.id !== id),
          activeStoryId: state.activeStoryId === id ? null : state.activeStoryId,
        }));
      },

      setActiveMessages: (messages) => {
        const { activeStoryId } = get();
        if (!activeStoryId) return;
        set((state) => ({
          stories: state.stories.map((s) =>
            s.id === activeStoryId
              ? { ...s, messages, updatedAt: Date.now() }
              : s
          ),
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
                    beliefStrengths: { ...(s.memory.beliefStrengths || {}), ...(memory.beliefStrengths || {}) },
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
      version: 2,
      partialize: (state) => ({
        stories: state.stories,
      }),
      migrate: (persistedState: unknown, version: number) => {
        if (!persistedState || typeof persistedState !== "object") return persistedState;
        const state = persistedState as { stories?: SavedStory[] };
        if (version < 2 && Array.isArray(state.stories)) {
          state.stories = state.stories.map((s) => ({
            ...s,
            memory: {
              ...s.memory,
              beliefStrengths: s.memory?.beliefStrengths || {},
            },
          }));
        }
        return state;
      },
    }
  )
);
