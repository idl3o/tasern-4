"use client";

import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { StoryInterface } from "@/components/StoryInterface";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { IntroSequence } from "@/components/IntroSequence";

export default function Home() {
  const { isConnected } = useAccount();
  const [showIntro, setShowIntro] = useState(true);
  const [introComplete, setIntroComplete] = useState(false);

  const handleIntroComplete = () => {
    setShowIntro(false);
    setIntroComplete(true);
  };

  // Show intro sequence first (only once)
  if (showIntro && !introComplete) {
    return <IntroSequence onComplete={handleIntroComplete} />;
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gold/20 bg-void/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="font-display text-xl text-gold tracking-wider" style={{ fontFamily: "'Cinzel', serif" }}>
            TALES OF TASERN
          </h1>
          <ConnectButton
            accountStatus="address"
            chainStatus="icon"
            showBalance={false}
          />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {isConnected ? <StoryInterface /> : <WelcomeScreen />}
      </div>

      {/* Footer */}
      <footer className="border-t border-gold/10 py-4 text-center text-sm text-parchment/40">
        <p>At the edge of existence, where belief becomes reality</p>
      </footer>
    </main>
  );
}
