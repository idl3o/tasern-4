"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useStoryStore } from "@/state/storyStore";
import { useWebLLMStore } from "@/state/webllmStore";
import { useOllamaStore } from "@/state/ollamaStore";
import { useWorldStore } from "@/state/worldStore";
import { WALLET_ENABLED } from "./wallet/flag";

// The wallet stack is imported only when enabled: creating its config is what opens
// WalletConnect's relay socket, so a static import would connect in every build.
const WalletProviders = WALLET_ENABLED ? dynamic(() => import("./wallet/WalletProviders")) : null;

export function Providers({ children }: { children: React.ReactNode }) {
  // Stores use skipHydration so first client render matches the prerendered HTML;
  // trigger rehydration once here, after mount.
  useEffect(() => {
    useStoryStore.persist.rehydrate();
    useWebLLMStore.persist.rehydrate();
    useWorldStore.persist.rehydrate();
    useOllamaStore.persist.rehydrate();
  }, []);

  if (!WalletProviders) return <>{children}</>;
  return <WalletProviders>{children}</WalletProviders>;
}
