# Tales of Tasern: A Bucket List

**Everything that becomes possible between a private narrator and a shared D&D-style chat on a hosted Tasern universe**

S. Lavi · Draft of 4 November 2026 · written against commit `763741a` (main)

> Companion to `WHITEPAPER.md` (where the project stands, and why) and `FUTURE.md` (an atlas of features). This is neither a schedule nor a gate sequence. It is a list of things Tasern could do, each stated as the experience it gives a player or a Dungeon Master, with what it rests on and what it opens. The list ends at one destination, and most items are worth having whether or not the destination is ever reached. References of the form W§2.3 point into the whitepaper.

---

## The destination, so the list has a shape

A party of players at one table in a chat. A narrator, usually a language model and sometimes a human Dungeon Master, describes a scene in Tasern. Each player says what their character does. Dice are rolled where the outcome is uncertain. The narrator resolves the round for everyone. The table is one of many, all playing in a single hosted Tasern whose factions, moons, regions and belief field are shared, so that what a party does in Skrim is weather in Manlan, and what enough tables hold true becomes true for all.

One thing changes on the way there. The whitepaper's constraint, *no story is generated anywhere but on the player's hardware*, cannot survive a hosted universe as written. Its honest restatement: **the world is hosted; the narrator is local to the table; no paid API ever narrates Tasern.** One seat at every table is the narrator seat, filled by a player whose machine runs a model; the server relays prose, it never writes it. That restatement is a decision for the author, not for this document.

---

## I. Within reach now

*Each of these is a session or two from the current main, and each makes the present more honest. They are prerequisites for the rest only in the sense that building the rest on top of them is cheaper than building it twice.*

**□ Replay any story, roll for roll.**
A seed stored on the story; every d20 and every "fate stirs" drawn from it. A saved story becomes a reproducible rules trace even though its prose was never reproducible. Rests on: `src/lib/rng.ts`, a `seed` on `SavedStory`, a v4 migration (W§4.1). Opens: everything shared or auditable further down this list.

**□ Know which models can narrate, by evidence.**
One tag grammar in one module; unknown `[WORD: …]` constructions stripped at the boundary; a golden fixture per model; `npm run playtest` regenerating a compliance table kept in the repo. The starter model is chosen from the table, not from habit (W§2.2, W§4.2). Opens: a narrator seat that only models with a passing score may fill.

**□ Read the engine in under an hour.**
`useStoryEngine.ts` into generation, post-generation effects and memory; `StoryInterface.tsx` under the project's own 500-line bar. Opens: the event-log pivot below, which is otherwise surgery on a thousand-line hook.

**□ Play in the browser on Gemma 4 with an 8k window.**
Draft #8, mergeable once web-llm 0.2.87 clears the release-age gate on 6 November, with its token estimator collapsed into `lib/chapters.ts` (W§2.9).

**□ Trust the configuration docs.**
`.env.example` loses the server-tier variables nothing reads (W§2.10).

---

## II. A single character with a life

*Multi-session depth. Nothing here needs a server.*

**□ A story is a log of events, and a table is a story with more seats.**
Replace the message array with an append-only `TableEvent` union (`player.declared`, `narrator.replied`, `roll.requested`, `roll.resolved`, `item.gained`, `chapter.closed`, `dm.ruled`, …) and pure reducers to the transcript, journal, open turn and memory. Single-player is a one-seat table whose log lives in `localStorage` exactly as now. Existing stories migrate message by message; a golden replay test proves a player cannot tell. This is the architectural pivot of the whole list: once it holds, hosting is a question of where the log is appended and who may append.

**□ Meet Brann the smith again, three stories later.**
Memory in layers: chapter summaries as a list, an NPC table at the player level, item histories recording first acquisition and notable uses. `[NPC_MET]` and `[LOCATION]` join the grammar; extraction becomes reconciliation rather than a fresh summary (W§4.4). Memory splits into **character memory**, which belongs to the player and travels, and **scene memory**, which belongs to the story. Opens: a party, since at a table each seat brings its own memory and the table has another.

