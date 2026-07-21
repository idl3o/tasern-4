import type { StoryMessage } from "@/state/storyStore";

// Context-budget driven chaptering: a story plays against a bounded LLM window, so
// rather than let it silently degrade we steer toward a chapter close, summarize,
// and continue in a fresh window. Constants named for playtest tuning.
export const CONTEXT_TOKENS = 8192; // must track num_ctx in useLocalOllama
export const WIND_DOWN_RATIO = 0.7; // begin steering toward a climax
export const CHAPTER_CLOSE_RATIO = 0.85; // force the chapter to close

// Rough token estimate (chars/4) — a backend-agnostic fallback when the model
// doesn't report real prompt-token counts.
export function estimateTokens(...parts: string[]): number {
  return Math.ceil(parts.reduce((n, p) => n + p.length, 0) / 4);
}

export function isChapterDivider(m: StoryMessage): boolean {
  return m.role === "system" && typeof m.divider === "number";
}

// The LLM only sees history since the last chapter divider — this scopes context
// per chapter (also trims the otherwise-unbounded history) while the full saga
// stays visible in the transcript. Cross-chapter continuity rides in the summary.
export function historySinceLastChapter(messages: StoryMessage[]): StoryMessage[] {
  let start = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (isChapterDivider(messages[i])) {
      start = i + 1;
      break;
    }
  }
  return messages.slice(start);
}

// Current chapter number = 1 + how many dividers precede the end.
export function currentChapter(messages: StoryMessage[]): number {
  return 1 + messages.filter(isChapterDivider).length;
}
