// Dice + belief-modifier resolution for the Tasern decision system.

export const APPROACHES = ["Combat", "Perception", "Nature", "Chaos"] as const;
export type Approach = (typeof APPROACHES)[number];

// Tuning knobs — kept as named constants because they'll want play-testing.
export const MODIFIER_PER_STRENGTH = 2; // +1 modifier per this many reinforcements
export const MODIFIER_CAP = 5;
export const CREATION_AFFINITY_SEED = 2; // starting reinforcements for the chosen belief (=> +1)

export interface RollTier {
  name: string;
  description: string;
  color: string;
}

export function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

export function getRollTier(roll: number): RollTier {
  if (roll <= 1) return { name: "Critical Failure", description: "Everything goes spectacularly wrong", color: "text-red-400" };
  if (roll <= 7) return { name: "Failure", description: "The attempt fails, with consequences", color: "text-red-400/70" };
  if (roll <= 14) return { name: "Partial Success", description: "Mixed results, complications arise", color: "text-gold" };
  if (roll <= 19) return { name: "Success", description: "The action succeeds as intended", color: "text-green-400" };
  return { name: "Critical Success", description: "Beyond expectations, extraordinary outcome", color: "text-green-300" };
}

// Normalize free-form approach text (e.g. from an AI tag) to a canonical Approach,
// or null if it doesn't match one of the four.
export function normalizeApproach(raw: string | null | undefined): Approach | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  return APPROACHES.find((a) => a.toLowerCase() === t) ?? null;
}

export function affinityModifier(strength: number | undefined): number {
  if (!strength || strength < 0) return 0;
  return Math.min(MODIFIER_CAP, Math.floor(strength / MODIFIER_PER_STRENGTH));
}

export interface RollResult {
  raw: number; // the natural d20
  modifier: number;
  total: number; // raw + modifier (for display)
  approach: Approach | null;
  tier: RollTier;
}

// Resolve a natural d20 with a belief modifier. A natural 1 / 20 always crits,
// regardless of the modifier; otherwise the tier is read off raw + modifier.
export function resolveRoll(raw: number, modifier: number, approach: Approach | null): RollResult {
  const total = raw + modifier;
  let tier: RollTier;
  if (raw === 1) tier = getRollTier(1);
  else if (raw === 20) tier = getRollTier(20);
  else tier = getRollTier(total);
  return { raw, modifier, total, approach, tier };
}

// Human-readable roll line, e.g. "d20: 11 +3 (Perception) = 14 — Partial Success".
export function formatRoll(r: RollResult): string {
  const mod = r.modifier > 0 ? ` +${r.modifier}${r.approach ? ` (${r.approach})` : ""} = ${r.total}` : "";
  return `d20: ${r.raw}${mod} — ${r.tier.name}`;
}
