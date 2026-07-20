"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useWebLLM } from "@/hooks/useWebLLM";
import { useLocalOllama } from "@/hooks/useLocalOllama";
import { useWalletContext } from "@/hooks/useWalletContext";
import { useStoryEngine, getRollTier, rollD20 } from "@/hooks/useStoryEngine";
import { WebLLMSetup } from "./WebLLMSetup";
import { CharacterCreation, type CharacterChoices } from "./CharacterCreation";
import { useStoryStore, type SavedStory } from "@/state/storyStore";

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function StoryInterface() {
  const { address, isConnected } = useWalletContext();
  const [input, setInput] = useState("");
  const [hasStarted, setHasStarted] = useState(false);
  const [showWebLLMSetup, setShowWebLLMSetup] = useState(false);
  const [showAdvancedSetup, setShowAdvancedSetup] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [diceRoll, setDiceRoll] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [showStatus, setShowStatus] = useState(false);
  const [showCharCreation, setShowCharCreation] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const rollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { stories, getActiveStory, deleteStory, clearActiveStory, storageError, clearStorageError } =
    useStoryStore();

  const {
    isReady: webLLMReady,
    status: webLLMStatus,
    hasDeclinedWebLLM,
  } = useWebLLM();

  const {
    available: localOllamaAvailable,
    isChecking: checkingLocalOllama,
    selectedModel: localOllamaModel,
  } = useLocalOllama();

  const {
    messages,
    isLoading,
    pendingRoll,
    llmSource,
    startStory: startStoryEngine,
    continueStory: continueStoryEngine,
    sendAction,
    resolveAIRoll,
    resetSession,
  } = useStoryEngine();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Animated dice roll - cycles through random numbers then lands
  const animateRoll = useCallback((onComplete?: (result: number) => void) => {
    if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
    setIsRolling(true);
    const finalResult = rollD20();
    let ticks = 0;
    const maxTicks = 10;
    rollIntervalRef.current = setInterval(() => {
      setDiceRoll(rollD20());
      ticks++;
      if (ticks >= maxTicks) {
        if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
        rollIntervalRef.current = null;
        setDiceRoll(finalResult);
        setIsRolling(false);
        onComplete?.(finalResult);
      }
    }, 50);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Clear any in-flight dice animation if the component unmounts
  useEffect(() => {
    return () => {
      if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
    };
  }, []);

  const activeStory = getActiveStory();

  const handleStartNew = () => {
    setShowCharCreation(true);
  };

  const handleCharacterComplete = async (choices: CharacterChoices) => {
    setShowCharCreation(false);
    setHasStarted(true);
    await startStoryEngine(choices);
  };

  const handleContinue = (story: SavedStory) => {
    continueStoryEngine(story);
    setHasStarted(true);
  };

  const handleExitStory = () => {
    clearActiveStory();
    resetSession();
    setHasStarted(false);
    setDiceRoll(null);
    setPendingAction(null);
    setShowStatus(false);
    setShowCharCreation(false);
  };

  const handleDeleteStory = (id: string) => {
    if (deletingId === id) {
      deleteStory(id);
      setDeletingId(null);
    } else {
      setDeletingId(id);
      setTimeout(() => setDeletingId(null), 3000);
    }
  };

  const submitAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    setPendingAction(input.trim());
    setInput("");
    setDiceRoll(null);
  };

  const handlePendingRollClick = () => {
    animateRoll(async (result) => {
      await resolveAIRoll(result);
    });
  };

  const shouldOfferWebLLM =
    !hasDeclinedWebLLM &&
    !webLLMReady &&
    webLLMStatus !== "unsupported" &&
    webLLMStatus !== "downloading" &&
    webLLMStatus !== "loading";

  if (showWebLLMSetup) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <WebLLMSetup
          onReady={() => setShowWebLLMSetup(false)}
          onSkip={() => setShowWebLLMSetup(false)}
        />
      </div>
    );
  }

  if (showCharCreation) {
    return <CharacterCreation onComplete={handleCharacterComplete} />;
  }

  const hasAnyAI = localOllamaAvailable || webLLMReady;
  const isLoadingWebLLM = webLLMStatus === "downloading" || webLLMStatus === "loading";
  const isCheckingAI = checkingLocalOllama;

  const sortedStories = [...stories].sort((a, b) => b.updatedAt - a.updatedAt);

  // Pre-story screen
  if (!hasStarted) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-xl w-full text-center space-y-8 animate-fade-in">
          <div className="space-y-4">
            <h2 className="text-2xl text-gold" style={{ fontFamily: "'Cinzel', serif" }}>
              Welcome, Traveler
            </h2>
            <p className="text-parchment/70">
              You feel yourself falling—through time, through space, through the
              membrane between what is and what was. The slow gravity of Tasern
              has caught you.
            </p>
          </div>

          <div className="text-sm space-y-2">
            {isCheckingAI ? (
              <span className="text-parchment/50">Checking AI availability...</span>
            ) : (
              <>
                {localOllamaAvailable && (
                  <div className="text-green-400">Local Ollama Ready ({localOllamaModel})</div>
                )}
                {webLLMReady ? (
                  <div className="text-green-400">Browser AI Ready</div>
                ) : isLoadingWebLLM ? (
                  <div className="text-gold">Loading Browser AI...</div>
                ) : null}
                {!hasAnyAI && !isLoadingWebLLM && (
                  <div className="text-red-400/80">No AI Backend Available</div>
                )}
              </>
            )}
          </div>

          {!isCheckingAI && !hasAnyAI && !isLoadingWebLLM && (
            <div className="bg-void/50 border border-gold/30 rounded-lg p-4 text-sm text-parchment/80">
              <p className="font-semibold text-gold mb-2">AI Required</p>
              <p className="text-parchment/60 mb-4">
                Click below to download the storytelling engine (~2GB). Runs entirely in your browser - no installation needed.
              </p>

              <div className="border-t border-gold/20 pt-3 mt-3">
                <button
                  onClick={() => setShowAdvancedSetup(!showAdvancedSetup)}
                  className="text-xs text-parchment/40 hover:text-parchment/60 flex items-center gap-1"
                >
                  <span className={`transition-transform ${showAdvancedSetup ? "rotate-90" : ""}`}>&#9654;</span>
                  Advanced: Use local Ollama instead
                </button>

                {showAdvancedSetup && (
                  <div className="mt-3 p-3 bg-gray-900/50 rounded text-xs text-parchment/50">
                    <p className="mb-2 text-parchment/60">For faster performance with local Ollama:</p>
                    <ol className="space-y-1.5 list-decimal list-inside">
                      <li>
                        Install from{" "}
                        <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300">
                          ollama.ai
                        </a>
                      </li>
                      <li>
                        Run: <code className="bg-gray-800 px-1 rounded text-green-400">ollama pull llama3.2</code>
                      </li>
                      <li>
                        Start with CORS enabled:
                        <div className="mt-1 p-2 bg-gray-800 rounded font-mono text-green-400 select-all text-[10px]">
                          {typeof window !== "undefined" && navigator.platform?.includes("Win")
                            ? "set OLLAMA_ORIGINS=https://tasern-4.vercel.app && ollama serve"
                            : "OLLAMA_ORIGINS=https://tasern-4.vercel.app ollama serve"}
                        </div>
                      </li>
                      <li>Refresh this page</li>
                    </ol>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleStartNew}
              className="btn-primary text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!hasAnyAI && !isLoadingWebLLM}
            >
              {isCheckingAI ? "Checking..." : "Begin New Story"}
            </button>

            {shouldOfferWebLLM && (
              <button
                onClick={() => setShowWebLLMSetup(true)}
                className={`block w-full text-sm ${
                  !hasAnyAI ? "text-gold hover:text-gold/80 font-semibold" : "text-parchment/50 hover:text-parchment/70"
                }`}
              >
                {!hasAnyAI ? "Download Browser AI (Recommended)" : "Enable Local AI (runs in browser)"}
              </button>
            )}
          </div>

          {sortedStories.length > 0 && (
            <div className="space-y-3 text-left">
              <h3
                className="text-sm text-parchment/50 tracking-widest uppercase text-center"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                Saved Stories
              </h3>
              <div className="space-y-2">
                {sortedStories.map((story) => (
                  <div
                    key={story.id}
                    className="bg-void/50 border border-gold/20 rounded-lg p-4 hover:border-gold/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-gold text-sm font-medium truncate" style={{ fontFamily: "'Cinzel', serif" }}>
                          {story.title}
                        </h4>
                        <p className="text-parchment/40 text-xs mt-1">
                          {formatTimeAgo(story.updatedAt)} · {story.messages.length} messages
                          {story.memory.currentLocation && <span> · {story.memory.currentLocation}</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleContinue(story)}
                          disabled={!hasAnyAI && !isLoadingWebLLM}
                          className="text-sm text-gold hover:text-gold/80 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Continue
                        </button>
                        <button
                          onClick={() => handleDeleteStory(story.id)}
                          className={`text-xs ${
                            deletingId === story.id ? "text-red-400" : "text-parchment/30 hover:text-red-400/60"
                          }`}
                        >
                          {deletingId === story.id ? "Confirm?" : "Delete"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isConnected && address && (
            <p className="text-parchment/40 text-sm">
              Connected as {address.slice(0, 6)}...{address.slice(-4)}
            </p>
          )}
        </div>
      </div>
    );
  }

  const hasStatusContent = activeStory?.memory && (
    activeStory.memory.inventory.length > 0 ||
    activeStory.memory.spells.length > 0 ||
    activeStory.memory.npcsEncountered.length > 0 ||
    activeStory.memory.characterName
  );

  const dominantBeliefs = activeStory?.memory?.beliefStrengths
    ? Object.entries(activeStory.memory.beliefStrengths).sort(([, a], [, b]) => b - a).slice(0, 3)
    : [];

  // Story interface
  return (
    <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full relative">
      {storageError && (
        <div className="mx-4 mt-2 flex items-center justify-between gap-3 rounded border border-red-400/40 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          <span>Saving failed — your browser storage may be full. Older stories can be deleted to free space.</span>
          <button onClick={clearStorageError} className="shrink-0 text-red-300/60 hover:text-red-300">
            dismiss
          </button>
        </div>
      )}
      <div className="flex justify-end px-4 pt-2">
        <button
          onClick={() => setShowStatus(!showStatus)}
          className={`text-xs tracking-widest uppercase px-3 py-1 border rounded transition-all ${
            showStatus ? "text-gold border-gold/40 bg-gold/10" : "text-parchment/40 border-gold/20 hover:text-gold hover:border-gold/40"
          }`}
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          Journal
          {hasStatusContent && !showStatus && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-gold" />}
        </button>
      </div>

      {showStatus && (
        <div className="absolute top-10 right-4 z-40 w-72 max-h-[70vh] overflow-y-auto bg-void/95 border border-gold/30 rounded-lg p-5 shadow-2xl animate-fade-in">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-gold text-sm tracking-widest uppercase" style={{ fontFamily: "'Cinzel', serif" }}>
              Journal
            </h3>
            <button onClick={() => setShowStatus(false)} className="text-parchment/30 hover:text-parchment/60 text-xs">
              close
            </button>
          </div>

          <div className="space-y-1 mb-4">
            <h4 className="text-gold/60 text-xs tracking-widest uppercase" style={{ fontFamily: "'Cinzel', serif" }}>
              Character
            </h4>
            <p className="text-parchment/80 text-sm">{activeStory?.memory?.characterName || "Unknown"}</p>
            <p className="text-parchment/50 text-xs">{activeStory?.memory?.currentLocation || "Location unknown"}</p>
            {activeStory?.memory?.faction && <p className="text-gold/50 text-xs">{activeStory.memory.faction}</p>}
          </div>

          {dominantBeliefs.length > 0 && (
            <div className="space-y-1 mb-4">
              <h4 className="text-purple-400/60 text-xs tracking-widest uppercase" style={{ fontFamily: "'Cinzel', serif" }}>
                Dominant Beliefs
              </h4>
              <ul className="space-y-1">
                {dominantBeliefs.map(([belief, strength]) => (
                  <li key={belief} className="text-parchment/70 text-xs">
                    <span className="text-purple-400/70">{"★".repeat(Math.min(strength, 5))}</span> {belief}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-1 mb-4">
            <h4 className="text-gold/60 text-xs tracking-widest uppercase" style={{ fontFamily: "'Cinzel', serif" }}>
              Inventory
            </h4>
            {activeStory?.memory?.inventory && activeStory.memory.inventory.length > 0 ? (
              <ul className="space-y-1.5">
                {activeStory.memory.inventory.map((item) => (
                  <li key={item.name} className="text-sm">
                    <span className="text-gold/90">{item.name}</span>
                    {item.description && <p className="text-parchment/40 text-xs">{item.description}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-parchment/30 text-xs italic">Empty</p>
            )}
          </div>

          <div className="space-y-1 mb-4">
            <h4 className="text-purple-400/60 text-xs tracking-widest uppercase" style={{ fontFamily: "'Cinzel', serif" }}>
              Spells
            </h4>
            {activeStory?.memory?.spells && activeStory.memory.spells.length > 0 ? (
              <ul className="space-y-1.5">
                {activeStory.memory.spells.map((spell) => (
                  <li key={spell.name} className="text-sm">
                    <span className="text-purple-400/90">{spell.name}</span>
                    {spell.description && <p className="text-parchment/40 text-xs">{spell.description}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-parchment/30 text-xs italic">None learned</p>
            )}
          </div>

          {activeStory?.memory?.npcsEncountered && activeStory.memory.npcsEncountered.length > 0 && (
            <div className="space-y-1 mb-4">
              <h4 className="text-gold/60 text-xs tracking-widest uppercase" style={{ fontFamily: "'Cinzel', serif" }}>
                Known NPCs
              </h4>
              <ul className="space-y-1">
                {activeStory.memory.npcsEncountered.map((npc) => (
                  <li key={npc} className="text-parchment/60 text-xs">{npc}</li>
                ))}
              </ul>
            </div>
          )}

          {activeStory?.memory?.summary && (
            <div className="space-y-1 border-t border-gold/10 pt-3">
              <h4 className="text-gold/60 text-xs tracking-widest uppercase" style={{ fontFamily: "'Cinzel', serif" }}>
                Story So Far
              </h4>
              <p className="text-parchment/40 text-xs leading-relaxed">
                {activeStory.memory.summary.slice(0, 500)}
                {activeStory.memory.summary.length > 500 && "..."}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`animate-fade-in ${
              message.role === "player" ? "pl-8 border-l-2 border-gold/40" : message.role === "system" ? "text-center" : ""
            }`}
          >
            {message.role === "player" && (
              <>
                <p className="text-gold/60 text-sm mb-1 tracking-wide" style={{ fontFamily: "'Cinzel', serif" }}>
                  YOUR ACTION
                </p>
                {message.diceRoll && (
                  <p className={`text-xs mb-1 ${getRollTier(message.diceRoll).color}`}>
                    d20: {message.diceRoll} — {getRollTier(message.diceRoll).name}
                  </p>
                )}
              </>
            )}
            {message.role === "system" && message.diceRoll && (
              <div className="inline-flex items-center gap-2 bg-void/60 border border-gold/30 rounded-full px-4 py-1.5">
                <span className={`text-sm font-bold ${getRollTier(message.diceRoll).color}`}>
                  d20: {message.diceRoll}
                </span>
                <span className={`text-xs ${getRollTier(message.diceRoll).color}`}>
                  {getRollTier(message.diceRoll).name}
                </span>
              </div>
            )}
            {message.role === "system" && !message.diceRoll && (
              <div
                className={`inline-flex items-center gap-1 text-sm italic ${
                  message.content.startsWith("+")
                    ? "text-gold"
                    : message.content.startsWith("✦")
                    ? "text-purple-400"
                    : message.content.startsWith("-") || message.content.startsWith("✧")
                    ? "text-parchment/40"
                    : "text-parchment/50"
                }`}
              >
                {message.content}
              </div>
            )}
            {message.role !== "system" && (
              <div className={`story-text ${message.role === "player" ? "text-gold/90 italic" : "text-parchment/90"}`}>
                {message.content || (
                  <span className="loading-dots text-parchment/50">The story unfolds</span>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gold/20 p-4 bg-void/80 backdrop-blur-sm">
        {pendingRoll ? (
          <div className="max-w-4xl mx-auto text-center space-y-3">
            <p className="text-parchment/60 text-sm italic">{pendingRoll}</p>
            <p className="text-gold text-sm tracking-widest uppercase" style={{ fontFamily: "'Cinzel', serif" }}>
              The fates demand a roll
            </p>
            {diceRoll && !isRolling ? (
              <div className="space-y-2">
                <p className={`text-3xl font-bold ${getRollTier(diceRoll).color}`}>{diceRoll}</p>
                <p className={`text-sm ${getRollTier(diceRoll).color}`}>{getRollTier(diceRoll).name}</p>
                <button onClick={handlePendingRollClick} disabled={isLoading} className="btn-primary">
                  Accept Fate
                </button>
              </div>
            ) : (
              <button
                onClick={() => animateRoll()}
                disabled={isRolling}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gold/10 border border-gold/40 rounded-lg text-gold hover:bg-gold/20 hover:border-gold/60 transition-all text-lg"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                {isRolling ? <span className="text-2xl font-bold">{diceRoll}</span> : <>Roll d20</>}
              </button>
            )}
          </div>
        ) : pendingAction ? (
          <div className="max-w-4xl mx-auto text-center space-y-3">
            <p className="text-parchment/60 text-sm italic">&ldquo;{pendingAction}&rdquo;</p>
            <p className="text-gold text-sm tracking-widest uppercase" style={{ fontFamily: "'Cinzel', serif" }}>
              Roll for fate
            </p>
            {diceRoll && !isRolling ? (
              <div className="space-y-2">
                <p className={`text-3xl font-bold ${getRollTier(diceRoll).color}`}>{diceRoll}</p>
                <p className={`text-sm ${getRollTier(diceRoll).color}`}>{getRollTier(diceRoll).name}</p>
                <button
                  onClick={() => {
                    const action = pendingAction;
                    const roll = diceRoll;
                    setPendingAction(null);
                    sendAction(action, roll);
                  }}
                  disabled={isLoading}
                  className="btn-primary"
                >
                  Accept Fate
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={() => animateRoll()}
                  disabled={isRolling}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gold/10 border border-gold/40 rounded-lg text-gold hover:bg-gold/20 hover:border-gold/60 transition-all text-lg"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  {isRolling ? <span className="text-2xl font-bold">{diceRoll}</span> : <>Roll d20</>}
                </button>
                <button
                  onClick={() => {
                    setInput(pendingAction);
                    setPendingAction(null);
                  }}
                  className="block mx-auto text-parchment/30 hover:text-parchment/60 text-xs"
                >
                  change action
                </button>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={submitAction} className="max-w-4xl mx-auto">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="What do you do?"
                className="story-input flex-1"
                disabled={isLoading}
              />
              <button type="submit" disabled={isLoading || !input.trim()} className="btn-primary">
                {isLoading ? "..." : "Act"}
              </button>
            </div>
            <div className="flex justify-between items-center mt-2 text-xs">
              <p className="text-parchment/30">
                Describe your action, speak to characters, or explore the world
              </p>
              <div className="flex items-center gap-3">
                {llmSource && (
                  <p className="text-parchment/30">
                    {llmSource === "local-ollama" ? "Local Ollama" : "Browser AI"}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleExitStory}
                  className="text-parchment/30 hover:text-parchment/60"
                >
                  Exit Story
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
