/**
 * The wallet (RainbowKit / wagmi / WalletConnect) is cordoned off: nothing from the
 * wallet stack loads, renders or connects unless NEXT_PUBLIC_ENABLE_WALLET=true at
 * build time. The desktop build never enables it: its webview can't host wallet
 * extensions, and its CSP excludes WalletConnect's relay.
 */
export const WALLET_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_WALLET === "true" && process.env.NEXT_PUBLIC_TAURI_BUILD !== "true";
