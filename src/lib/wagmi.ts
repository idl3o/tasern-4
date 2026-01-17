import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { polygon } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "Tales of Tasern",
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_ID || "demo",
  chains: [polygon],
  ssr: true,
});
