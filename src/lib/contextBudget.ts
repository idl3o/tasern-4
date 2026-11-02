// Token budgeting for the in-browser model's bounded context window. WebLLM rejects
// an over-long prompt outright (ContextWindowSizeExceededError) rather than
// truncating it, so history must be fitted before the request is made.

/** Context window requested for in-browser models; web-llm's prebuilt default is 4096. */
export const WEBLLM_CONTEXT_TOKENS = 8192;

/** Upper bound on a single generated reply. */
export const MAX_REPLY_TOKENS = 1024;

// chars/4 is an estimate, not the model's tokenizer: leave headroom for its error.
const ESTIMATE_SAFETY = 0.85;

/** Estimated tokens available for system prompt + history + prompt. */
export const PROMPT_TOKEN_BUDGET = Math.floor(
  (WEBLLM_CONTEXT_TOKENS - MAX_REPLY_TOKENS) * ESTIMATE_SAFETY
);

/** Rough token count (chars/4) for text the model has not tokenised yet. */
export function estimateTokens(...parts: readonly string[]): number {
  return Math.ceil(parts.reduce((n, p) => n + p.length, 0) / 4);
}

/**
 * Keeps the longest recent suffix of `history` that fits in `budget` estimated
 * tokens alongside the `fixed` texts (system prompt, current prompt), which are
 * never dropped. Returns an empty history when the fixed texts alone exceed it.
 */
export function fitHistory<T extends { content: string }>(
  history: readonly T[],
  fixed: readonly string[],
  budget: number
): T[] {
  let remaining = budget - estimateTokens(...fixed);
  let start = history.length;
  while (start > 0) {
    const cost = estimateTokens(history[start - 1].content);
    if (cost > remaining) break;
    remaining -= cost;
    start--;
  }
  return history.slice(start);
}
