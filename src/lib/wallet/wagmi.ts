import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { polygon } from "wagmi/chains";

// Loaded only when the wallet is enabled (see flag.ts): creating this config sets up
// the WalletConnect connector, which opens a socket to its relay straight away.
const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_ID;
if (!projectId) {
  throw new Error("NEXT_PUBLIC_ENABLE_WALLET=true needs NEXT_PUBLIC_WALLET_CONNECT_ID (https://cloud.reown.com)");
}

export const config = getDefaultConfig({
  appName: "Tales of Tasern",
  projectId,
  chains: [polygon],
  ssr: true, // only the web build enables the wallet, and it renders on the server
});
