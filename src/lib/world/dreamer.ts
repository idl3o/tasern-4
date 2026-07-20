import { safeUUID } from "@/lib/id";
import { buildWorldDreamerPrompt, WORLD_DREAMER_SYSTEM } from "@/lib/prompt";
import { summarizeWorld } from "./summary";
import type { WorldState, WorldEvent } from "./types";

export type DreamerGenerate = (prompt: string, system: string) => Promise<string>;

const MAX_DREAM_EVENTS = 2;

// One bounded LLM generation that narrates the world's tick into 1-2 canon events.
// Tolerant of malformed output: falls back to the first sentence of prose if the
// model doesn't emit [WORLD_EVENT: ...] tags. Callers skip this entirely when no AI.
export async function runWorldDreamer(world: WorldState, generate: DreamerGenerate): Promise<WorldEvent[]> {
  const prompt = buildWorldDreamerPrompt(summarizeWorld(world));
  const response = await generate(prompt, WORLD_DREAMER_SYSTEM);
  if (!response) return [];

  const texts: string[] = [];
  const re = /\[WORLD_EVENT:\s*(.+?)\]/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(response)) !== null) {
    const t = m[1].trim();
    if (t) texts.push(t);
  }

  // Fallback: no tags — take the first non-empty sentence of the prose.
  if (texts.length === 0) {
    const clean = response.replace(/\[[^\]]*\]/g, "").trim();
    const first = clean.split(/(?<=[.!?])\s+/)[0]?.trim();
    if (first) texts.push(first.length > 240 ? first.slice(0, 240) + "…" : first);
  }

  return texts.slice(0, MAX_DREAM_EVENTS).map((text) => ({
    id: safeUUID(),
    tick: world.tick,
    text,
    source: "dreamer" as const,
  }));
}
