# Tasern 4 - AI-Driven Web3 Storytelling

> An AI Dungeon-style experience set in James Magee's Tasern Universe

## Project Vision

Tasern 4 is a **multiplayer, AI-driven storytelling platform** where players explore a living universe through interactive fiction. Like AI Dungeon, the system uses LLMs to generate narrative—but grounded in the rich, belief-powered world of Tasern.

**Core Loop**: Launch app → Enter Tasern → AI generates your story → Your choices shape the world

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

### How It Works

1. **Character Creation**: Player picks name, origin, core belief, and faction affinity via click-through UI
2. **Context Loading**: World-context.md + memory context + character details fed to AI
3. **Prompt Construction**: Situation + player action + world rules + belief/faction context
4. **Generation**: LLM produces narrative with inline tags for items, spells, and dice rolls
5. **Tag Parsing**: `[ITEM_GAINED]`, `[SPELL_LEARNED]`, `[ROLL_REQUIRED]` etc. are parsed, stripped, and applied to game state
6. **Memory Extraction**: Every 10 messages, AI summarizes story as structured JSON (character, location, events, NPCs, beliefs, inventory, spells)
7. **Persistence**: Stories auto-save to localStorage, resumable across sessions

### Tag Protocol

The AI emits structured tags at the end of responses. The client parses and strips them:
- `[ROLL_REQUIRED: reason]` — AI requests a d20 roll for dramatic moments
- `[ITEM_GAINED: Name - description]` / `[ITEM_LOST: Name]`
- `[SPELL_LEARNED: Name - description]` / `[SPELL_LOST: Name]`

This pattern is extensible for future mechanics (e.g. `[FACTION_REP]`, `[QUEST_TRIGGER]`).

### Story Entry Points

New players arrive through the cosmic drain (chosen during character creation):
- A dying world — reality collapsed around them
- A spell gone wrong — magic tore them loose
- Pursued by something — running from what no longer exists
- Simply lost — wandered too far, Tasern caught them

First question: *What do you believe?* — because in Tasern, that has consequences.

---

## Technical Architecture

### Desktop App (Primary)
- **Tauri 2.0** - Rust backend, WebView frontend
- **Ollama** - Local LLM for story generation
- **Next.js 14** - Static export for UI
- **WebLLM** - Browser fallback if Ollama unavailable

### Stack
- React 18 + TypeScript
- Tailwind CSS (fantasy theme)
- Web3: RainbowKit, Wagmi (optional)
- State: Zustand (with persist middleware for localStorage)

### Key Files
```
src/
├── components/
│   ├── StoryInterface.tsx      # Main game UI, AI generation, tag parsing, Journal panel
│   ├── CharacterCreation.tsx   # 4-step click-through character creation
│   ├── IntroSequence.tsx       # Narrative intro sequence
│   ├── OllamaSetup.tsx         # Ollama setup wizard
│   └── WebLLMSetup.tsx         # WebLLM download setup
├── state/
│   ├── storyStore.ts           # Story persistence, memory, inventory (Zustand + localStorage)
│   └── webllmStore.ts          # WebLLM preferences
├── hooks/
│   ├── useWebLLM.ts            # Browser AI (WebLLM) with system prompt
│   ├── useLocalOllama.ts       # Browser-direct Ollama
│   └── useTauri.ts             # Tauri API wrapper
└── app/
    ├── page.tsx                # Root page, intro → story flow
    └── globals.css             # Fantasy theme (gold, void, parchment)

src-tauri/
├── src/lib.rs                  # Ollama management (check/start/pull)
└── tauri.conf.json             # App configuration
```

### Commands
```bash
npm run tauri:dev    # Development with hot reload
npm run tauri:build  # Build Windows installer
npm run build        # Static export only
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
- **Honor the source** — James Magee's vision remains core

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
- [x] World context documents (cosmology, factions, geography, moons)
- [x] Tauri desktop app wrapper + Ollama management
- [x] Ollama integration (browser-direct + Tauri)
- [x] WebLLM fallback for offline/browser-only play
- [x] Intro sequence and setup wizard
- [x] Wallet connection (optional, RainbowKit)
- [x] Story interface with streaming AI responses
- [x] Story persistence (save/load to localStorage, auto-save)
- [x] AI memory extraction (periodic summarization of character, location, events, NPCs, beliefs)
- [x] D20 dice roll system (player-initiated + AI-forced via `[ROLL_REQUIRED]`)
- [x] Inventory & spells (AI tags items/spells inline, tracked in store, displayed in Journal)
- [x] Journal panel (toggleable overlay: character info, inventory, spells, NPCs, story summary)
- [x] Click-through character creation (name, origin, belief, faction affinity, starting gift)
- [x] Faction-specific starting gifts (8 unique items/spells tied to faction choice)

**Next**:
- [ ] Faction-reactive NPCs (AI adjusts NPC behavior based on player's faction affinity)
- [ ] Belief accumulation (repeated actions reinforce beliefs, unlock spells/shift reality)
- [ ] Refactor StoryInterface into `useStoryEngine` hook (generation, post-gen hooks, memory extraction)
- [ ] Multiplayer story threads (shared world state between players)
- [ ] Character NFTs with evolving metadata
- [ ] Player-contributed content and canonical lore governance
