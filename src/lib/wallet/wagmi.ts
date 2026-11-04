import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import type { Config } from "wagmi";
import { polygon } from "wagmi/chains";

// Loaded only when the wallet is enabled (see flag.ts): creating this config sets up
// the WalletConnect connector, which opens a socket to its relay straight away.
const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_ID;
if (!projectId) {
  throw new Error("NEXT_PUBLIC_ENABLE_WALLET=true needs NEXT_PUBLIC_WALLET_CONNECT_ID (https://cloud.reown.com)");
}

// `next dev` re-evaluates server modules on every rebuild, and WalletConnect Core has no
// teardown: a fresh config per rebuild left every earlier relay client alive and retrying.
// A dev server left running overnight on 2026-11-02 reached 100 GB of commit this way.
// One config per process, kept on globalThis, survives those re-evaluations.
const perProcess = globalThis as typeof globalThis & { __tasernWagmiConfig?: Config };

export const config: Config = (perProcess.__tasernWagmiConfig ??= getDefaultConfig({
  appName: "Tales of Tasern",
  projectId,
  chains: [polygon],
  ssr: true, // only the web build enables the wallet, and it renders on the server
}));
