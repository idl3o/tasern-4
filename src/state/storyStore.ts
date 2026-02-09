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
              ? { ...s, memory, updatedAt: Date.now() }
              : s
          ),
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
      partialize: (state) => ({
        stories: state.stories,
      }),
    }
  )
);
