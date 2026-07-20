import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { polygon } from "wagmi/chains";

// SSR handling is only meaningful for the Next server build; the Tauri build is a
// static export with no server, so disable it there to avoid hydration quirks.
const isStaticExport = process.env.NEXT_PUBLIC_TAURI_BUILD === "true";

export const config = getDefaultConfig({
  appName: "Tales of Tasern",
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_ID || "demo",
  chains: [polygon],
  ssr: !isStaticExport,
});
