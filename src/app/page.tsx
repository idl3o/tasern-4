"use client";

import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { StoryInterface } from "@/components/StoryInterface";
import { IntroSequence } from "@/components/IntroSequence";
import OllamaSetup from "@/components/OllamaSetup";
import { useTauri } from "@/hooks/useTauri";
import { useStoryStore } from "@/state/storyStore";

export default function Home() {
  const [showIntro, setShowIntro] = useState(true);
  const [introComplete, setIntroComplete] = useState(false);
  const [ollamaReady, setOllamaReady] = useState(false);
  const { isInTauri, ollamaStatus } = useTauri();
  const { activeStoryId, getActiveStory } = useStoryStore();

  const handleIntroComplete = () => {
    setShowIntro(false);
    setIntroComplete(true);
  };

  // Show intro sequence first (only once)
  if (showIntro && !introComplete) {
    return <IntroSequence onComplete={handleIntroComplete} />;
  }

  // In Tauri context, show Ollama setup if not ready
  // Skip this in browser since StoryInterface handles its own AI detection
  if (isInTauri && !ollamaReady && !ollamaStatus.running) {
    return <OllamaSetup onReady={() => setOllamaReady(true)} />;
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gold/20 bg-void/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-xl text-gold tracking-wider" style={{ fontFamily: "'Cinzel', serif" }}>
              TALES OF TASERN
            </h1>
            {activeStoryId && (
              <span className="text-parchment/30 text-sm truncate max-w-[200px]">
                {getActiveStory()?.title}
              </span>
            )}
          </div>
          <ConnectButton
            accountStatus="address"
            chainStatus="icon"
            showBalance={false}
          />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <StoryInterface />
      </div>

      {/* Footer */}
      <footer className="border-t border-gold/10 py-4 text-center text-sm text-parchment/40">
        <p>At the edge of existence, where belief becomes reality</p>
      </footer>
    </main>
  );
}
