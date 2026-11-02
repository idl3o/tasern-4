"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

/** The header's connect button; imported only when WALLET_ENABLED (see page.tsx). */
export default function WalletButton() {
  return <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false} />;
}