**□ Die, and leave an echo.**
A character's death ends the story but leaves items, known NPCs and dominant beliefs reachable by the player's next character. Rests on the layered memory above. From `FUTURE.md` §2.6; it belongs on any list of what Tasern should do.

**□ Belief that unlocks.**
Threshold moments on affinity strength: at a named level the narrator is told to grant a related spell or open a door, and the journal announces it. The mechanic already exists in the modifier; this makes it visible.

**□ Combat with weight.**
Multi-round encounters, a wound state in the journal, items that break. `[COMBAT_START]` and `[COMBAT_END]` in the grammar so the UI can tighten. Narrative, not a grid (W§5).

---

## III. Belief made computable

*The founding rule, "what enough minds hold true becomes true", as mechanism rather than flavour. Parallel to everything else; takes up a session whenever one suits.*

**□ Contradictory truths that coexist by region.**
A belief field per region instead of one for all Tasern, with diffusion between neighbours. The narrator receives the local field: the elven and the draconic creation myths are both true, each where it is believed (W§4.3).

**□ A reality shift that is a global agreement.**
Ascendancy fires only when a majority of regions agree above threshold. Local shifts bend one region; the global one changes the age. Property tests: total field conserved under diffusion, no shift fires twice from one crossing. The structure is the one this author studies elsewhere as a consistency condition on overlaps; here it is an engineering direction.

**□ A moon that is the same moon everywhere.**
Trivial once the world is hosted (below); listed because it is the first thing a second player will notice.

---

## IV. A hosted Tasern

*The server owns the world and the logs. It never generates prose. Supabase is the assumed backend: Postgres, Realtime, Auth, scheduled functions, row-level security; the author's default and sufficient at this scale.*

**□ One world for everyone, offline still works.**
`WorldState` moves to a single versioned row; clients post affinity deltas and read the summary into the prompt; a scheduled function runs `advanceWorld` over the summed deltas of every client. `advanceWorld` is pure and already runs in Node; it moves without change (W§2.5). Each client keeps a local replica for offline play and reconciles by a merge that is commutative, associative and idempotent, property-tested on all three (W§4.5). Two players on two machines watching one reality shift fire from their combined belief is the demonstration.

**□ Export a world; import a world.**
A versioned schema parsed at the boundary. Also the backup, also the way a steward resets a region by hand.

**□ Be someone without registering.**
Identity as a display name and a device key in local storage. Accounts and wallets attach to it later; nobody registers to play alone.

**□ The Chronicler dreams for the whole world.**
The dreamer's one or two prose events per tick run once, on the fallback narrator (below), and land in the shared world log that every table reads.

**□ A fallback narrator the project controls.**
A model on hardware the author owns, for tables with no capable host and for the dreamer. Uptime stated as best-effort. Hosted GPUs declined until a table has needed the fallback more than once; a universe that leans on project hardware drifts toward the paid API by economics.

---

## V. The table

*The first shared scene.*

**□ Open a table, send a link, take a seat.**
A lobby; invite-only tables; a character per seat. The table's event log is hosted and Realtime carries appends to every seat, which reduce it exactly as the solo client does.

**□ The host brings the narrator.**
The narrator seat's client composes the round, generates through its own Ollama, and streams `narrator.replied` events through the server. If the host leaves, the seat offers itself to another capable player, then to the fallback narrator. Only models with a passing compliance score may fill the seat.

**□ Everyone declares; the narrator resolves the round.**
The narrator sets the scene. Each seat declares one action or passes; the round closes when all have declared or a host-set timer expires. One reply resolves the round for all. Per-seat tags join the grammar: `[ROLL_REQUIRED: @Name reason | approach:combat]`, `[ITEM_GAINED: @Name …]`, `[CHOICE: @Name …]`. Each named seat rolls from the table's seed sequence; the narrator continues once every requested roll is in.

