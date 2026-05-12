import worldContextRaw from "@/content/world-context.md";
import factionsRaw from "@/content/factions.md";
import geographyRaw from "@/content/geography.md";
import moonsRaw from "@/content/moons.md";

export const worldContext: string = worldContextRaw;

const FACTION_HEADINGS: Record<string, string> = {
  "Elves of Elpha": "## 1. The Elves of Elpha",
  "Dwarves of Argenti": "## 2. The Dwarves of Argenti",
  "Durgan Dynasty": "## 3. The Durgan Dynasty (Humans)",
  "Pirates": "## 4. The Pirates of the Thousand Kingdoms",
  "Igypt": "## 5. Igypt, City of Fear and Vigil",
  "Dragons": "## 6. The Dragons of Tasern",
  "Orks of Orklin": "## 7. The Orks of Orklin",
  "Druids": "## 8. The Druids of the Living Cycle",
};

function extractSection(source: string, heading: string): string {
  const start = source.indexOf(heading);
  if (start === -1) return "";
  const headingLevel = heading.match(/^#+/)?.[0].length ?? 2;
  const after = source.slice(start);
  const lines = after.split("\n");
  const out: string[] = [lines[0]];
  for (let i = 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#+)\s/);
    if (m && m[1].length <= headingLevel) break;
    out.push(lines[i]);
  }
  return out.join("\n").trim();
}

export const factionLore: Record<string, string> = Object.fromEntries(
  Object.entries(FACTION_HEADINGS).map(([displayName, heading]) => [
    displayName,
    extractSection(factionsRaw, heading),
  ])
);

export const factionSummaries: string = `- **Elves of Elpha** — Patient crafters, thousand-year plans, ancient war with Orks
- **Dwarves of Argenti** — Solitary perfectionists; permanence over glory
- **Durgan Dynasty** — Human traders, flying ships, rule by connection
- **Pirates** — Freedom, chaos, off-world vessels, smuggled beliefs
- **Igypt** — Fear is sacred; Vigilant Dead serve across generations
- **Dragons** — Immortal if fed; rule by tribute and presence
- **Orks of Orklin** — Industrial revolution, war machines, advancing
- **Druids** — Stewards of growth and rot; balance over mercy`;

export const moonsBrief: string = `- **White Moon** — Frozen wasteland of ice dragons; pure hunger
- **Green Moon** — Endless jungle that watches and remembers
- **Blue Moon** — Endless ocean where pirates sail seas that rise into sky`;

const REGION_KEYWORDS: Array<{ region: string; keywords: string[] }> = [
  { region: "### West Wood", keywords: ["west wood", "westwood"] },
  { region: "### Skrim (North)", keywords: ["skrim"] },
  { region: "### Argenti (East)", keywords: ["argenti"] },
  { region: "### Manlan (South)", keywords: ["manlan"] },
  { region: "### Elpha (Central)", keywords: ["elpha"] },
  { region: "### Orklin (Threaded through Tern)", keywords: ["orklin"] },
  { region: "## Isles of a Thousand Kingdoms", keywords: ["thousand kingdoms", "isles", "archipelago"] },
  { region: "## Greyhills", keywords: ["greyhills", "redspire"] },
  { region: "## Lanice (Far North)", keywords: ["lanice"] },
  { region: "## The White Wastes (Beyond Lanice)", keywords: ["white wastes"] },
  { region: "## Londa (South of Tern)", keywords: ["londa"] },
  { region: "## Cubek (Far South)", keywords: ["cubek"] },
  { region: "## Stralia (Southeast)", keywords: ["stralia"] },
  { region: "## The Desert of Igypt", keywords: ["igypt", "desert"] },
];

export function getRegionLoreForLocation(location: string | null | undefined): string | null {
  if (!location) return null;
  const lower = location.toLowerCase();
  const match = REGION_KEYWORDS.find((entry) =>
    entry.keywords.some((k) => lower.includes(k))
  );
  if (!match) return null;
  return extractSection(geographyRaw, match.region);
}
