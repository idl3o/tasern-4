// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { useStoryStore } from "./storyStore";

const initial = useStoryStore.getState();

/** Writes a persisted store index as an older or newer version left it, then rehydrates. */
async function rehydrateFrom(stories: unknown[], extra: Record<string, unknown> = {}) {
  localStorage.setItem("tasern-stories", JSON.stringify({ state: { stories, ...extra }, version: 3 }));
  await useStoryStore.persist.rehydrate();
  return useStoryStore.getState();
}

const story = (openTurn: unknown) => ({
  id: "s1",
  title: "Wren's Tale",
  messages: [],
  memory: {},
  createdAt: 1,
  updatedAt: 1,
  messageCountAtLastExtraction: 0,
  openTurn,
});

beforeEach(() => {
  useStoryStore.setState(initial, true);
  localStorage.clear();
});

describe("story persistence", () => {
  it("restores a saved open turn, normalising approaches", async () => {
    const state = await rehydrateFrom([
      story({ moves: [{ text: "Look around", approach: "perception" }], roll: null }),
    ]);
    expect(state.stories[0]?.openTurn).toEqual({ moves: [{ text: "Look around", approach: "Perception" }], roll: null });
  });

  it("drops malformed open-turn data instead of trusting it", async () => {
    const state = await rehydrateFrom([
      story({ moves: [{ text: 42 }, "nonsense", { text: "Run", approach: "teleport" }], roll: { reason: 7 } }),
      { ...story("not an object"), id: "s2" },
    ]);
    expect(state.stories[0]?.openTurn).toEqual({ moves: [{ text: "Run", approach: null }], roll: null });
    expect(state.stories[1]?.openTurn).toBeUndefined();
  });

  it("ignores an activeStoryId saved by older versions", async () => {
    const state = await rehydrateFrom([story(undefined)], { activeStoryId: "s1" });
    expect(state.stories).toHaveLength(1);
    expect(state.activeStoryId).toBeNull();
  });
});
