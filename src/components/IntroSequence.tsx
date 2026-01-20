"use client";

import { useState } from "react";

interface IntroSequenceProps {
  onComplete: () => void;
}

const INTRO_PAGES = [
  {
    text: `In the beginning, existence poured outward from the Pillars of Creation—vast structures older than gods, younger than nothing.`,
  },
  {
    text: `At the rim of everything that still counted as something, reality swelled into a final membrane. Beyond it lay Oblivion—not darkness or chaos, but the absence of even the idea of being.`,
  },
  {
    text: `There, orbiting twin suns of unmaking fire and god-forged light, sits Tasern—a small, stubborn world that catches everything that falls from dying universes.`,
  },
  {
    text: `Time moves slowly here. History lingers. Myths refuse to fade. This is the last place where belief still has weight.`,
  },
  {
    text: `You feel yourself falling—through time, through space, through the membrane between what is and what was. The slow gravity of Tasern has caught you.`,
    highlight: true,
  },
];

export function IntroSequence({ onComplete }: IntroSequenceProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleNext = () => {
    if (isTransitioning) return;

    if (currentPage < INTRO_PAGES.length - 1) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentPage((prev) => prev + 1);
        setIsTransitioning(false);
      }, 300);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const page = INTRO_PAGES[currentPage];
  const isLastPage = currentPage === INTRO_PAGES.length - 1;

  return (
    <div className="fixed inset-0 bg-void flex items-center justify-center p-4 z-50">
      {/* Ambient background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold/5 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-tear/5 rounded-full blur-3xl animate-pulse-slow" />
      </div>

      {/* Content */}
      <div className="relative max-w-2xl w-full">
        {/* Skip button */}
        <button
          onClick={handleSkip}
          className="absolute -top-12 right-0 text-parchment/40 hover:text-parchment/60 text-sm transition-colors"
        >
          Skip intro →
        </button>

        {/* Text box */}
        <div
          className={`
            relative bg-void/80 border border-gold/30 rounded-lg p-8 md:p-12
            backdrop-blur-sm transition-opacity duration-300
            ${isTransitioning ? "opacity-0" : "opacity-100"}
          `}
        >
          {/* Decorative corners */}
          <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-gold/50" />
          <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-gold/50" />
          <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-gold/50" />
          <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-gold/50" />

          {/* Text */}
          <p
            className={`
              text-xl md:text-2xl leading-relaxed text-center
              ${page.highlight ? "text-gold" : "text-parchment/90"}
              font-body
            `}
            style={{ fontFamily: "'Crimson Text', serif" }}
          >
            {page.text}
          </p>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          {/* Progress dots */}
          <div className="flex gap-2">
            {INTRO_PAGES.map((_, index) => (
              <div
                key={index}
                className={`
                  w-2 h-2 rounded-full transition-all duration-300
                  ${index === currentPage ? "bg-gold w-6" : "bg-gold/30"}
                `}
              />
            ))}
          </div>

          {/* Continue button */}
          <button
            onClick={handleNext}
            className="btn-primary flex items-center gap-2"
          >
            {isLastPage ? "Begin" : "Continue"}
            <span className="text-lg">{isLastPage ? "→" : "›"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
