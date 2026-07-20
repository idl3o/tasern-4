// Persistent world-simulation model for Tasern. One global WorldState (not per
// story) evolves as belief accumulates. Kept a plain serializable object so it can
// later be lifted to a shared/authoritative backend without a gameplay rewrite.

import type { Approach } from "@/lib/rolls";
import { APPROACHES } from "@/lib/rolls";

export const WORLD_VERSION = 1;

export type FactionId =
  | "elves"
  | "dwarves"
  | "durgan"
  | "pirates"
  | "igypt"
  | "dragons"
  | "orks"
  | "druids";

export type MoonId = "white" | "green" | "blue";

export type RegionId =
  | "west-wood"
  | "skrim"
  | "argenti"
  | "manlan"
  | "elpha"
  | "orklin"
  | "isles"
  | "greyhills"
  | "lanice"
  | "white-wastes"
  | "londa"
  | "cubek"
  | "stralia"
  | "igypt-desert";

export interface FactionState {
  id: FactionId;
  name: string;
  homeland: RegionId | null;
  standing: number; // overall power/influence, ~0..100
  prosperity: number; // economy index, ~0..100
  ascendant: boolean; // currently the dominant power (set by a reality shift)
}

export interface RegionState {
  id: RegionId;
  name: string;
  controller: FactionId | null;
  contested: boolean;
}

export interface MoonState {
  ascendant: MoonId;
  phase: number; // ticks elapsed within the current ascendancy
}

export interface WorldEvent {
  id: string;
  tick: number;
  text: string;
  source: "seed" | "rules" | "dreamer";
}

export interface RealityShift {
  id: string;
  tick: number;
  belief: Approach;
  description: string;
}

export interface WorldState {
  version: number;
  tick: number;
  createdAt: number;
  updatedAt: number;
  // Global belief-pressure per approach — the field that bends reality at thresholds.
  beliefField: Record<Approach, number>;
  // Snapshot of the player's affinity totals last folded in, to compute per-tick deltas.
  lastContribution: Record<Approach, number>;
  factions: Record<FactionId, FactionState>;
  regions: Record<RegionId, RegionState>;
  moons: MoonState;
  events: WorldEvent[];
  realityShifts: RealityShift[];
}

// ---- Lore-grounded metadata (from content/factions.md, geography.md, moons.md) ----

export const FACTION_META: Record<FactionId, { name: string; homeland: RegionId | null }> = {
  elves: { name: "Elves of Elpha", homeland: "elpha" },
  dwarves: { name: "Dwarves of Argenti", homeland: "argenti" },
  durgan: { name: "Durgan Dynasty", homeland: "manlan" },
  pirates: { name: "Pirates", homeland: "isles" },
  igypt: { name: "Igypt", homeland: "igypt-desert" },
  dragons: { name: "Dragons", homeland: "greyhills" },
  orks: { name: "Orks of Orklin", homeland: "orklin" },
  druids: { name: "Druids", homeland: "stralia" },
};

export const REGION_META: Record<RegionId, string> = {
  "west-wood": "West Wood",
  skrim: "Skrim",
  argenti: "Argenti",
  manlan: "Manlan",
  elpha: "Elpha",
  orklin: "Orklin",
  isles: "Isles of a Thousand Kingdoms",
  greyhills: "Greyhills",
  lanice: "Lanice",
  "white-wastes": "The White Wastes",
  londa: "Londa",
  cubek: "Cubek",
  stralia: "Stralia",
  "igypt-desert": "Desert of Igypt",
};

export const MOON_META: Record<MoonId, { name: string; effect: string }> = {
  white: { name: "White Moon", effect: "Hunger, cold, consumption — harsh winters, predators stir, scarcity" },
  green: { name: "Green Moon", effect: "Growth and wildness — crops and beasts flourish, jungles expand" },
  blue: { name: "Blue Moon", effect: "Freedom and chaos — seas rise, boundaries weaken, pirates embolden" },
};

// Which approach's ascendancy thematically empowers which factions.
export const APPROACH_FACTIONS: Record<Approach, FactionId[]> = {
  Combat: ["orks", "dragons"],
  Perception: ["elves", "dwarves", "igypt"],
  Nature: ["druids"],
  Chaos: ["pirates"],
};

export const FACTION_IDS = Object.keys(FACTION_META) as FactionId[];
export const REGION_IDS = Object.keys(REGION_META) as RegionId[];
export const MOON_IDS = Object.keys(MOON_META) as MoonId[];

export function emptyField(): Record<Approach, number> {
  return APPROACHES.reduce((acc, a) => ({ ...acc, [a]: 0 }), {} as Record<Approach, number>);
}
