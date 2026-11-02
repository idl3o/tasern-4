import type { ModelDetails } from "./types";

/** "llama3.2:latest" and "llama3.2" name the same model. */
export function normaliseModelName(name: string): string {
  return name.endsWith(":latest") ? name.slice(0, -":latest".length) : name;
}

export function sameModel(a: string, b: string): boolean {
  return normaliseModelName(a) === normaliseModelName(b);
}

/** False only when Ollama says the model can't chat (e.g. an embedding model). */
export function canChat(model: ModelDetails): boolean {
  return model.capabilities === null || model.capabilities.has("completion");
}

// Default ordering by name prefix, best first, used until the player picks a model.
// Reasoning-first models such as gpt-oss are absent on purpose: they spend the reply
// budget thinking and can't be told not to. Unlisted models are still offered, last.
export const PREFERRED_PREFIXES = [
  "gemma4",
  "gemma3",
  "llama3.2",
  "llama3.1",
  "qwen3",
  "mistral",
] as const;

function preferenceRank(model: ModelDetails): number {
  const base = model.name.split(":")[0] ?? model.name;
  const i = PREFERRED_PREFIXES.findIndex((prefix) => base.startsWith(prefix));
  return i === -1 ? PREFERRED_PREFIXES.length : i;
}

/** Chat-capable models, preferred first; Ollama's order is kept within a rank. */
export function rankModels(models: readonly ModelDetails[]): ModelDetails[] {
  return models
    .filter(canChat)
    .sort((a, b) => preferenceRank(a) - preferenceRank(b));
}

/** The player's choice if it is installed and can chat, else the best-ranked model. */
export function selectModel(
  models: readonly ModelDetails[],
  chosen: string | null
): ModelDetails | null {
  const ranked = rankModels(models);
  const picked = chosen === null ? undefined : ranked.find((m) => sameModel(m.name, chosen));
  return picked ?? ranked[0] ?? null;
}