**□ Chapters that fit a party.**
Four characters' memories and declarations fill the window faster than one. The chapter ratios become per-table settings with the solo values as defaults; per-seat character memory is reduced to a paragraph each before composition. Measured before tuned.

**□ Know exactly what leaves your machine.**
Joining a table sends declarations and character memory to the other seats and to the server; playing alone sends nothing. Said at the point of joining, never weakened by a default.

**□ Watch from the back of the room.**
Spectator seats, read-only. Cheap once the log is hosted.

**□ Reopen the table next week.**
Persistent parties: a table closes and reopens with log, seats and chapter history intact.

---

## VI. The Dungeon Master's seat

*The world has an author. The table should have a chair for him.*

**□ A human DM who narrates, rules, and intervenes.**
A DM seat whose holder can `dm.narrate` (prose appended as the narrator's), `dm.ruled` (force or forbid a roll, grant or remove an item, set a modifier) and `dm.event` (inject an event into the table or, with steward rights, into the world). With a DM present the model drafts and the DM approves, edits or replaces before the round is appended.

**□ Edit canon without a deploy.**
A lore panel reading and writing `content/*.md` with a prompt preview, writing through a pull request or a signed commit so canon keeps a history (W§4.7).

**□ Schedule the world's weather.**
A world-event scheduler for the hosted tick: the Orks besiege a Skrim fortress on Thursday, and every table's Thursday round knows it.

**□ Ratify what the tables made true.**
A digest of the NPCs and events that tables are converging on, for the steward to accept into the lore files. The next table enters a world carrying what earlier tables believed.

**□ James Magee runs a session.**
A party of three, the model drafting, the author of the world in the DM seat. Not a milestone; the point.

---

## VII. The destination

**□ Shared D&D-style chat on the hosted Tasern universe.**
Public tables beside invite-only ones, a lobby showing where in Tasern each table is playing, world events crossing tables, the moons the same everywhere, the canon digest feeding the lore. Three concurrent tables over a weekend, one with a human DM, and a reality shift that no single table could have fired. Public tables wait on a content-safety answer: a local model has no filter and a public table has strangers; a report-and-remove path and a stated policy are the minimum, and whether that is enough is the author's call.

---

## VIII. Beyond it

*Worth having; not on the road.*

**□ See the scene.** `[SCENE: …]` tags rendered by local SDXL on the narrator seat's machine and shared through the table log (W§4.6).
**□ Hear the narrator.** Kokoro or Piper on each client; the campfire register.
**□ Weather you can hear.** Ambient sound by region and ascendant moon, from data already in `WorldState`.
**□ A wallet as one more key.** Optional identity on the device key; faction holdings read as reputation in the prompt; token-weighted canon votes only after the digest exists; provenance for items with histories only after memory has layers (W§4.8). Never required to sit down.
**□ Items with a lineage across owners.** Gift the Stoneheart Ring to a friend's character; its history follows it.
**□ Play on a phone, one-handed.** The table is a chat; a chat should fit a hand.

---

## Not on this list

- **A paid API in the narrator seat**, including as fallback.
- **Peer-to-peer tables.** Tasern 3's PeerJS service was read and set aside: a persistent universe needs a store regardless, NAT traversal costs sessions, and the free signalling server is a third party by another name.
- **A full D&D ruleset.** Four approaches, one die, belief as advancement.
- **Typing indicators, voice chat, video.** The table is a chat.
- **Procedural geography; a grid combat engine** (W§5).

---

## Decisions the list waits on

1. Restate the local-first constraint as above and amend W§5.
2. Supabase as the backend, or a small owned service.
3. Device-key identity first, accounts later.
4. Fallback narrator on the author's own hardware, best-effort, or none.
5. Public tables at the destination, and the content-safety policy they need.
6. The steward role: James Magee's rights over canon, and lore in the repo versus in the database.

---

Written against `763741a` on main, 4 November 2026, alongside the whitepaper of the same date. The Tales of Tasern setting is the creation of James Magee. Copyright (c) 2026 S. Lavi, MIT Licence.
