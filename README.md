# Tasern 4

An AI-powered interactive fiction experience set in the Tasern Universe - a world at the edge of existence where belief shapes reality.

## Desktop App (Recommended)

Tasern 4 runs as a native desktop app powered by [Tauri](https://tauri.app), with AI storytelling via local [Ollama](https://ollama.ai).

### Quick Start

1. **Install Ollama** from [ollama.ai](https://ollama.ai/download)
2. **Pull the model**: `ollama pull llama3.2`
3. **Download Tasern** from [Releases](https://github.com/idl3o/tasern-4/releases)
4. **Run the installer** and launch Tasern

The app will guide you through setup if Ollama isn't detected.

### Building from Source

**Prerequisites:**
- Node.js 18+
- Rust (install via [rustup](https://rustup.rs))
- Ollama

```bash
git clone https://github.com/idl3o/tasern-4.git
cd tasern-4
npm install

# Development (with hot reload)
npm run tauri:dev

# Build installer
npm run tauri:build
```

Installers are output to `src-tauri/target/release/bundle/`

## Features

- **Local AI storytelling** - Powered by Ollama, runs entirely on your machine
- **Rich world lore** - 8 factions, unique cosmology, detailed geography
- **Privacy-first** - No cloud services required, your stories stay local
- **WebLLM fallback** - Can run AI in-browser if Ollama unavailable
- **Optional Web3** - Wallet connection available but not required

## Tech Stack

- **Desktop**: Tauri 2.0 (Rust + WebView)
- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS with custom fantasy theme
- **AI**: Ollama (local), WebLLM (browser fallback)
- **Web3**: RainbowKit, Wagmi (optional)

## Project Structure

```
tasern-4/
├── src-tauri/           # Tauri desktop app
│   ├── src/lib.rs       # Ollama management commands
│   └── tauri.conf.json  # App configuration
├── content/             # World lore for AI context
│   ├── world-context.md
│   ├── factions.md
│   ├── geography.md
│   └── moons.md
├── src/
│   ├── app/             # Next.js App Router
│   ├── components/      # React components
│   │   ├── IntroSequence.tsx
│   │   ├── StoryInterface.tsx
│   │   ├── OllamaSetup.tsx
│   │   └── WebLLMSetup.tsx
│   └── hooks/
│       ├── useTauri.ts      # Tauri integration
│       ├── useLocalOllama.ts
│       └── useWebLLM.ts
└── CLAUDE.md            # AI assistant context
```

## The Tasern Universe

Tasern exists where dying worlds drain - a place of slow gravity at the edge of existence.

- **Twin Suns** - The Tear (unmaking fire) and Castle of Light (god-forged brilliance)
- **Three Moons** - White (frozen hunger), Green (jungle chaos), Blue (oceanic freedom)
- **Belief Shapes Reality** - Strong conviction can alter the world itself

### Factions

| Faction | Identity |
|---------|----------|
| Elves of Elpha | Patient planners, thousand-year grudges |
| Dwarves of Argenti | Solitary perfectionists, permanence over glory |
| Durgan Dynasty | Human traders, flying ships, connection |
| Pirates | Freedom, chaos, smuggled beliefs |
| Igypt | Fear as sacred, Vigilant Dead |
| Dragons | Immortal if fed, tribute-based rule |
| Orks of Orklin | Industrial revolution, war machines |
| Druids | Balance keepers, growth and rot |

## Development

```bash
# Start development server
npm run tauri:dev

# Build static export only
npm run build

# Build desktop installer
npm run tauri:build

# Lint
npm run lint
```

## License

MIT

---

*Built for the Tasern Universe by James Macgee*
