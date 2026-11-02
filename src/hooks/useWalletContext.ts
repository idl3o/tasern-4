"use client";

import type { WalletContext } from "@/lib/prompt";
import { WALLET_ENABLED } from "@/lib/wallet/flag";
import { useWebWallet } from "./useWebWallet";

export interface WalletContextResult {
  address: string | undefined;
  isConnected: boolean;
  promptContext: WalletContext | null;
}


function useNoWallet(): WalletContextResult {
  return { address: undefined, isConnected: false, promptContext: null };
}

// Selected once at build time (WALLET_ENABLED is inlined), so only one implementation
// is ever invoked — no conditional hook calls at runtime. Off in both builds for now.
export const useWalletContext: () => WalletContextResult = WALLET_ENABLED ? useWebWallet : useNoWallet;
