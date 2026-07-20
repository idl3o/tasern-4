"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { config } from "./wagmi";
import { useEffect, useState } from "react";
import { useStoryStore } from "@/state/storyStore";
import { useWebLLMStore } from "@/state/webllmStore";

import "@rainbow-me/rainbowkit/styles.css";

// The desktop (Tauri) build ships without the wallet stack, so no WalletConnect
// relay / RPC connections are ever made and the CSP can stay tight.
const IS_TAURI = process.env.NEXT_PUBLIC_TAURI_BUILD === "true";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  // Stores use skipHydration so first client render matches the prerendered HTML;
  // trigger rehydration once here, after mount.
  useEffect(() => {
    useStoryStore.persist.rehydrate();
    useWebLLMStore.persist.rehydrate();
  }, []);

  if (IS_TAURI) {
    return <>{children}</>;
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#D4AF37",
            accentColorForeground: "#0a0a0f",
            borderRadius: "medium",
            fontStack: "system",
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
