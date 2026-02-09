"use client";

import { useState } from "react";

export interface CharacterChoices {
  name: string;
  origin: string;
  belief: string;
  faction: string;
  startingGift: { name: string; description: string; type: "item" | "spell" };
}

interface CharacterCreationProps {
  onComplete: (choices: CharacterChoices) => void;
}

const ORIGINS = [
  {
    id: "dying-world",
    title: "A Dying World",
    description: "Your world was ending. You fell through the cracks as reality collapsed.",
  },
  {
    id: "spell-gone-wrong",
    title: "A Spell Gone Wrong",
    description: "You were reaching for power and reached too far. The magic tore you loose.",
  },
  {
    id: "pursued",
    title: "Pursued by Something",
    description: "You were running from something that no longer exists — but you still feel it behind you.",
  },
  {
    id: "simply-lost",
    title: "Simply Lost",
    description: "You wandered too far from the known paths. Tasern's gravity caught you.",
  },
];

const BELIEFS = [
  {
    id: "strength",
    title: "Strength overcomes all",
    description: "Raw force, endurance, defiance of what would break you.",
    affinity: "Combat: shielding, striking",
  },
  {
    id: "knowledge",
    title: "Knowledge is the true power",
    description: "Secrets, understanding, the patterns behind everything.",
    affinity: "Perception: scrying, lore, detection",
  },
  {
    id: "nature",
    title: "The natural world provides",
    description: "Growth, balance, the living cycle that sustains all things.",
    affinity: "Nature: healing, shaping, growth",
  },
  {
    id: "freedom",
    title: "Freedom cannot be taken",
    description: "Independence, movement, defiance of every cage and chain.",
    affinity: "Chaos: illusion, escape, mobility",
  },
];

const FACTIONS = [
  {
    id: "elves",
    title: "Elves of Elpha",
    description: "Patient crafters, thousand-year plans",
    gift: { name: "Everlight Candle", description: "A flame that remembers what it has seen", type: "item" as const },
  },
  {
    id: "dwarves",
    title: "Dwarves of Argenti",
    description: "Solitary perfectionists of stone",
    gift: { name: "Stoneheart Ring", description: "Warms when danger is near", type: "item" as const },
  },
  {
    id: "durgan",
    title: "Durgan Dynasty",
    description: "Human traders, flying ships",
    gift: { name: "Diplomat's Coin", description: "Flips to reveal hidden intentions", type: "item" as const },
  },
  {
    id: "pirates",
    title: "Pirates",
    description: "Freedom, chaos, stolen beliefs",
    gift: { name: "Smuggler's Compass", description: "Points to what you desire most", type: "item" as const },
  },
  {
    id: "igypt",
    title: "Igypt",
    description: "Fear is sacred, the dead watch",
    gift: { name: "Vigilant Wrapping", description: "A bandage that heals while you sleep", type: "item" as const },
  },
  {
    id: "dragons",
    title: "Dragons",
    description: "Immortal if fed, tribute is law",
    gift: { name: "Dragon Scale Shard", description: "Absorbs one flame", type: "item" as const },
  },
  {
    id: "orks",
    title: "Orks of Orklin",
    description: "Industry and war machines",
    gift: { name: "Spark Gauntlet", description: "Ignites anything on contact", type: "item" as const },
  },
  {
    id: "druids",
    title: "Druids",
    description: "Balance keepers, growth and rot",
    gift: { name: "Living Seed", description: "Grows into whatever you need most", type: "spell" as const },
  },
];

const TOTAL_STEPS = 4;

