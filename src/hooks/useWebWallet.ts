"use client";

import { useAccount, useBalance } from "wagmi";
import { formatUnits } from "viem";
import type { WalletContext } from "@/lib/prompt";
import type { WalletContextResult } from "./useWalletContext";

// Wallet context, used only when WALLET_ENABLED (see lib/wallet/flag.ts); otherwise
// wagmi's providers are never mounted — see providers.tsx and useWalletContext.ts.
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
