# Tasern 4

An AI-powered interactive fiction experience set in the Tasern Universe - a world at the edge of existence where belief shapes reality.

## Play Now

**[tasern-4.vercel.app](https://tasern-4.vercel.app)**

No installation required. Works in any modern browser.

### How It Works

Tasern uses AI to generate your story in real-time. Choose your AI backend:

| Option | Setup | Performance |
|--------|-------|-------------|
| **Browser AI** | None - click to download ~2GB model | Good (runs in browser via WebLLM) |
| **Local Ollama** | Install Ollama + enable CORS | Better (runs natively) |

### Using Local Ollama (Optional)

For faster response times, run Ollama locally:

1. Install [Ollama](https://ollama.ai/download)
2. Pull a model: `ollama pull llama3.2`
3. Start with web access enabled:

**Mac/Linux:**
```bash
OLLAMA_ORIGINS=https://tasern-4.vercel.app ollama serve
```

**Windows:**
```cmd
set OLLAMA_ORIGINS=https://tasern-4.vercel.app && ollama serve
```

4. Refresh the web app - it will detect Ollama automatically

Your stories stay on your machine. The web app connects directly to your local Ollama.

> **Security note:** The `OLLAMA_ORIGINS` setting controls which websites can access your local Ollama. Using the specific domain (`https://tasern-4.vercel.app`) is safer than `*` which allows any website. For local development, you can use `OLLAMA_ORIGINS=http://localhost:3333`.

---

## Desktop App

For the full offline experience, download the native Windows app.

**[Download from Releases](https://github.com/idl3o/tasern-4/releases)**

The desktop app manages Ollama automatically - no CORS configuration needed.

---

## Features

- **AI-driven storytelling** - Every playthrough is unique
- **Rich world lore** - 8 factions, unique cosmology, detailed geography
- **Privacy-first** - No cloud AI services, everything runs locally
- **Multiple AI options** - Ollama (local) or WebLLM (browser)
- **Optional Web3** - Wallet connection available but not required

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

---

## Development

### Quick Start

```bash
git clone https://github.com/idl3o/tasern-4.git
cd tasern-4
npm install
npm run dev
```

Open [localhost:3333](http://localhost:3333)

### Build Commands

```bash
# Web development
npm run dev           # Start dev server (port 3333)
npm run build         # Build for Vercel/web deployment

# Desktop development (requires Rust)
npm run tauri:dev     # Dev with hot reload
npm run tauri:build   # Build Windows installer
```

### Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Desktop**: Tauri 2.0 (Rust + WebView)
- **AI**: Ollama (local), WebLLM (browser)
- **Web3**: RainbowKit, Wagmi (optional)

### Project Structure

```
tasern-4/
├── src/
│   ├── app/              # Next.js App Router
│   ├── components/       # React components
│   │   ├── StoryInterface.tsx
│   │   ├── IntroSequence.tsx
│   │   └── OllamaSetup.tsx
│   └── hooks/
│       ├── useLocalOllama.ts   # Browser-direct Ollama
│       ├── useWebLLM.ts        # In-browser AI
│       └── useTauri.ts         # Desktop integration
├── src-tauri/            # Desktop app (Tauri)
├── content/              # World lore for AI context
└── CLAUDE.md             # AI assistant context
```

## License

MIT

---

*Built for the Tasern Universe by James Macgee*
