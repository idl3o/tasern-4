# Tasern 4 — Future Scope

> A map of the territory ahead, ordered by what makes the game more alive for the player.

---

## Where we are

A player today can:

- Fall through the cosmic drain via a click-through character creation (name, origin, belief, faction).
- Receive a faction-specific starting gift.
- Play an AI-narrated story grounded in Tasern's actual lore (cosmology, factions, geography, moons).
- Roll d20s that matter — the AI weaves the result into the narrative without breaking immersion.
- Accumulate items, spells, and beliefs that the AI remembers and re-uses.
- See their wallet identity reflected in narration ("the sigil precedes them") if connected.
- Resume any story across sessions.

What's missing isn't features so much as **reactivity**. The world responds to *what you do*, but not yet to *who you are becoming*, *who else is in it*, or *how long you've been there*.

---

## Pillars

Everything below serves one of these. If a feature doesn't, it's probably not the next thing.

1. **The world feels alive** — places, factions, and NPCs change whether or not you visit them.
2. **Your choices accrete** — beliefs strengthen, reputations stick, items earn history.
3. **The unexpected is welcome** — rolls fail beautifully, NPCs surprise you, the moons shift things.
4. **Tasern is shared** — eventually, other players' stories are in the world with yours.
5. **Belief is mechanical, not flavor** — what you reinforce begins to bend reality.

---

## Tier 1 — Make the existing loop sing
*One-session impact. The first hour of play improves dramatically. Mostly prompt-engineering and small mechanical additions; no architecture changes required.*

### 1.1 Pre-generated openings while AI loads
The 2GB WebLLM download is currently a wall. Ship 8 hand-crafted opening scenes (one per faction) the player can read while the model loads. They feel productive instead of stuck on a progress bar.

### 1.2 Richer tag protocol
Add tags the AI already wants to emit:
- `[LOCATION: name - region]` — explicit location changes (better than waiting for memory extraction).
- `[TIME: dawn|noon|dusk|night|...]` — time-of-day so the world feels temporal.
- `[NPC_MET: Name - faction, one-line vibe]` — promote NPCs into a structured list.
- `[NPC_RELATIONSHIP: Name - shift]` — relationships compound, not just exist.
- `[FACTION_REP: Faction - +1|-1]` — reputation with the eight factions starts to matter.
- `[BELIEF_TESTED: belief]` — the AI signals when a player's stated belief was put to the test (whether they upheld or betrayed it).

### 1.3 Combat that has weight
Right now combat is narration + a single d20. Player experience improvement:
- Multi-round encounters that don't end on one roll.
- Health/wound state ("you're bleeding, your vision narrows") tracked in the journal.
- Items can break or be used up in combat.
- The AI emits `[COMBAT_START]` / `[COMBAT_END]` and the UI adapts.

### 1.4 Moon-cycle modifier
Pick a moon ascendant per session (or per real-world day). Inject into the prompt:
- White Moon → harsher failures, more predators, scarcity.
- Green Moon → wilder growth, the natural world louder.
- Blue Moon → boundaries dissolve, pirates emboldened, weather chaotic.

Tiny mechanic, huge atmosphere shift. Already grounded in `content/moons.md`.

### 1.5 Belief-tested dice modifier
When the AI emits `[BELIEF_TESTED]`, give the player a temporary +2 or -2 to their next roll depending on whether they acted in line with their dominant belief. *Acting on what you believe makes you better at it. In Tasern, this is literal magic.*

### 1.6 Better failures
A natural-1 currently just narrates failure. Player-experience win: critical failures should sometimes open *different* paths, not just close one. ("Your blade shatters — but the shards lodge in the wall in a pattern that looks like writing.") Adjust prompt to lean into generative failure.

---

## Tier 2 — Make a single character feel like a lifetime
*Multi-session impact. A returning player feels something accumulating that wouldn't have if they'd started fresh.*

### 2.1 Persistent NPCs across stories
Right now NPCs live in one story's memory. Promote them to a player-level table — meet Brann the Smith in story 1, encounter him in story 3, the AI remembers what passed between you. Cross-story memory is what separates "interactive fiction" from "your character has a life."

### 2.2 Chapter / arc structure
Break long stories into chapters: Act 1 (arrival), Act 2 (immersion), Act 3 (consequence). AI signals `[CHAPTER_END]` when stakes resolve. New chapters get a "what came before" recap and may introduce a new region. Gives the player a sense of arc, not just drift.

### 2.3 Belief-strength unlocks
Beliefs already accumulate silently. Surface threshold moments: at strength 5 of a belief, the AI grants a related spell or open door. ("You have believed *strength overcomes all* through a hundred trials. The world begins to expect it of you.") The Journal panel announces the unlock.

### 2.4 Items with history
Right now an item is `{ name, description }`. Add a `history` field that records the first acquisition context and notable uses. "Stoneheart Ring — found in the snow at Skrim, warmed when you faced the Igypt cleric." Items become characters.

### 2.5 Reputation visible in the world
Once `[FACTION_REP]` tags are in (Tier 1.2), high reputation should change the prompt: Elven NPCs greet you by name, Ork patrols are more aggressive, Pirate captains offer you berths. The Journal shows your standing with each of the eight powers.

### 2.6 Death and legacy
When a character dies (a critical failure in life-or-death moments), the story ends — but their items, NPCs known, and dominant beliefs become accessible to the player's next character as "echoes." *In Tasern, the dead leave traces.*

