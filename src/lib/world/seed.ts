import { safeUUID } from "@/lib/id";
import {
  WORLD_VERSION,
  FACTION_META,
  REGION_META,
  FACTION_IDS,
  REGION_IDS,
  emptyField,
  type WorldState,
  type FactionState,
  type RegionState,
} from "./types";

// Baseline standing tweaks from lore: the Orks are industrializing and advancing,
// so they start a touch ahead; everyone else sits near parity.
const STANDING_OVERRIDES: Partial<Record<string, number>> = {
  orks: 56,
  elves: 52,
  dragons: 52,
};

// Builds a fresh Tasern from the lore: factions in their homelands at rough parity,
// homeland regions controlled, moons and belief field dormant, a couple of canon
// seed events to set the stage.
export function seedWorld(now: number): WorldState {
  const factions = Object.fromEntries(
    FACTION_IDS.map((id) => {
      const meta = FACTION_META[id];
      const f: FactionState = {
        id,
        name: meta.name,
        homeland: meta.homeland,
        standing: STANDING_OVERRIDES[id] ?? 50,
        prosperity: 50,
        ascendant: false,
      };
      return [id, f];
    })
  ) as WorldState["factions"];

  // Homeland region controlled by its faction; the rest start unclaimed.
  const homelandController = new Map(
    FACTION_IDS.map((id) => [FACTION_META[id].homeland, id] as const).filter(([r]) => r)
  );
  const regions = Object.fromEntries(
    REGION_IDS.map((id) => {
      const r: RegionState = {
        id,
        name: REGION_META[id],
        controller: homelandController.get(id) ?? null,
        contested: false,
      };
      return [id, r];
    })
  ) as WorldState["regions"];

  return {
    version: WORLD_VERSION,
    tick: 0,
    createdAt: now,
    updatedAt: now,
    beliefField: emptyField(),
    lastContribution: emptyField(),
    factions,
    regions,
    moons: { ascendant: "white", phase: 0 },
    events: [
      {
        id: safeUUID(),
        tick: 0,
        text: "The ancient enmity between Elpha's elves and the clans of Orklin smoulders anew as Ork forges glow through the night.",
        source: "seed",
      },
      {
        id: safeUUID(),
        tick: 0,
        text: "Under the White Moon's hunger, the northern reaches of Lanice grow lean, and predators press south.",
        source: "seed",
      },
    ],
    realityShifts: [],
  };
}
