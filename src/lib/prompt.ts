import {
  worldContext,
  factionLore,
  factionSummaries,
  moonsBrief,
  getRegionLoreForLocation,
} from "./lore";
import type { StoryMemory } from "@/state/storyStore";
import type { RollResult } from "./rolls";
import type { WorldState } from "./world/types";
import { summarizeWorld } from "./world/summary";

const TAG_PROTOCOL = `## NARRATIVE STYLE
- Write in second person ("You see...", "You feel...")
- Rich, evocative prose with sensory detail
- Let the world feel alive and reactive
- Actions have consequences; belief has weight
- Never break character or reference game mechanics
- Keep responses to 2-4 paragraphs

## DICE ROLLS
Only call for a roll when the outcome is genuinely uncertain or contested — combat, dangerous feats, persuading a hostile NPC, life-or-death moments. For routine or low-stakes actions, simply narrate the result; do NOT roll.
When a roll IS warranted, narrate up to the decisive moment (do not decide the outcome yourself) and end your response with:
[ROLL_REQUIRED: brief reason | approach:combat]
The approach must be one of: combat, perception, nature, chaos — whichever best fits HOW the character is acting (combat = force/might, perception = insight/knowledge, nature = growth/healing, chaos = trickery/mobility). When you request a roll, do NOT also list choices.

## SUGGESTED MOVES
When you are NOT requesting a roll, end your response with 2-4 suggested next moves, each on its own line:
[CHOICE: short action the player could take | approach:perception]
Offer a variety of approaches when it fits the scene. These are only suggestions — the player may type their own action instead.

## ITEMS & SPELLS
When the player acquires a notable item, append [ITEM_GAINED: Item Name - brief description] at the end of your response.
When the player loses or uses up an item, append [ITEM_LOST: Item Name].
When the player learns a spell or ability, append [SPELL_LEARNED: Spell Name - brief description].
When a spell is lost or forgotten, append [SPELL_LOST: Spell Name].
You may include multiple tags. Place all tags at the very end of your response, each on its own line.`;

export interface CharacterContext {
  name?: string | null;
  faction?: string | null;
  belief?: string | null;
}

export interface WalletContext {
  address: string;
  polBalance: string | null;
}

export interface ComposeArgs {
  character?: CharacterContext | null;
  memory?: StoryMemory | null;
  wallet?: WalletContext | null;
  world?: WorldState | null;
}

function topBeliefs(memory: StoryMemory | null | undefined, n = 3): string[] {
  if (!memory?.beliefStrengths) return [];
  return Object.entries(memory.beliefStrengths)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([belief]) => belief);
}

function buildMemoryContext(memory: StoryMemory): string {
  if (!memory.summary) return "";
  const parts = [`## STORY SO FAR (narrator notes)\n${memory.summary}`];
  if (memory.characterName) parts.push(`Character: ${memory.characterName}`);
  if (memory.currentLocation) parts.push(`Location: ${memory.currentLocation}`);
  if (memory.npcsEncountered.length > 0) parts.push(`Known NPCs: ${memory.npcsEncountered.join(", ")}`);
  if (memory.inventory.length > 0) parts.push(`Inventory: ${memory.inventory.map((i) => i.name).join(", ")}`);
  if (memory.spells.length > 0) parts.push(`Known Spells: ${memory.spells.map((s) => s.name).join(", ")}`);
  return parts.join("\n");
}

export function composeSystemPrompt({ character, memory, wallet, world }: ComposeArgs = {}): string {
  const sections: string[] = [
    "You are the narrator for Tales of Tasern, an interactive fiction experience.",
    worldContext,
    TAG_PROTOCOL,
  ];

  // Character (from creation, persistent across the story)
  const charName = character?.name || memory?.characterName;
  const charFaction = character?.faction || memory?.faction;
  const charBelief = character?.belief;
  if (charName || charFaction || charBelief) {
    const lines = ["## PLAYER CHARACTER"];
    if (charName) lines.push(`Name: ${charName}`);
    if (charFaction) lines.push(`Faction affinity: ${charFaction}`);
    if (charBelief) lines.push(`Stated core belief: "${charBelief}"`);
    sections.push(lines.join("\n"));
  }

  // Dominant beliefs (from accumulation in memory)
  const dominant = topBeliefs(memory);
  if (dominant.length > 0) {
    sections.push(
      `## DOMINANT BELIEFS (in Tasern, what is held strongly tends to become real)\n${dominant
        .map((b) => `- ${b}`)
        .join("\n")}`
    );
  }

  // Faction lore: full section for player's affinity, brief mentions of others
  if (charFaction && factionLore[charFaction]) {
    sections.push(`## YOUR FACTION\n${factionLore[charFaction]}`);
  }
  sections.push(`## OTHER POWERS OF TASERN\n${factionSummaries}`);

  // Region lore if location is known
  const location = memory?.currentLocation;
  const region = getRegionLoreForLocation(location);
  if (region) {
    sections.push(`## CURRENT REGION\n${region}`);
  }

  // Persistent identity (wallet)
  if (wallet?.address) {
    const short = `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}`;
    const balanceLine = wallet.polBalance
      ? `They carry ${wallet.polBalance} POL of weight from beyond — small holdings echo as small influence; large holdings echo loud.`
      : "Their holdings beyond Tasern are unknown.";
    sections.push(
      `## PERSISTENT IDENTITY\nThe traveler is bound across worlds to the sigil ${short}. ${balanceLine} Reference this identity sparingly and only when the moment invites — perhaps a fortune-teller sees the sigil, perhaps the weight of their wealth precedes them.`
    );
  }

  // Living world state — the belief-driven simulation the story plays against.
  if (world) {
    sections.push(
      `## THE STATE OF TASERN (the living world right now — let it colour the scene, NPCs, and rumours)\n${summarizeWorld(world)}`
    );
  }

  // Moons (brief, always)
  sections.push(`## THE THREE MOONS\n${moonsBrief}`);

  // Story-so-far memory
  if (memory) {
    const ctx = buildMemoryContext(memory);
    if (ctx) sections.push(ctx);
  }

  return sections.join("\n\n");
}

