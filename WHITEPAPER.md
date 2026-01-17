# Tasern 4: Technical Whitepaper

## Executive Summary

Tasern 4 is a decentralized, AI-powered interactive fiction platform set in the Tasern Universe. It combines Web3 wallet authentication with a novel multi-tier AI fallback system that enables gameplay across various deployment scenarios—from fully offline browser-based experiences to cloud-hosted instances.

**Key Innovation:** Browser-direct AI detection allows deployed web applications to utilize users' local AI infrastructure (Ollama) without requiring server-side configuration, creating a truly decentralized AI gaming experience.

---

## 1. Architecture Overview

### 1.1 System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  RainbowKit │  │   WebLLM    │  │   Local Ollama Hook     │  │
│  │  (Wallet)   │  │  (Browser)  │  │  (localhost:11434)      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│         │                │                      │               │
│         └────────────────┼──────────────────────┘               │
│                          │                                      │
│              ┌───────────▼───────────┐                          │
│              │    StoryInterface     │                          │
│              │   (Smart Fallback)    │                          │
│              └───────────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVER (Next.js API)                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  /api/story │  │ /api/llm/   │  │    /api/admin/*         │  │
│  │  (Generate) │  │   status    │  │  (Authentication)       │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              LLM Provider (lib/llm.ts)                      ││
│  │         Ollama (localhost) → Anthropic (cloud)              ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 AI Fallback Chain

The system implements a four-tier fallback for maximum availability:

| Priority | Provider | Location | Latency | Cost |
|----------|----------|----------|---------|------|
| 1 | Local Ollama | User's machine (browser-direct) | ~50ms | Free |
| 2 | WebLLM | User's browser (WASM) | ~200ms | Free |
| 3 | Server Ollama | Server localhost | ~100ms | Free |
| 4 | Anthropic Claude | Cloud API | ~500ms | Paid |

**Browser-Direct Ollama Detection:**
```typescript
// hooks/useLocalOllama.ts
const response = await fetch("http://localhost:11434/api/tags");
// If successful, Ollama is available for direct generation
```

This allows deployed Vercel apps to use users' local Ollama installations without any server configuration—a key differentiator enabling decentralized AI gaming.

---

## 2. Component Architecture

### 2.1 Frontend Components

```
src/components/
├── IntroSequence.tsx    # 5-page lore introduction
├── StoryInterface.tsx   # Main game interface with AI generation
├── WebLLMSetup.tsx      # Browser AI download/setup UI
├── WelcomeScreen.tsx    # Initial landing with wallet connect
└── index.ts             # Barrel exports
```

**StoryInterface.tsx** (Core Component)
- Manages story state with `StoryMessage[]` array
- Implements smart AI selection via `smartGenerate()`
- Handles streaming responses from all AI providers
- Real-time status display for AI availability

### 2.2 State Management

```
src/state/
└── webllmStore.ts       # Zustand store for WebLLM state
```

**WebLLM Store:**
```typescript
interface WebLLMState {
  status: WebLLMStatus;
  progress: number;
  error: string | null;
  engine: MLCEngineInterface | null;
  preferWebLLM: boolean;
  hasDeclinedWebLLM: boolean;
}
```

### 2.3 Custom Hooks

```
src/hooks/
├── useWebLLM.ts         # WebLLM initialization and generation
└── useLocalOllama.ts    # Browser-direct Ollama detection
```

**useLocalOllama Hook:**
- Checks localhost:11434 on mount
- Returns availability status and model list
- Provides async generator for streaming responses
- Requires `OLLAMA_ORIGINS=*` for cross-origin requests

### 2.4 API Routes

```
src/app/api/
├── story/route.ts       # POST: Generate story content
├── llm/status/route.ts  # GET: Server-side LLM availability
└── admin/
    ├── login/route.ts   # POST: Admin authentication
    ├── logout/route.ts  # POST: Clear admin session
    └── status/route.ts  # GET: Check admin session
```

---

## 3. AI Integration

### 3.1 Vercel AI SDK

The server uses Vercel AI SDK for unified LLM access:

```typescript
// lib/llm.ts
import { createOpenAI } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";

// Ollama via OpenAI-compatible API
const ollama = createOpenAI({
  baseURL: "http://localhost:11434/v1",
  apiKey: "ollama",
});

// Anthropic Claude
const claude = anthropic("claude-sonnet-4-20250514");
```

### 3.2 WebLLM (Browser AI)

WebLLM runs Llama models directly in the browser via WebGPU:

```typescript
// hooks/useWebLLM.ts
import { CreateMLCEngine } from "@mlc-ai/web-llm";

const engine = await CreateMLCEngine(
  "Llama-3.2-3B-Instruct-q4f16_1-MLC",
  { initProgressCallback }
);
```

**Requirements:**
- WebGPU-capable browser (Chrome 113+, Edge 113+)
- ~2GB storage for model weights
- 4GB+ VRAM recommended

### 3.3 World Context Injection

All AI providers receive rich world context:

```typescript
const WORLD_CONTEXT = `
You are the narrator for Tales of Tasern...

## THE WORLD
Tasern exists at the edge of reality...

## THE RULE OF BELIEF
In Tasern, BELIEF IS MAGIC...

## THE FACTIONS
1. Elves of Elpha ($EGP)...
`;
```

---

## 4. Web3 Integration

### 4.1 Wallet Connection

RainbowKit + Wagmi provide wallet connectivity:

```typescript
// lib/wagmi.ts
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { polygon } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "Tales of Tasern",
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_ID,
  chains: [polygon],
});
```

### 4.2 Identity Persistence

Wallet addresses serve as persistent player identities:

```typescript
// Passed to AI for context
systemContext += `The player's wallet address is ${address}.`;
```

### 4.3 Future Token Integration

The architecture supports faction-based tokens:

| Faction | Token | Purpose |
|---------|-------|---------|
| Elves | $PKT | Governance, crafting |
| Dwarves | $DHG | Mining rights, smithing |
| Durgan Dynasty | $EGP | Trade, diplomacy |
| Pirates | $IGS | Smuggling, raids |
| Igypt | $DDD | Rituals, undead |
| Dragons | $OGC | Tribute, territory |
| Orks | $BTN | War machines, conquest |
| Druids | $LGP | Nature magic, balance |

---

## 5. Content Architecture

### 5.1 World Lore Files

```
content/
├── world-context.md     # Core cosmology and rules
├── factions.md          # 8 faction descriptions
├── geography.md         # Continents and regions
└── moons.md             # Three moons and influences
```

### 5.2 Lore Integration

Content files are designed for AI consumption:
- Structured with clear headers
- Bullet points for quick parsing
- Narrative hooks for story generation
- Faction tensions for conflict generation

---

## 6. Security Considerations

### 6.1 Admin Authentication

Cookie-based session management:

```typescript
// lib/admin.ts
const SESSION_COOKIE = "tasern_admin_session";
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export function createAdminSession(): string {
  return crypto.randomUUID();
}
```

### 6.2 Environment Variables

```env
# Never commit these
ADMIN_PASSWORD=<secure-password>
ANTHROPIC_API_KEY=<api-key>

# Safe to expose (NEXT_PUBLIC_)
NEXT_PUBLIC_WALLET_CONNECT_ID=<project-id>
```

### 6.3 CORS Configuration

For browser-direct Ollama access:
```
OLLAMA_ORIGINS=*  # Or specific domain
```

---

## 7. Deployment

### 7.1 Vercel Configuration

```json
// vercel.json
{
  "framework": "nextjs",
  "buildCommand": "next build",
  "devCommand": "next dev",
  "installCommand": "npm install"
}
```

### 7.2 Environment Setup

**Required for Vercel:**
- `NEXT_PUBLIC_WALLET_CONNECT_ID` - WalletConnect project ID

**Optional:**
- `ANTHROPIC_API_KEY` - Enables cloud AI fallback
- `ADMIN_PASSWORD` - Enables admin dashboard

### 7.3 Local Development

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your values
npm run dev
```

---

## 8. Performance Optimizations

### 8.1 Streaming Responses

All AI providers stream responses for perceived speed:

```typescript
// Server streaming
return new Response(result.textStream, {
  headers: { "Content-Type": "text/plain; charset=utf-8" }
});

// Client consumption
for await (const chunk of response) {
  setContent(prev => prev + chunk);
}
```

### 8.2 Parallel Status Checks

AI availability checks run concurrently:

```typescript
// useLocalOllama and server status check simultaneously
const [localOllama, serverStatus] = await Promise.all([
  checkLocalOllama(),
  fetch("/api/llm/status")
]);
```

### 8.3 Lazy Loading

WebLLM is dynamically imported to avoid SSR issues:

```typescript
const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
```

---

## 9. Future Roadmap

### 9.1 Planned Features

1. **Character Persistence** - Save/load character state to blockchain
2. **Multiplayer Sessions** - Shared story experiences
3. **Token-Gated Content** - Faction-specific storylines
4. **On-Chain Achievements** - NFT rewards for story milestones
5. **Custom Model Fine-Tuning** - Tasern-specific AI model

### 9.2 Technical Debt

1. MetaMask SDK warning (react-native-async-storage)
2. WalletConnect project ID (currently using demo)
3. Next.js version upgrade (security patch)

---

## 10. Conclusion

Tasern 4 represents a novel approach to AI-powered gaming that prioritizes:

1. **Decentralization** - Players can use their own AI infrastructure
2. **Accessibility** - Multiple fallback options ensure playability
3. **Immersion** - Rich world lore integrated into AI context
4. **Ownership** - Web3 identity tied to gameplay

The browser-direct Ollama detection is particularly innovative, enabling a deployed web application to leverage users' local compute resources without any server-side configuration—a pattern that could define the future of decentralized AI applications.

---

## Appendix A: File Structure

```
tasern-4/
├── .env.example              # Environment template
├── .env.local                # Local secrets (gitignored)
├── .gitignore
├── CLAUDE.md                 # AI assistant context
├── README.md                 # User documentation
├── WHITEPAPER.md             # This document
├── Tasern_overview.odt       # Source lore document
├── content/
│   ├── factions.md
│   ├── geography.md
│   ├── moons.md
│   └── world-context.md
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
├── vercel.json
└── src/
    ├── app/
    │   ├── admin/page.tsx
    │   ├── api/
    │   │   ├── admin/
    │   │   │   ├── login/route.ts
    │   │   │   ├── logout/route.ts
    │   │   │   └── status/route.ts
    │   │   ├── llm/status/route.ts
    │   │   └── story/route.ts
    │   ├── globals.css
    │   ├── layout.tsx
    │   └── page.tsx
    ├── components/
    │   ├── index.ts
    │   ├── IntroSequence.tsx
    │   ├── StoryInterface.tsx
    │   ├── WebLLMSetup.tsx
    │   └── WelcomeScreen.tsx
    ├── hooks/
    │   ├── useLocalOllama.ts
    │   └── useWebLLM.ts
    ├── lib/
    │   ├── admin.ts
    │   ├── llm.ts
    │   ├── providers.tsx
    │   ├── theme.ts
    │   └── wagmi.ts
    └── state/
        └── webllmStore.ts
```

---

## Appendix B: Technology Stack

| Category | Technology | Version |
|----------|------------|---------|
| Framework | Next.js | 14.2.21 |
| Language | TypeScript | 5.3+ |
| Styling | Tailwind CSS | 3.4+ |
| State | Zustand | 4.5+ |
| Web3 | RainbowKit | 2.2+ |
| Web3 | Wagmi | 2.14+ |
| Web3 | Viem | 2.21+ |
| AI | Vercel AI SDK | 3.4+ |
| AI | WebLLM | 0.2.80+ |
| AI | Ollama | 0.14+ |

---

*Document Version: 1.0*
*Last Updated: January 17, 2026*
*Authors: Development Team with Claude Opus 4.5*
