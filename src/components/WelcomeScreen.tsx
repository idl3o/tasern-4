"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function WelcomeScreen() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-2xl text-center space-y-8 animate-fade-in">
        {/* Title */}
        <div className="space-y-2">
          <h2 className="font-display text-4xl md:text-5xl text-gold tracking-wide">
            TALES OF TASERN
          </h2>
          <p className="text-parchment/60 text-lg italic">
            At the edge of existence, where belief becomes reality
          </p>
        </div>

        {/* Lore intro */}
        <div className="story-text text-parchment/80 space-y-4 text-left bg-void/50 border border-gold/20 rounded-lg p-6">
          <p>
            In the beginning, existence poured outward from the{" "}
            <em>Pillars of Creation</em>—vast structures older than gods,
            younger than nothing.
          </p>
          <p>
            At the rim of everything that still counted as something, reality
            swelled into a final membrane. Beyond it lay <em>Oblivion</em>.
          </p>
          <p>
            And there, at the edge, orbiting twin suns of unmaking fire and
            god-forged light, sits <em>Tasern</em>—a world that catches
            everything that falls from dying universes.
          </p>
          <p className="text-gold/80">
            Easy to enter. Almost impossible to leave.
          </p>
        </div>

        {/* Connect prompt */}
        <div className="space-y-4">
          <p className="text-parchment/60">
            Connect your wallet to begin your story
          </p>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </div>

        {/* Decorative element */}
        <div className="flex items-center justify-center gap-4 text-gold/30">
          <div className="h-px w-16 bg-gradient-to-r from-transparent to-gold/30" />
          <span className="text-2xl">⬡</span>
          <div className="h-px w-16 bg-gradient-to-l from-transparent to-gold/30" />
        </div>
      </div>
    </div>
  );
}
