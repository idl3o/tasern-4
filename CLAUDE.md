# Tasern 4 - AI-Driven Web3 Storytelling

> An AI Dungeon-style experience set in James Macgee's Tasern Universe

## Project Vision

Tasern 4 is a **multiplayer, AI-driven storytelling platform** where players explore a living universe through interactive fiction. Like AI Dungeon, the system uses LLMs to generate narrative—but grounded in the rich, belief-powered world of Tasern.

**Core Loop**: Connect wallet → Enter Tasern → AI generates your story → Your choices shape the world

---

## World Foundation

### The Cosmic Setup

At the edge of existence, where time slows and reality thins, sits **Tasern**—a world that catches everything that falls from dying universes. Easy to enter. Almost impossible to leave.

**Twin Suns**:
- **The Tear** — A wound in reality. Endless unmaking fire.
- **The Castle of Light** — A sun-castle where local gods dwell, born from belief.

**Three Moons**:
- **White Moon** — Frozen. Ice dragons. Pure hunger.
- **Green Moon** — Jungle. Life without restraint.
- **Blue Moon** — Ocean. Pirates. Chaos and freedom.

### The Rule of Belief

In Tasern, **belief is magic**. What enough minds hold true becomes true. Gods rise from prayers. Nations crack when rumors outpace laws. Fear feeds monsters. Hope feeds miracles.

This means:
- Contradictory truths coexist (elven and draconic creation myths are both "true")
- Player beliefs can shape local reality
- History is negotiated, not fixed

---

## The Eight Factions

| Faction | Currency | Core Identity |
|---------|----------|---------------|
| **Elves of Elpha** | $EGP | Patient planners, enchanted craftwork, thousand-year grudges |
| **Dwarves of Argenti** | — | Solitary perfectionists, permanence over glory |
| **Durgan Dynasty** | $DDD | Human traders, flying ships, connection over conquest |
| **Pirates** | $PKT | Freedom, chaos, off-world vessels, smuggled beliefs |
| **Igypt** | $IGS | Fear as sacred, Vigilant Dead, desert isolation |
| **Dragons** | $DHG | Immortal if fed, tribute-based rule, competing truths |
| **Orks of Orklin** | $OGC | Industrial revolution, war machines, advancing threat |
| **Druids** | $BTN | Balance keepers, growth and rot, the living cycle |

---

## Content Structure

```
content/
├── world-context.md    # AI prompt foundation - cosmology, tone, themes
├── factions.md         # All 8 factions with hooks and tensions
├── geography.md        # Continents, regions, navigation rules
├── moons.md            # The three moons and their influence
└── stories/            # [Future] Player-contributed narratives
```

These files provide the **seed context** for AI story generation. Rich enough to improvise authentically, open enough for player agency.

---

## Web3 Integration

### Identity
- **Wallet = Character** — Your address is your persistent identity
- **NFTs = History** — Characters/items with on-chain provenance
- **Tokens = Allegiance** — Holdings may indicate faction reputation

### Currencies ($PKT, $DDD, $EGP, $IGS, $DHG, $OGC, $BTN, $LGP)
Each faction currency could:
- Grant access to faction-specific story branches
- Unlock faction NPCs, locations, or knowledge
- Affect how NPCs perceive and treat you

### Potential Mechanics
- Character NFTs with evolving metadata based on story choices
- Governance: token holders vote on canonical lore additions
- Creator rewards for player-contributed content that becomes canon

---

## AI Storytelling System

### How It Works (conceptual)

1. **Context Loading**: World-context.md + relevant faction/location data
2. **Player State**: Wallet holdings, character history, current location
3. **Prompt Construction**: Situation + player action + world rules
4. **Generation**: LLM produces narrative continuation
5. **State Update**: Choices recorded, world state potentially modified

### Story Entry Points

New players arrive through the cosmic drain:
- Fell from a dying world
- Spell gone wrong
- Pursued by something that no longer exists
- Simply lost until Tasern's gravity caught them

First question: *What do you believe?* — because in Tasern, that has consequences.

---

## Technical Direction

### From Tasern 3 (to leverage)
- React 18 + TypeScript
- Web3: RainbowKit, Wagmi, Polygon
- State: Zustand + Immer
- Deployment: Vercel

### New Systems Needed

```
Priority 1 - MVP:
├── Story interface (text input/output)
├── Wallet connection
├── Context management (load lore, track state)
└── Basic LLM integration

Priority 2 - Enhancement:
├── Character persistence (on-chain or off-chain)
├── Location/faction awareness
├── Multiplayer story threads
└── NPC memory

Priority 3 - Web3 Deep:
├── Token-gated content
├── NFT character minting
├── Lore contribution system
└── Governance voting
```

---

## Design Principles

### For Players
- **Any origin works** — Cosmic drain explains any character concept
- **Choices matter** — Your beliefs shape your reality
- **Persistence** — Your story continues across sessions

### For the AI
- **Stay grounded** — Use the lore documents as truth
- **Respect faction voices** — An elf NPC sounds different from an ork
- **Embrace contradiction** — Multiple truths coexist by design

### For the World
- **Grows organically** — Player stories can become canon
- **Belief has weight** — Collective player beliefs might shift reality
- **Honor the source** — James Macgee's vision remains core

---

## Links & References

- **Tasern 3 Codebase**: `C:\Users\Sam\Documents\coding projs\tasern 3`
- **Lore Source**: `Tasern_overview.odt`
- **Website**: https://tasern.quest/

### Key Tasern 3 Files
- `src/data/tasernLore.ts` — Original lore database
- `src/core/BattleEngine.ts` — Combat system (potential tactical encounters)
- `src/ai/ConsciousnessAI.ts` — AI personality system (could inform NPC behavior)
- `src/services/MultiplayerService.ts` — P2P infrastructure

---

## Current State

**Completed**:
- [x] World context document (cosmology, tone, themes)
- [x] Faction documentation (all 8 with tensions)
- [x] Geography documentation (continents, regions)
- [x] Moon documentation (three moons, influences)

**Next**:
- [ ] Story hooks / scenario templates
- [ ] Character creation prompts
- [ ] Prototype story interface
- [ ] LLM integration planning
