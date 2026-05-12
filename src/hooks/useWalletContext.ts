"use client";

import { useAccount, useBalance } from "wagmi";
import { formatUnits } from "viem";
import type { WalletContext } from "@/lib/prompt";

export function useWalletContext(): {
  address: string | undefined;
  isConnected: boolean;
  promptContext: WalletContext | null;
} {
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

  return {
    address,
    isConnected: true,
    promptContext: { address, polBalance },
  };
}
