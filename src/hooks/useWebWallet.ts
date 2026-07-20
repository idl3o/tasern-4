"use client";

import { useAccount, useBalance } from "wagmi";
import { formatUnits } from "viem";
import type { WalletContext } from "@/lib/prompt";
import type { WalletContextResult } from "./useWalletContext";

// Web-only wallet context. Never called in the Tauri build (browser-extension /
// WalletConnect wallets aren't usable inside the desktop webview), so wagmi's
// providers are never mounted there — see providers.tsx and useWalletContext.ts.
export function useWebWallet(): WalletContextResult {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({
    address,
    query: { enabled: Boolean(address) },
  });

  if (!isConnected || !address) {
    return { address, isConnected: false, promptContext: null };
  }

  let polBalance: string | null = null;
  if (balance) {
    const value = Number(formatUnits(balance.value, balance.decimals));
    polBalance = value < 0.0001 ? "trace" : value.toFixed(4);
  }

  const promptContext: WalletContext = { address, polBalance };
  return { address, isConnected: true, promptContext };
}
