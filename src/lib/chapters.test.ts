import { describe, expect, it } from "vitest";
import { currentChapter, estimateTokens, historySinceLastChapter } from "./chapters";
import type { StoryMessage } from "@/state/storyStore";

const msg = (role: StoryMessage["role"], content: string, extra: Partial<StoryMessage> = {}): StoryMessage => ({
  id: content,
  role,
  content,
  timestamp: 0,
  ...extra,
});
const divider = (n: number) => msg("system", `Chapter ${n}`, { divider: n });

describe("chapters", () => {
  it("treats a story without dividers as chapter 1, all in view", () => {
    const story = [msg("narrator", "arrival"), msg("player", "look"), msg("narrator", "reply")];
    expect(currentChapter(story)).toBe(1);
    expect(historySinceLastChapter(story)).toEqual(story);
  });

  it("scopes history to after the last divider and counts chapters by dividers", () => {
    const story = [msg("narrator", "a"), divider(2), msg("narrator", "b"), msg("player", "c"), divider(3), msg("narrator", "d")];
    expect(currentChapter(story)).toBe(3);
    expect(historySinceLastChapter(story).map((m) => m.content)).toEqual(["d"]);
  });

  it("does not mistake other system messages, such as dice results, for dividers", () => {
    const story = [msg("narrator", "a"), msg("system", "d20: 14", { diceRoll: 14 }), msg("narrator", "b")];
    expect(currentChapter(story)).toBe(1);
    expect(historySinceLastChapter(story)).toHaveLength(3);
  });

  it("starts a fresh window right after a divider", () => {
    expect(historySinceLastChapter([msg("narrator", "a"), divider(2)])).toEqual([]);
  });

  it("estimates tokens as characters over four, rounded up", () => {
    expect(estimateTokens("abcd", "ef")).toBe(2);
    expect(estimateTokens("")).toBe(0);
  });
});