---

## Tier 3 — Make Tasern a place, not a screen
*The world has things happening regardless of any one player. Soft multiplayer / shared canon.*

### 3.1 Living world events
A daily cron-style update generates 3-5 world events ("The Orks have sieged a Skrim fortress." / "A new prophet rises in Manlan."). All players' next sessions can reference current events in their narration. No coordination needed — just shared atmosphere.

### 3.2 Shared NPCs
The most-referenced NPCs across all players become canon. James Magee or a curator gets a periodic digest of which characters players are converging on; ratify the ones that should persist into world canon.

### 3.3 Player-driven canon votes
Players can submit "remembered events" from their stories. Community votes on which become true for everyone. Tasern's "belief is magic" rule applied to actual gameplay — what enough players believe happened, *did*.

### 3.4 Multiplayer story threads
Two or more players in the same story, same scene. Easier than it sounds: shared message history, both can act, the AI narrates for both. Friend invite via story share link.

### 3.5 Trade and gift between characters
Wallets enable player-to-player item transfer. Your Stoneheart Ring can be gifted to a friend's character. Items earn history across owners.

---

## Tier 4 — Make the wallet matter (real Web3, not decoration)
*Currently the wallet is narrative flavor. This is where it earns its place.*

### 4.1 Faction token gating
Each of the eight currencies ($EGP, $DDD, $PKT, etc.) unlocks faction-specific content:
- Hold $EGP → Elven NPCs treat you as kin; access to Elpha-only quests.
- Hold $OGC → Ork foundries open their gates.
- Hold balanced amounts across factions → diplomat archetype, unique dialogue.

Simple `useBalance` reads, no contracts required by us — the AI just sees the holdings in the prompt and reacts.

### 4.2 Character NFTs with evolving metadata
At a checkpoint (say end of chapter 3), mint a character NFT whose metadata reflects the journey so far: belief strengths, faction reputations, key items, dominant location. Trading the NFT trades the character.

### 4.3 Item NFTs for canon-worthy gear
Items that survive long enough or get used in pivotal moments become mintable. Provenance on-chain: who owned this blade across which characters, what it did.

### 4.4 Faction treasury / governance
Holding $DHG (Dragon Hoard Gold) gives you a vote on dragon-related canon. Holding $BTN (Druid) gives you a vote on what flourishes or rots. Token-weighted lore stewardship.

### 4.5 Creator royalties
Players whose contributed content (NPCs, locations, items, lore) becomes canon receive a small recurring stream. Aligns "good for the world" with "good for the contributor."

---

## Tier 5 — Sensory and access polish
*The game already feels good. These make it feel inevitable.*

### 5.1 Ambient audio
Location- and faction-driven soundscape. Skrim has wind and distant bells. The Tear's wound is a low, never-resolving chord. Belief shifts cue subtle musical motifs. Royalty-free composer or commission.

### 5.2 Image generation for key moments
The AI emits `[SCENE: description]` at dramatic beats. A local image model (or hosted) generates an illustration that anchors the moment. Stored with the story.

### 5.3 Voice narration
Text-to-speech for the narrator. The right voice — slow, weathered, with the weight Tasern asks for — would push this from "interactive fiction" to "campfire."

### 5.4 Mobile
The whole experience should work one-handed on a phone. Currently the Journal panel and dice UI are desktop-shaped.

### 5.5 Settings panel
- Model selection (currently hardcoded).
- Narrator temperature ("more poetic" / "more grounded").
- Toggle dice visibility (some players want pure narrative).
- Export story to PDF or shareable web page.

---

## Tier 6 — Worldbuilding tools
*For James Magee and a small curator group, not players.*

### 6.1 Lore admin
A small panel that lets the world's stewards edit `content/*.md` and see prompt-level changes immediately. Avoids requiring code deploys for canon additions.

### 6.2 Player-contributed lore review
Inbox of player-submitted canon proposals (from 3.3) with diff view and approve/reject.

### 6.3 Faction event scheduler
GUI for adding world events (3.1) that appear in upcoming sessions.

---

## What we are *not* doing (yet)

- **Real-time combat or tactical encounters.** Tasern 3 had a battle engine. We could port it. We won't, because narrative combat with weight (Tier 1.3) carries more atmosphere than a grid.
- **Procedural map generation.** The lore-driven regions in `content/geography.md` are richer than any procgen would be. Surface what's there before inventing more.
- **Server-side AI.** Local-first (Ollama / WebLLM) is a core constraint. We keep it that way until and unless a specific feature requires it (e.g. shared world events in 3.1 would, narrowly).

---

## Suggested sequencing for the next 4–6 sessions

1. **Tier 1.2 + 1.4** — richer tag protocol + moon-cycle modifier. Highest atmosphere-per-line-of-code.
2. **Tier 1.3** — combat with weight. The most-asked-for feature in any AI-narrated game.
3. **Tier 2.3 + 2.5** — belief-strength unlocks + visible reputation. The accumulation pillar starts paying off.
4. **Tier 4.1** — faction token gating. The Web3 layer earns its keep, narrowly and well.
5. **Tier 2.1** — persistent NPCs across stories. The single biggest "this character has a life" lever.
6. **Tier 3.1** — living world events. Tasern becomes a place rather than a private hallucination.

After that, the priority order should be informed by what players actually do — what they ask for, what they ignore, what surprises us.
