# Tasern 4

An AI-powered interactive fiction experience set in the Tasern Universe - a world at the edge of existence where dying realities drain into slow gravity and belief shapes reality.

## Features

- **AI Dungeon-style storytelling** - Dynamic narrative driven by LLM with rich world context
- **Smart AI fallback chain** - Browser WebLLM → Local Ollama → Cloud Anthropic
- **Web3 integration** - Wallet connection via RainbowKit (Polygon network)
- **Rich world lore** - 8 factions, unique cosmology, detailed geography
- **Admin dashboard** - Monitor LLM status and configuration
- **Offline capable** - Run entirely in-browser with WebLLM

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS with custom medieval/fantasy theme
- **Web3**: RainbowKit, Wagmi, Viem
- **AI**: Vercel AI SDK, WebLLM, Ollama support
- **State**: Zustand with Immer

## Getting Started

### Prerequisites

- Node.js 18+
- A wallet (MetaMask, etc.)

### Installation

```bash
git clone https://github.com/idl3o/tasern-4.git
cd tasern-4
npm install
```

### Configuration

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your settings:

```env
# Admin password for /admin dashboard
ADMIN_PASSWORD=your-secure-password

# LLM Configuration
LOCAL_LLM_URL=http://localhost:11434
LOCAL_LLM_MODEL=llama3.2
PREFER_LOCAL_LLM=true

# Optional: Anthropic API key for cloud fallback
ANTHROPIC_API_KEY=sk-ant-...

# WalletConnect Project ID (get from cloud.walletconnect.com)
NEXT_PUBLIC_WALLET_CONNECT_ID=your-project-id
```

### Running

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## AI Options

Tasern 4 uses a smart fallback chain for story generation:

### 1. Browser AI (WebLLM)
- Runs entirely in your browser
- ~2GB download, then works offline
- Click "Download Browser AI" on the welcome screen

### 2. Local Server (Ollama)
- Install [Ollama](https://ollama.ai)
- Run: `ollama serve`
- Pull a model: `ollama pull llama3.2`

### 3. Cloud AI (Anthropic)
- Add `ANTHROPIC_API_KEY` to `.env.local`
- Uses Claude for high-quality responses

## Project Structure

```
tasern-4/
├── content/              # World lore for AI context
│   ├── world-context.md  # Core rules and tone
│   ├── factions.md       # 8 playable factions
│   ├── geography.md      # Continents and regions
│   └── moons.md          # Three moons and their influence
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── admin/        # Admin dashboard
│   │   ├── api/          # API routes (story, LLM status)
│   │   └── page.tsx      # Main entry
│   ├── components/       # React components
│   │   ├── IntroSequence.tsx
│   │   ├── StoryInterface.tsx
│   │   ├── WebLLMSetup.tsx
│   │   └── WelcomeScreen.tsx
│   ├── hooks/            # Custom hooks
│   ├── lib/              # Utilities (LLM, auth, theme)
│   └── state/            # Zustand stores
└── CLAUDE.md             # AI assistant context
```

## The Tasern Universe

Tasern exists where dying worlds drain - a place of slow gravity at the edge of existence. Key elements:

- **The Pillars of Creation** - Five cosmic forces that shaped reality
- **Twin Suns** - The Tear (dying orange) and Castle of Light (brilliant white)
- **Three Moons** - White, Green, and Blue, each with unique influence
- **Belief Shapes Reality** - Strong conviction can alter the world itself

### Factions

| Faction | Currency | Character |
|---------|----------|-----------|
| Elves | $PKT | Ancient wisdom, forest magic |
| Dwarves | $DHG | Engineering, underground kingdoms |
| Durgan Dynasty | $EGP | Imperial ambition, military might |
| Pirates | $IGS | Freedom, oceanic trade |
| Igypt | $DDD | Desert mysticism, ancient power |
| Dragons | $OGC | Raw power, territorial dominion |
| Orks | $BTN | Tribal strength, primal fury |
| Druids | $LGP | Nature harmony, wild magic |

## Deployment

Optimized for Vercel:

```bash
npm run build
```

Or deploy directly:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/idl3o/tasern-4)

## License

MIT

---

*Built for the Tasern Universe by James Macgee*
