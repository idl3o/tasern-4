"use client";

import type { WalletContext } from "@/lib/prompt";
import { useWebWallet } from "./useWebWallet";

export interface WalletContextResult {
  address: string | undefined;
  isConnected: boolean;
  promptContext: WalletContext | null;
}

// The desktop (Tauri) build has no wallet: its webview can't host a browser
// extension and WalletConnect's relay is deliberately excluded from the CSP.
const IS_TAURI = process.env.NEXT_PUBLIC_TAURI_BUILD === "true";

function useNoWallet(): WalletContextResult {
  return { address: undefined, isConnected: false, promptContext: null };
}

// Selected once at build time (NEXT_PUBLIC_TAURI_BUILD is inlined), so only one
// implementation is ever invoked — no conditional hook calls at runtime.
export const useWalletContext: () => WalletContextResult = IS_TAURI ? useNoWallet : useWebWallet;