export function CharacterCreation({ onComplete }: CharacterCreationProps) {
  const [step, setStep] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [name, setName] = useState("");
  const [origin, setOrigin] = useState<string | null>(null);
  const [belief, setBelief] = useState<string | null>(null);
  const [faction, setFaction] = useState<string | null>(null);

  const transition = (fn: () => void) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setTimeout(() => {
      fn();
      setIsTransitioning(false);
    }, 200);
  };

  const canContinue = () => {
    if (step === 0) return true; // name is optional
    if (step === 1) return origin !== null;
    if (step === 2) return belief !== null;
    if (step === 3) return faction !== null;
    return false;
  };

  const handleContinue = () => {
    if (!canContinue()) return;

    if (step < TOTAL_STEPS - 1) {
      transition(() => setStep(step + 1));
    } else {
      // Complete — build choices
      const selectedOrigin = ORIGINS.find((o) => o.id === origin)!;
      const selectedBelief = BELIEFS.find((b) => b.id === belief)!;
      const selectedFaction = FACTIONS.find((f) => f.id === faction)!;

      onComplete({
        name: name.trim() || "",
        origin: selectedOrigin.title,
        belief: selectedBelief.title,
        faction: selectedFaction.title,
        startingGift: selectedFaction.gift,
      });
    }
  };

  const handleBack = () => {
    if (step > 0) {
      transition(() => setStep(step - 1));
    }
  };

  const stepTitles = [
    "What is your name?",
    "How did you fall?",
    "What do you hold true?",
    "Who calls to you?",
  ];

  const stepSubtitles = [
    "Or leave blank to arrive unnamed.",
    "Every traveler reaches Tasern by a different path.",
    "In Tasern, belief is magic. This shapes what powers emerge.",
    "A faction affinity — and a gift to carry into the unknown.",
  ];

  return (
    <div className="fixed inset-0 bg-void flex items-center justify-center p-4 z-50">
      {/* Ambient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold/5 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl animate-pulse-slow" />
      </div>

      <div className="relative max-w-2xl w-full">
        {/* Content */}
        <div
          className={`transition-opacity duration-200 ${isTransitioning ? "opacity-0" : "opacity-100"}`}
        >
          {/* Step header */}
          <div className="text-center mb-6">
            <h2
              className="text-2xl text-gold mb-2"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              {stepTitles[step]}
            </h2>
            <p className="text-parchment/50 text-sm" style={{ fontFamily: "'Crimson Text', serif" }}>
              {stepSubtitles[step]}
            </p>
          </div>

          {/* Step content */}
          <div className="space-y-3">
            {/* Step 0: Name */}
            {step === 0 && (
              <div className="flex justify-center">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name..."
                  maxLength={40}
                  className="story-input w-full max-w-sm text-center text-lg"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleContinue()}
                />
              </div>
            )}

            {/* Step 1: Origin */}
            {step === 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ORIGINS.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setOrigin(o.id)}
                    className={`text-left p-4 rounded-lg border transition-all ${
                      origin === o.id
                        ? "border-gold/60 bg-gold/10"
                        : "border-gold/20 bg-void/50 hover:border-gold/40"
                    }`}
                  >
                    <h3
                      className={`text-sm font-medium mb-1 ${
                        origin === o.id ? "text-gold" : "text-parchment/80"
                      }`}
                      style={{ fontFamily: "'Cinzel', serif" }}
                    >
                      {o.title}
                    </h3>
                    <p className="text-parchment/50 text-xs" style={{ fontFamily: "'Crimson Text', serif" }}>
                      {o.description}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {/* Step 2: Belief */}
            {step === 2 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {BELIEFS.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setBelief(b.id)}
                    className={`text-left p-4 rounded-lg border transition-all ${
                      belief === b.id
                        ? "border-gold/60 bg-gold/10"
                        : "border-gold/20 bg-void/50 hover:border-gold/40"
                    }`}
                  >
                    <h3
                      className={`text-sm font-medium mb-1 ${
                        belief === b.id ? "text-gold" : "text-parchment/80"
                      }`}
                      style={{ fontFamily: "'Cinzel', serif" }}
                    >
                      {b.title}
                    </h3>
                    <p className="text-parchment/50 text-xs mb-2" style={{ fontFamily: "'Crimson Text', serif" }}>
                      {b.description}
                    </p>
                    <p className="text-purple-400/60 text-xs">{b.affinity}</p>
                  </button>
                ))}
              </div>
            )}

            {/* Step 3: Faction */}
            {step === 3 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
                {FACTIONS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFaction(f.id)}
                    className={`text-left p-4 rounded-lg border transition-all ${
                      faction === f.id
                        ? "border-gold/60 bg-gold/10"
                        : "border-gold/20 bg-void/50 hover:border-gold/40"
                    }`}
                  >
                    <h3
                      className={`text-sm font-medium mb-1 ${
                        faction === f.id ? "text-gold" : "text-parchment/80"
                      }`}
                      style={{ fontFamily: "'Cinzel', serif" }}
                    >
                      {f.title}
                    </h3>
                    <p className="text-parchment/50 text-xs mb-2" style={{ fontFamily: "'Crimson Text', serif" }}>
                      {f.description}
                    </p>
                    <p className="text-gold/40 text-xs">
                      Gift: <span className="text-gold/60">{f.gift.name}</span>
                      <span className="text-parchment/30"> — {f.gift.description}</span>
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          {/* Progress dots */}
          <div className="flex gap-2">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  i === step ? "bg-gold w-6" : i < step ? "bg-gold/60" : "bg-gold/30"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            {step > 0 && (
              <button
                onClick={handleBack}
                className="text-parchment/40 hover:text-parchment/60 text-sm"
              >
                Back
              </button>
            )}
            <button
              onClick={handleContinue}
              disabled={!canContinue()}
              className="btn-primary flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {step === TOTAL_STEPS - 1 ? "Enter Tasern" : "Continue"}
              <span className="text-lg">{step === TOTAL_STEPS - 1 ? ">" : ">"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
