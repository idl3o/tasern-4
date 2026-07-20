import { APPROACHES, type Approach } from "@/lib/rolls";
import { safeUUID } from "@/lib/id";
import {
  APPROACH_FACTIONS,
  MOON_IDS,
  MOON_META,
  REGION_IDS,
  type WorldState,
  type FactionId,
  type WorldEvent,
  type RealityShift,
} from "./types";

// ---- Tuning knobs (named for playtest tuning) ----
export const FIELD_GAIN = 1; // how strongly a player's belief delta feeds the field
export const FIELD_DECAY = 0.97; // gentle per-tick decay so the field ebbs, not only grows
export const STANDING_DRIFT = 2; // aligned factions' gain per tick from the dominant belief
export const STANDING_REVERT = 0.25; // pull back toward the 50 baseline
export const ORK_ADVANCE = 0.4; // Orks are industrializing — a steady structural rise
export const PROSPERITY_FOLLOW = 0.1; // economy trails power
export const MOON_PERIOD = 4; // ticks before the ascendant moon rotates
export const SHIFT_THRESHOLD = 12; // field level at which a belief bends reality
export const SHIFT_DAMPEN = 0.5; // field multiplier after a shift fires (prevents refiring)

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const pos = (n: number) => (n > 0 ? n : 0);

function dominantApproach(field: Record<Approach, number>): Approach {
  return APPROACHES.reduce((best, a) => (field[a] > field[best] ? a : best), APPROACHES[0]);
}

// Deterministic, pure, no IO. Folds the player's current affinity totals into the
// world (as a delta vs the last snapshot), drifts factions, rotates the moon, and
// fires at most one reality shift per tick.
export function advanceWorld(state: WorldState, currentTotals: Record<string, number>): WorldState {
  const tick = state.tick + 1;

  // 1) Belief field: decay, then fold in this session's belief delta.
  const beliefField = {} as Record<Approach, number>;
  const nextContribution = {} as Record<Approach, number>;
  for (const a of APPROACHES) {
    const cur = currentTotals[a] ?? 0;
    const delta = pos(cur - (state.lastContribution[a] ?? 0));
    beliefField[a] = Math.round((state.beliefField[a] ?? 0) * FIELD_DECAY + delta * FIELD_GAIN);
    nextContribution[a] = cur;
  }

  const dominant = dominantApproach(beliefField);
  const aligned = new Set<FactionId>(APPROACH_FACTIONS[dominant] ?? []);

  // 2) Faction standings drift: aligned factions rise with the field; others revert to 50.
  const factions = { ...state.factions };
  const fieldPull = Math.min(1, beliefField[dominant] / SHIFT_THRESHOLD); // 0..1
  for (const id of Object.keys(factions) as FactionId[]) {
    const f = { ...factions[id] };
    if (aligned.has(id)) f.standing += STANDING_DRIFT * fieldPull;
    else f.standing += (50 - f.standing) * (STANDING_REVERT / 100);
    if (id === "orks") f.standing += ORK_ADVANCE; // industrial revolution
    f.standing = clamp(f.standing);
    f.prosperity = clamp(f.prosperity + (f.standing - f.prosperity) * PROSPERITY_FOLLOW);
    factions[id] = f;
  }

  // 3) Moons: advance the phase; rotate the ascendant on period boundaries.
  let moons = { ...state.moons, phase: state.moons.phase + 1 };
  const events: WorldEvent[] = [...state.events];
  if (moons.phase >= MOON_PERIOD) {
    const next = MOON_IDS[(MOON_IDS.indexOf(moons.ascendant) + 1) % MOON_IDS.length];
    moons = { ascendant: next, phase: 0 };
    events.push({
      id: safeUUID(),
      tick,
      text: `The ${MOON_META[next].name} waxes over Tasern — ${MOON_META[next].effect}.`,
      source: "rules",
    });
  }

  // 4) Reality shift: if the dominant belief crosses the threshold, it bends reality.
  const realityShifts: RealityShift[] = [...state.realityShifts];
  const regions = { ...state.regions };
  if (beliefField[dominant] >= SHIFT_THRESHOLD) {
    // The strongest aligned faction ascends.
    const riser = Array.from(aligned).sort(
      (a, b) => factions[b].standing - factions[a].standing
    )[0];
    if (riser) {
      for (const id of Object.keys(factions) as FactionId[]) {
        factions[id] = { ...factions[id], ascendant: id === riser };
      }
      const f = factions[riser];
      f.standing = clamp(f.standing + 5);

      // Claim the first unclaimed region as a mark of ascendancy (deterministic).
      let claimed: string | null = null;
      for (const rid of REGION_IDS) {
        if (!regions[rid].controller) {
          regions[rid] = { ...regions[rid], controller: riser };
          claimed = regions[rid].name;
          break;
        }
      }

      const desc = `Belief in ${dominant} swells across Tasern — the ${f.name} rise to ascendancy${
        claimed ? `, their banners rising over ${claimed}` : ""
      }.`;
      realityShifts.push({ id: safeUUID(), tick, belief: dominant, description: desc });
      events.push({ id: safeUUID(), tick, text: desc, source: "rules" });

      // Dampen the field so it doesn't refire next tick.
      beliefField[dominant] = Math.round(beliefField[dominant] * SHIFT_DAMPEN);
    }
  }

  return {
    ...state,
    tick,
    beliefField,
    lastContribution: nextContribution,
    factions,
    regions,
    moons,
    events: events.slice(-40), // cap canon log
    realityShifts: realityShifts.slice(-20),
  };
}
