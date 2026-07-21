# Tales of Tasern

*Interactive fiction at the edge of existence, narrated by a local AI, in a world where belief becomes reality.*

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Next.js 14](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![Tauri 2](https://img.shields.io/badge/Tauri-2.0-24C8DB?logo=tauri&logoColor=white)
![status](https://img.shields.io/badge/status-experimental-orange)

Tasern 4 is an AI-driven text roleplaying game set in James Magee's homebrew D&D universe, **Tales of Tasern** — a world at the edge of existence that catches everything falling from dying universes, where what enough minds hold true becomes true. You create a character, arrive through the cosmic drain, and an LLM narrates your story turn by turn, grounded in the setting's cosmology, factions and geography.

The project is deliberately **local-first**: the model that tells your story runs on *your* machine, not a cloud API. The desktop build detects and manages a local [Ollama](https://ollama.ai) instance; the browser build falls back to an in-browser model via [WebLLM](https://github.com/mlc-ai/web-llm). Your stories stay with you.

**Play in the browser:** [tasern-4.vercel.app](https://tasern-4.vercel.app)

## The idea

Tasern's founding rule is that **belief is magic** — gods rise from prayers, contradictory creation myths are both "true", and strong conviction can bend local reality. Tasern 4 takes that premise literally at the software level:

- Character creation asks *what do you believe?*, and your stated belief and faction affinity are woven into the narrator's system prompt.
- A small, deterministic **world simulation** (`src/lib/world/`) accumulates belief pressure across four approaches — Combat, Perception, Nature, Chaos — drifts faction standings, rotates the ascendant moon, and, past a threshold, fires a "reality shift" that raises a faction to ascendancy. The living world state is fed back into the story as colour.
- Play resolves through a d20 system: the narrator calls for a roll only when the outcome is genuinely uncertain, belief reinforcement grants modifiers, and a self-pacing "fate stirs" backstop keeps the dice layer from going silent.

It sits where this author's other work tends to — the intersection of Web3, AI and worldbuilding — but the wallet layer here is strictly optional (see below).

## How it works

1. **Character creation** — a click-through flow sets name, origin (how you fell into Tasern), core belief, faction affinity and a faction-specific starting gift.
2. **Prompt construction** — `src/lib/prompt.ts` composes a system prompt from the world lore, your character, dominant beliefs, relevant faction and region lore, the moons, and the current world state.
3. **Generation** — the chosen backend (Ollama or WebLLM) streams second-person narrative.
4. **Tag protocol** — the narrator emits inline tags the client parses and strips: `[ROLL_REQUIRED]`, `[CHOICE]`, `[ITEM_GAINED]` / `[ITEM_LOST]`, `[SPELL_LEARNED]` / `[SPELL_LOST]`, and world events.
5. **Memory** — the story is periodically summarised into structured JSON (character, location, events, NPCs, beliefs, inventory, spells) so long sessions stay coherent.
6. **Persistence** — stories auto-save to `localStorage` (via Zustand) and resume across sessions.

## What's inside

- **Two local AI backends** — desktop Ollama (detected and managed by the Tauri layer) or in-browser WebLLM; no cloud story generation required.
- **Lore-grounded world** — eight factions, three moons, twin suns and a detailed continental geography, authored as Markdown in `content/` and loaded as prompt context.
- **Belief-driven world simulation** — a serialisable global world state that evolves as you play.
- **d20 resolution with belief modifiers** — tiered outcomes from critical failure to critical success.
- **Optional Web3** — wallet connection via RainbowKit / Wagmi is available in the browser build and treated as a persistent cross-world identity, but is never required to play.

## Getting started

Requires Node.js. The dev server runs on port **3333**.

```bash
git clone https://github.com/idl3o/tasern-4.git
cd tasern-4
npm install
npm run dev          # http://localhost:3333
```

Other scripts (from `package.json`):

```bash
npm run build        # Next.js web/Vercel build
npm run start        # serve the production build
npm run lint         # next lint
npm run tauri:dev    # desktop app, hot reload (requires Rust toolchain)
npm run tauri:build  # build the desktop app (requires Rust toolchain)
```

### Using a local model

- **Browser:** open the app and choose the in-browser model; WebLLM downloads a model into your browser on first use.
- **Ollama:** install Ollama and pull a model (the project defaults reference `llama3.2`). To let the hosted web app reach your local Ollama, start it with an allowed origin, e.g. `OLLAMA_ORIGINS=https://tasern-4.vercel.app ollama serve` (or `http://localhost:3333` for local dev). The desktop build manages this for you.

Environment variables are documented in `.env.example` (admin password, optional Anthropic fallback key, local LLM URL/model, WalletConnect project ID).

## Project structure

```
src/
  app/            Next.js App Router (root page, intro → story flow)
  components/     CharacterCreation, StoryInterface, IntroSequence,
                  OllamaSetup, WebLLMSetup, ChroniclePanel
  hooks/          useStoryEngine, useLocalOllama, useWebLLM, useTauri, wallet hooks
  lib/            prompt.ts, lore.ts, rolls.ts, world/ (belief simulation)
  state/          Zustand stores (story, webllm, world)
content/          world-context, factions, geography, moons (AI prompt lore)
src-tauri/        Tauri 2.0 desktop shell (Rust) + Ollama management
```

Additional design notes live in `CLAUDE.md`, `WHITEPAPER.md` and `FUTURE.md`.

## Status

**Experimental / active development** (version 0.1.0). The core loop works — character creation, streaming AI narration, tag parsing, dice, inventory/spells, memory extraction, persistence, and both AI backends — and a web build is deployed. Roadmap items noted in the repo include faction-reactive NPCs, deeper belief accumulation, multiplayer story threads and character NFTs; treat these as intentions rather than shipped features. Expect rough edges and breaking changes.

## Related

- [idl3o/tasern-3](https://github.com/idl3o/tasern-3) — NFT card battle game in the same Tales of Tasern universe.
- [idl3o/ToTtcg](https://github.com/idl3o/ToTtcg) — open-source NFT trading card game from the ToT universe.

The Tales of Tasern setting is the homebrew creation of James Magee.

---

The code is released under the [MIT Licence](LICENSE).

Built by [S. Lavi](https://github.com/idl3o) · [@modsias](https://x.com/modsias)
