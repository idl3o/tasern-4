import {
  worldContext,
  factionLore,
  factionSummaries,
  moonsBrief,
  getRegionLoreForLocation,
} from "./lore";
import type { StoryMemory } from "@/state/storyStore";

const TAG_PROTOCOL = `## NARRATIVE STYLE
- Write in second person ("You see...", "You feel...")
- Rich, evocative prose with sensory detail
- Let the world feel alive and reactive
- Actions have consequences; belief has weight
- Never break character or reference game mechanics
- Keep responses to 2-4 paragraphs

## DICE ROLLS
When the situation is particularly risky, dramatic, or uncertain, you may request a dice roll by ending your response with [ROLL_REQUIRED: brief reason]. Use this sparingly — only for moments of real tension like combat, dangerous actions, persuasion of hostile NPCs, or life-threatening situations. Do not use it for simple or routine actions.

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

export function composeSystemPrompt({ character, memory, wallet }: ComposeArgs = {}): string {
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

interface RollTier {
  name: string;
  description: string;
}

function getRollTier(roll: number): RollTier {
  if (roll === 1) return { name: "Critical Failure", description: "Everything goes spectacularly wrong" };
  if (roll <= 7) return { name: "Failure", description: "The attempt fails, with consequences" };
  if (roll <= 14) return { name: "Partial Success", description: "Mixed results, complications arise" };
  if (roll <= 19) return { name: "Success", description: "The action succeeds as intended" };
  return { name: "Critical Success", description: "Beyond expectations, extraordinary outcome" };
}

export function buildDicePrompt(roll: number): string {
  const tier = getRollTier(roll);
  return `\n\n[DICE ROLL: ${roll}/20 — ${tier.name}]
The player rolled a d20 and got ${roll}. This is a ${tier.description}.
Narrate the outcome of their action with this result in mind. Do not mention dice or game mechanics explicitly — weave the success or failure naturally into the narrative.`;
}