export const MEMORY_EXTRACTION_PROMPT = `Analyze this interactive story and extract key facts as JSON.
Respond ONLY with valid JSON, no other text or markdown formatting.

{
  "characterName": "name if established, or null",
  "currentLocation": "where the character currently is",
  "keyEvents": ["brief summary of each major event, max 15"],
  "npcsEncountered": ["Name - one line description"],
  "beliefs": ["things the character believes or has expressed or acted on"],
  "faction": "faction affinity if established, or null",
  "summary": "A 2-3 paragraph prose summary of the entire story so far, covering the key plot arc and current situation",
  "inventory": [{"name": "Item Name", "description": "brief description"}],
  "spells": [{"name": "Spell Name", "description": "brief description"}]
}

Here is the story:
`;

export const MEMORY_EXTRACTION_SYSTEM = "You are a story analyst. Extract facts from the story as JSON. Respond ONLY with valid JSON.";

// Soft, escalating steer toward a chapter climax as the context window fills.
// `intensity` 0..1 (how close to the close threshold) sharpens the language.
export function buildWindDownPrompt(intensity: number): string {
  if (intensity >= 0.75) {
    return `\n\nThis chapter is reaching its climax NOW. Bring the current threads to a head — deliver the decisive, consequential moment this arc has been building toward, and let the scene resolve toward a natural stopping point. Make it land.`;
  }
  return `\n\nThe chapter is drawing toward its close. Begin converging the threads and raising the stakes toward a climax; let suggested moves point toward resolution rather than opening new long detours.`;
}

// Opens a new chapter in a fresh context window, carrying the story forward via the
// summary (which is already in the system prompt as STORY SO FAR).
export function buildChapterOpeningPrompt(chapter: number): string {
  return `A new chapter of the traveller's saga begins: Chapter ${chapter}.
Some time has passed. Drawing on the story so far and the current state of Tasern, open a fresh scene that moves the traveller forward — a new place, a new tension, or a consequence of what came before. Do not recap mechanically; simply continue the tale in a new beat.
Write 2-3 evocative paragraphs and end by offering suggested moves per the protocol.`;
}

export const WORLD_DREAMER_SYSTEM =
  "You are the Chronicler of Tasern, recording how the living world shifts between a traveller's visits. Respond ONLY with 1-2 lines, each of the form [WORLD_EVENT: a single vivid sentence].";

export function buildWorldDreamerPrompt(stateSummary: string): string {
  return `The world of Tasern has turned. Given its current state, record 1-2 brief happenings that plausibly unfold across the world — faction moves, omens, the moons' influence, or consequences of shifting belief. Reference the state; keep each to one vivid sentence. Do not mention game mechanics, dice, or the player.

Current state:
${stateSummary}

Respond ONLY with lines of the form:
[WORLD_EVENT: a single-sentence happening]`;
}

// Appended to an action prompt when the stochastic backstop decides the world should
// intrude. The narrator supplies the fiction and the approach; do NOT resolve it.
export const FATE_INTRUSION_PROMPT = `

Fate stirs — reality thins around the traveler. Beyond simply reacting to their action, weave in an unexpected complication or intrusion that fits this scene: an omen, a belief-storm, the pull of the Tear, or a sudden move by someone or something present. Build to the decisive moment and STOP there — do not resolve it. End your response by calling for a check per the protocol, choosing the approach that best fits how the traveler would meet it: [ROLL_REQUIRED: brief reason | approach:combat]. Do not list choices this turn.`;

export function buildDicePrompt(result: RollResult): string {
  const approachNote = result.approach ? ` acting through ${result.approach}` : "";
  return `\n\n[DICE ROLL: ${result.total} — ${result.tier.name}]
The player rolled a d20${approachNote} and the result is a ${result.tier.name.toLowerCase()} (${result.tier.description}).
Narrate the outcome of their action with this result in mind. Do not mention dice or game mechanics explicitly — weave the success or failure naturally into the narrative.`;
}
