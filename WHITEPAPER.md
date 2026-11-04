# Tales of Tasern: What a Local Narrator Has Taught Us

**A whitepaper on the present position of Tasern 4, and on the horizon it opens**

S. Lavi · Draft of 4 November 2026 · written against commit `4842910` (main)

> This document replaces the earlier technical whitepaper, which described a server tier (`/api/story`, an Anthropic fallback, an admin dashboard) that no longer exists. The code has had no server-side generation since the local-first decision; the old text survives in git history.

---

## Abstract

Tasern 4 is an interactive-fiction engine in which a language model running on the player's own machine narrates a world whose founding law is that belief becomes real. Ten months of building have produced a working loop: character creation, streaming narration from one of two local backends, a tag protocol by which the narrator alters game state, a d20 layer with belief-derived modifiers, a deterministic world simulation that the narration colours, and a chapter structure that turns the model's context window from a failure mode into a dramatic form.

This paper collates what that work has established, states plainly what remains unverified or in debt, and sets out the directions in which the project can expand without abandoning the constraint that made it interesting: no story is generated anywhere but on the player's hardware.

---

## 1. Position

### 1.1 What runs today

| Layer | Mechanism | Where it lives |
|---|---|---|
| Narration | Streaming chat against Ollama (desktop and browser) or WebLLM (browser); the player's chosen model, warmed before the first turn | `src/lib/ollama/`, `src/hooks/useLocalOllama.ts`, `src/hooks/useWebLLM.ts` |
| Transport | Browser: direct HTTP, opened by the player's Connect click wherever the browser asks before a public page may reach their machine (Chrome and Edge). Desktop: a Rust proxy that sends no `Origin` header, so Ollama's CORS policy never refuses the packaged app | `src/lib/ollama/transport*.ts`, `src-tauri/src/ollama_proxy.rs` |
| Prompt | World lore, faction lore (full for the player's affinity, brief for the rest), region lore for the current location, moons, the living world's summary, story-so-far memory, and the tag protocol | `src/lib/prompt.ts`, `content/*.md` |
| Tag protocol | `[ROLL_REQUIRED]`, `[CHOICE]`, `[ITEM_GAINED]`, `[ITEM_LOST]`, `[SPELL_LEARNED]`, `[SPELL_LOST]`, `[WORLD_EVENT]`; parsed and stripped client-side | `src/hooks/useStoryEngine.ts`, `src/lib/world/dreamer.ts` |
| Resolution | d20 with a modifier earned by acting through one of four approaches (Combat, Perception, Nature, Chaos); natural 1 and 20 always crit; a self-pacing "fate stirs" backstop when the narrator stops asking for rolls | `src/lib/rolls.ts` |
| World | One global, serialisable `WorldState`: a belief field over the four approaches, eight faction standings, fourteen regions, a rotating ascendant moon, a capped event log, and reality shifts that fire when belief crosses a threshold. Pure and deterministic; a bounded "dreamer" generation adds one or two prose events per tick | `src/lib/world/` |
| Memory | Every ten messages the model summarises the story to JSON (character, location, events, NPCs, beliefs, summary); items and spells remain authoritative from tags | `useStoryEngine.ts`, `src/state/storyStore.ts` |
| Chapters | The narrator is steered toward a climax at 70 % of the context budget and the chapter is closed at 85 %; the next chapter opens in a fresh window carrying only the summary | `src/lib/chapters.ts` |
| Persistence | Zustand with per-story `localStorage` keys, a quota guard, versioned migration (v3), and a separate small world blob | `src/state/*.ts` |
| Wallet | Built, cordoned off. Loads only by dynamic import when `NEXT_PUBLIC_ENABLE_WALLET=true` in a non-Tauri build | `src/lib/wallet/` |

Verification at this commit: 77 tests pass (5 skipped: live Ollama tests that need a running server), `tsc --noEmit` is clean, both `next build` targets passed at the preceding commit. The web build is live on Vercel.

### 1.2 How it got here

The history divides into three movements.

- **January to May 2026.** A web-first AI Dungeon analogue: WebLLM primary, Ollama as an "advanced" option, wallet as identity, server fallback to a paid API. Character creation, dice, inventory, persistence.
- **July 2026.** A review remediation (PR #1) hardened persistence, Tauri security and the engine, then five pull requests in two days gave the game its mechanical spine: belief-modified rolls on uncertainty with suggested moves (#2), the stochastic backstop (#3), player-declared attempts (#4), the world simulation (#5) and chapter breaks (#6).
- **November 2026.** The Ollama overhaul (#7): a typed client with boundary parsing, a Rust proxy, model ranking, pull-with-progress, warm-up, navigation coverage of every route that found six bugs, and the wallet cordon. Draft #8 refreshes the browser model and waits on a dependency's release-age gate.

The server tier was removed along the way. There is now no path by which a story leaves the player's machine.

---

## 2. Findings

What follows is what the work established. Each item names the evidence.

### 2.1 The context window is the governing constraint, and it is a dramatic one

An LLM narrator plays against a bounded window. Left alone it degrades silently: the opening scenes fall out of view, names drift, the narrator contradicts itself. The project's answer was not to summarise harder but to make the limit a structure. At 70 % of budget the narrator is told the chapter is drawing to a close; at 85 % it is told to deliver the climax now; then a divider is written, the story is summarised, and the next chapter opens in a clean window with only the summary as continuity. The reader sees acts; the engine sees garbage collection. The constants (`CONTEXT_TOKENS = 8192`, `WIND_DOWN_RATIO = 0.7`, `CHAPTER_CLOSE_RATIO = 0.85`) are named for playtest tuning and are the single source of truth for Ollama's `num_ctx`.

A corollary found in testing: Ollama already truncates oldest turns and keeps the system prompt, so fitting history to `num_ctx` client-side was dropped as redundant. The browser backend (WebLLM) rejects an over-long prompt rather than truncating it, so there the fitting is needed, and draft #8 carries it. Two estimators now exist and must become one.

### 2.2 The tag protocol is a contract with a party that did not sign it

The narrator alters game state by emitting bracketed tags. Compliance is a property of the model, not the prompt. A scripted six-turn playtest on 2 November gave:

| Model | Protocol-compliant turns | Rolls requested | Notes |
|---|---|---|---|
| gemma4:latest | 6 / 6 | 0 | Lore-grounded, ~0.3 s to first token when warm, ~7 s per turn |
| llama3.2 | 1 / 6 | — | Never emits `[CHOICE]`; invents tags (`[PERCEPTION: …]`, `[CHAUSSURE: …]`) that reach the player raw |

Two consequences. First, the starter model: the setup wizard and the web instructions named llama3.2 until 4 November and now name gemma4, at roughly three times the first download. Second, the parser owns the grammar only for tags it knows. Unknown `[WORD: …]` constructions are a boundary problem: they are untyped output and should be parsed or stripped at one place, not allowed through as prose. The decision between stripping and parsing them is open.

### 2.3 Rolls are scarce unless the rules guarantee them

Asked to roll only when the outcome is genuinely uncertain, a capable model requests almost no rolls. The dice layer cannot depend on the narrator's goodwill. The "fate stirs" backstop gives the rules side a guarantee: after two calm turns the chance of a world-intrusion check rises by 15 points a turn to a ceiling of 85 %, and the intrusion prompt instructs the narrator to build to a decisive moment and stop. Self-pacing avoids both clusters and droughts. The general lesson: anything the game needs to happen must be enforced by the rules engine, and the model asked only to dress it.

### 2.4 Closed vocabularies mechanise; open ones only colour

Belief exists twice in the store. `beliefStrengths` is keyed by free text extracted from the story and feeds the prompt as "dominant beliefs". `affinityStrengths` is keyed by the four approaches, reinforced every time the player acts through one, and drives the d20 modifier (+1 per two reinforcements, capped at +5). Only the second became a mechanic. It also became the world simulation's input: the belief field is the per-approach delta of the player's affinity totals. The design principle extracted: a quantity bends reality only when its domain is finite and typed. Free-text beliefs are atmosphere until a mapping into a closed vocabulary exists.

### 2.5 Rules tick first; the model decorates

`advanceWorld` is a pure function: decay the field, fold in the delta, drift aligned factions up and others toward the 50 baseline, advance the Orks structurally, rotate the moon every four ticks, fire at most one reality shift and dampen the field so it does not refire. It has no IO and no randomness. The dreamer, the only stochastic element, runs afterwards, is bounded to two events, tolerates malformed output by falling back to the first sentence, and is skipped entirely when no model is available. The world remains consistent whether or not a narrator answers. The `WorldState` type was shaped from the start to be lifted to a shared backend without a gameplay rewrite; that intention has not yet been tested by lifting it.

### 2.6 Local-first has a cost structure, and it can be named

Running the model on the player's machine means the application must find it, pull it, load it, keep it loaded, and explain every way that fails. The overhaul produced:

- an error union of nine kinds (`unreachable`, `origin-blocked`, `loopback-denied`, `model-missing`, `out-of-memory`, `stalled`, `aborted`, `server`, `protocol`), matched exhaustively, each with a sentence the player can act on;
- stall detection by idle watchdog, distinguished from cancellation;
- warm-up on model selection with the same `num_ctx` as the chat requests, because a mismatch forces a reload (measured: 4.33 s against 0.00 s);
- model ranking by name prefix that excludes reasoning-first models, which spend the reply budget thinking and cannot be told not to;
- `OLLAMA_HOST` parsed exactly as Ollama's own CLI parses it;
- a proxy, because the packaged app's origin `http://tauri.localhost` is refused by Ollama's default CORS policy;
- a connect gesture in the browser build, because Chrome and Edge from version 142 ask the player, on the first attempt, whether a public page may reach their own machine. The probe on page load that preceded it put that question to every visitor unexplained, and reported a refusal as Ollama being absent. Nothing is now probed until the player clicks Connect, the browser's own refusal is a typed failure of its own, and the setup steps are the ones Ollama's documentation gives for each operating system.

None of this is narrative. All of it is what "the narrator considers" costs.

### 2.7 Dependencies phone home, and module scope is a liability

Building the wagmi configuration opens WalletConnect's relay socket. Imported statically, that made the desktop app contact a third party it had no reason to reach. Under `next dev`, which re-evaluates server modules on every rebuild, and with WalletConnect Core offering no teardown, each hot reload added a live relay client; a dev server left overnight reached 100 GB of commit and crashed the compositor. The fixes are structural: the wallet loads only by dynamic import behind a flag, and the configuration is kept once per process on `globalThis`, guarded by a test that re-evaluates the module and asserts the same instance. The lesson generalises past wallets: any dependency with side effects at construction time is gated, not imported.

### 2.8 Route coverage finds what unit tests cannot

Two test files walk every navigation route of the web and desktop builds (the desktop one fakes the Tauri internals rather than mocking the module, which loaded it twice). They found six bugs on the first run, among them that exiting mid-reply blocked the next story (now one `AbortController` per reply, with the signal reaching Ollama) and that a persisted active-story id resurrected the wrong story. Not yet fixed: WebLLM generation is not interrupted on exit; the stream is simply no longer read.

### 2.9 A release-age cooldown is a forcing function

The machine installs nothing published within seven days. Draft #8 therefore sits on web-llm 0.2.86 until 0.2.87 clears on 6 November. The wait surfaced something the release notes omit: 0.2.86's prebuilt model libraries predate a fix for a shared-memory race in the sampling softmax that made sampled tokens wrong at random. Merging on the older version would have shipped a silently faulty narrator. The cooldown bought the time to read the upstream commit log.

### 2.10 Documentation drifts faster than code

The previous whitepaper and `.env.example` both describe the server tier and the paid fallback. Neither exists in `src/`. The README is current; the whitepaper was not. This document is dated and names its commit for that reason.

---

## 3. Debts and unverified claims

Stated without recuperation.

- **Determinism.** `rollD20`, `fateStirs` and the UUID fallback use `Math.random()`. The world simulation is deterministic; the dice layer is not. A story cannot be replayed, and nothing built on shared or auditable state can rest on it until rolls are drawn from a seeded generator recorded in the story.
- **Module size.** `useStoryEngine.ts` (976 lines) and `StoryInterface.tsx` (768 lines) exceed the project's own bar of 500. The engine is the next candidate for decomposition into generation, post-generation effects, and memory.
- **Two token estimators.** `lib/chapters.ts` and draft #8's `contextBudget.ts` each estimate tokens as characters over four. One must go.
- **Unverified in the real thing.** A packaged `tauri:build` reaching Ollama through the proxy; the new setup UI in a real WebView; Gemma 4 E2B accepting an 8192 context in a WebGPU browser; the f32 fallback path.
- **Starter model.** Settled 2026-11-04: the setup wizard and the web instructions name gemma4, which scored 6 / 6, at the cost of a first download of about 7 GB against llama3.2's 2 GB. llama3.2 stays on the ranking list for players who already have it.
- **Unknown tags.** Strip or parse is undecided; until then a non-compliant model leaks brackets into prose.
- **The "world" is one player's.** `WorldState` is global in name but local in fact: it lives in one browser's storage and is fed by one player's affinities. The multiplayer claim in older documents is an intention.
- **Playtest harness.** The scripted six-turn harness lived in a session scratchpad; on 4 November its root config was deleted rather than promoted. The figures in §2.2 cannot be regenerated from the repository.
- **Stale configuration.** `.env.example` still documents `ADMIN_PASSWORD`, `ANTHROPIC_API_KEY`, `LOCAL_LLM_URL` and `PREFER_LOCAL_LLM`, none of which the code reads.

---

## 4. Horizon

The constraint that defines the project (nothing generated off the player's machine) is kept throughout. Each direction below names the mechanism and the first step, and is ordered by how much it builds on what already stands.

### 4.1 A seeded rules engine

Replace `Math.random()` in the dice and fate layers with a seeded generator whose seed is stored on the story and advanced per draw. Record the model tag and quantisation alongside it. A story then has a reproducible rules trace even though its prose does not, and every later direction that needs auditable state (shared worlds, canon votes, provenance) becomes possible. Property tests: same seed, same sequence; a natural 1 or 20 crits regardless of modifier; `fateChance` is monotone in calm turns and bounded by `FATE_MAX`. First step: `src/lib/rng.ts` and a `seed` field on `SavedStory` with a v4 migration.

### 4.2 The tag protocol as a grammar

Move all tag parsing to one module with a formal grammar: known tags typed, unknown `[WORD: …]` constructions classified and stripped at the boundary, every fixture from every supported model kept as a golden file. Promote the playtest harness to `npm run playtest` and make the compliance table in §2.2 a repo artefact that each model change regenerates. Decide the starter model from that table, not from habit. This is the cheapest expansion with the largest effect on what the player actually sees.

### 4.3 Belief as a field with locality

The belief field is today a single vector over four approaches for the whole of Tasern. The lore says contradictory truths coexist by region: the elven and draconic creation myths are both true, somewhere. The natural extension is a field per region, with the narrator receiving the local one. A reality shift then has two readings: a local section (one region's belief bends its own reality) and a global one (the local sections agree, and the world changes). The second reading is a consistency condition on overlapping regions, which is the structure this author studies elsewhere as sheaf cohomology; here it is offered as an engineering direction, not a theorem. First step: `beliefField: Record<RegionId, Record<Approach, number>>`, a diffusion term between adjacent regions, and the shift rule rewritten so that global ascendancy requires agreement above threshold in a majority of regions. Property tests: conservation of total field under diffusion, no shift fires twice from one crossing.

### 4.4 Memory with layers

Replace the single rolling JSON summary with a layered memory: chapter summaries kept as a list, an NPC table at the player level rather than the story level, and item histories (first acquisition, notable uses). This is what lets Brann the smith met in one story be recognised in a third. The `[NPC_MET]` and `[LOCATION]` tags proposed in `FUTURE.md` are the inputs; the extraction prompt becomes a reconciliation rather than a fresh summary. The memory module is also the right home for the second half of the engine decomposition owed in §3.

### 4.5 Shared Tasern, local-first

`WorldState` was designed to be lifted. Two routes keep the constraint. The first is a merge: each player's world is a replica, and a commutative, associative, idempotent merge (belief fields summed with decay, standings averaged, event logs unioned by id) produces a shared Tasern when replicas meet, by file, by link, or by a thin relay that stores blobs and never generates. The second is a small authoritative service that owns only the world tick and receives affinity deltas. The first is more in keeping with the project; the second is simpler. Either way the first step is the same: an export and import of `WorldState` with a versioned schema, parsed at the boundary, and a `mergeWorlds` function with property tests on the three algebraic laws. "What enough minds hold true becomes true" then has an operational meaning: the belief field a player sees is the sum of every player's.

### 4.6 Sensory expansion, still local

The narrator can emit `[SCENE: …]` at dramatic beats; a local SDXL pipeline (the author's text-to-video work already runs one on this hardware through ComfyUI) can render the scene and store it with the message. Voice narration through Kokoro or Piper gives the campfire register. Ambient soundscape by region and ascendant moon follows from data already in `WorldState`. None of these need a server. All of them need the determinism of §4.1 if images are to be reproducible from a story file.

### 4.7 Tools for the steward

The lore lives in four Markdown files and is read into the prompt at build time. James Magee, as the world's author, should be able to edit canon and see the prompt change without a deploy: a lore panel in the desktop build that reads and writes `content/*.md` with a prompt preview. Once §4.5 exists, the same panel receives a digest of the NPCs and events players converge on, for ratification into canon.

### 4.8 Web3, through the narrow door

The wallet stays cordoned until there is shared state worth anchoring. The order is: shared world (§4.5), canon ratification (§4.7), and only then token-weighted votes on canon and provenance for items that have earned a history (§4.4). The eight faction currencies enter first as read-only reputation in the prompt, never as a requirement to play. Any contract follows the author's other mechanism-design work: integer amounts, stated rounding, property-tested invariants.

### 4.9 Suggested order

1. §4.1 seeded rules, §4.2 tag grammar and compliance table, and the engine decomposition owed in §3. These make the present honest.
2. §4.4 layered memory. The single character begins to have a life.
3. §4.3 regional belief. The founding rule becomes computable.
4. §4.5 shared Tasern by merge. The world becomes a place.
5. §4.6 to §4.8 as the shared world earns them.

---

## 5. What Is Declined

- **Server-side generation.** No cloud model, no paid fallback, no relay that generates. A relay that stores and forwards world blobs is the only server contemplated, and only for §4.5.
- **Procedural geography.** Fourteen regions from the lore are richer than anything generated. The map grows by authorship.
- **A grid combat engine.** Tasern 3 has one. Narrative combat with wounds, stakes and item attrition carries more atmosphere than a grid and stays inside the tag protocol.
- **Reasoning-first narrator models.** They spend the reply on thought and cannot be told not to; the ranking excludes them on purpose.
- **Novelty claims.** Belief-as-consensus-reality is Mage: The Ascension's paradigm and older; model-narrated fiction is AI Dungeon's; feeding a simulation's state to a narrator is Dwarf Fortress's legends mode by another route. What this project adds is the combination under a local-first constraint, with the rules engine authoritative and the model decorative. That is a position, not an invention.
- **Any mechanism that requires a token to play.** Reputation may be read from holdings. Entry is never gated by them.

---

## 6. Provenance

Written against `4842910` on main, 4 November 2026. That commit carries the wagmi fix and the dev-server note in `CLAUDE.md`; `e896f8a` before it carries the browser connect gesture and the gemma4 decision. Open at that commit: draft PR #8 (browser model refresh, gated until 6 November). Tests: 86 passed, 5 skipped (live Ollama). Typecheck clean. Playtest figures in §2.2 are from a scripted six-turn harness on 2 November 2026 against gemma4:latest and llama3.2 through Ollama on an RX 7800 XT; they are indicative, not a benchmark.

The Tales of Tasern setting is the creation of James Magee. The code is released under the MIT Licence, Copyright (c) 2026 S. Lavi.
