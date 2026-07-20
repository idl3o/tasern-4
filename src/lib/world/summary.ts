import { APPROACHES } from "@/lib/rolls";
import { MOON_META, FACTION_IDS, type WorldState } from "./types";

// Compact, prose-ready summary of the living world — reused by the narrator's
// system prompt and the world-dreamer prompt.
export function summarizeWorld(world: WorldState): string {
  const lines: string[] = [];

  const dominant = APPROACHES.reduce((b, a) => (world.beliefField[a] > world.beliefField[b] ? a : b), APPROACHES[0]);
  if (world.beliefField[dominant] > 0) {
    lines.push(`Ascendant belief: ${dominant} is rising in the collective mind of Tasern.`);
  }

  const factions = FACTION_IDS.map((id) => world.factions[id]).sort((a, b) => b.standing - a.standing);
  const ascendant = factions.find((f) => f.ascendant);
  if (ascendant) lines.push(`Ascendant power: the ${ascendant.name} hold sway over the age.`);
  lines.push(`Rising powers: ${factions.slice(0, 3).map((f) => f.name).join(", ")}.`);

  const moon = MOON_META[world.moons.ascendant];
  lines.push(`The ${moon.name} is ascendant — ${moon.effect}.`);

  const lastShift = world.realityShifts[world.realityShifts.length - 1];
  if (lastShift) lines.push(`A recent reality shift: ${lastShift.description}`);

  const recent = world.events.slice(-2);
  if (recent.length) {
    lines.push("Recent happenings:");
    for (const e of recent) lines.push(`- ${e.text}`);
  }

  return lines.join("\n");
}
