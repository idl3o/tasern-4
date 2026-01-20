"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { useWebLLM } from "@/hooks/useWebLLM";
import { useLocalOllama } from "@/hooks/useLocalOllama";
import { WebLLMSetup } from "./WebLLMSetup";

interface StoryMessage {
  id: string;
  role: "narrator" | "player" | "system";
  content: string;
  timestamp: number;
}


const START_PROMPT = `Begin an interactive story for a new arrival to Tasern.

The character has just fallen through the cosmic drain—that space between dying worlds where Tasern's slow gravity catches the lost. They're waking up somewhere on Tasern (you choose where—make it interesting and evocative).

Describe their arrival with rich sensory detail. Establish the strangeness of this world at the edge of existence. End with a situation that invites action—perhaps they see something, someone approaches, or they face an immediate choice.

Do NOT ask them questions directly. Simply narrate their arrival and leave space for them to act.

Keep the opening to 2-3 paragraphs. Make it memorable.`;

export function StoryInterface() {
  const { address, isConnected } = useAccount();
  const [messages, setMessages] = useState<StoryMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [showWebLLMSetup, setShowWebLLMSetup] = useState(false);
  const [llmSource, setLlmSource] = useState<"local-ollama" | "webllm" | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    isReady: webLLMReady,
    status: webLLMStatus,
    preferWebLLM,
    hasDeclinedWebLLM,
    generate: webLLMGenerate,
  } = useWebLLM();

  const {
    available: localOllamaAvailable,
    isChecking: checkingLocalOllama,
    selectedModel: localOllamaModel,
    generate: localOllamaGenerate,
  } = useLocalOllama();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // World context for local generation
  const WORLD_CONTEXT = `You are the narrator for Tales of Tasern, an interactive fiction experience.
Tasern exists at the edge of reality, where time moves slowly. It orbits twin suns and has three moons.
In Tasern, BELIEF IS MAGIC - what enough minds hold true becomes true.
Write in second person with rich, evocative prose. Never break character.`;

  // Generate using local Ollama (browser direct)
  const generateWithLocalOllama = useCallback(
    async (prompt: string, messageId: string) => {
      try {
        let fullContent = "";
        for await (const chunk of localOllamaGenerate(prompt, WORLD_CONTEXT)) {
          fullContent += chunk;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === messageId ? { ...msg, content: fullContent } : msg
            )
          );
        }
        setLlmSource("local-ollama");
        return true;
      } catch (e) {
        console.error("[Local Ollama] Generation failed:", e);
        return false;
      }
    },
    [localOllamaGenerate]
  );

  // Generate using WebLLM (browser)
  const generateWithWebLLM = useCallback(
    async (prompt: string, history: StoryMessage[], messageId: string) => {
      try {
        const historyForLLM = history.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        let fullContent = "";
        for await (const chunk of webLLMGenerate(prompt, historyForLLM)) {
          fullContent += chunk;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === messageId ? { ...msg, content: fullContent } : msg
            )
          );
        }
        setLlmSource("webllm");
        return true;
      } catch (e) {
        console.error("[WebLLM] Generation failed:", e);
        return false;
      }
    },
    [webLLMGenerate]
  );

  // Smart generate with fallback chain: Local Ollama → WebLLM
  const smartGenerate = useCallback(
    async (
      action: "start" | "continue",
      prompt: string,
      history: StoryMessage[],
      messageId: string
    ) => {
      // Try local Ollama first (browser direct to localhost)
      if (localOllamaAvailable) {
        console.log("[AI] Trying local Ollama (browser direct)...");
        const success = await generateWithLocalOllama(prompt, messageId);
        if (success) return;
        console.log("[AI] Local Ollama failed, trying WebLLM...");
      }

      // Try WebLLM if ready
      if (webLLMReady) {
        console.log("[AI] Trying WebLLM...");
        const success = await generateWithWebLLM(prompt, history, messageId);
        if (success) return;
        console.log("[AI] WebLLM failed");
      }

      // No AI available - show error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                content:
                  "The threads of fate tangle... something interferes with your arrival. (No AI available - please ensure Ollama is running)",
              }
            : msg
        )
      );
    },
    [
      localOllamaAvailable,
      generateWithLocalOllama,
      webLLMReady,
      generateWithWebLLM,
    ]
  );

  const startStory = async () => {
    setIsLoading(true);
    setHasStarted(true);

    const openingId = crypto.randomUUID();
    setMessages([
      {
        id: openingId,
        role: "narrator",
        content: "",
        timestamp: Date.now(),
      },
    ]);

    await smartGenerate("start", START_PROMPT, [], openingId);
    setIsLoading(false);
  };

  const submitAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const playerAction = input.trim();
    setInput("");

    const playerId = crypto.randomUUID();
    const narratorId = crypto.randomUUID();

    const newMessages: StoryMessage[] = [
      ...messages,
      {
        id: playerId,
        role: "player",
        content: playerAction,
        timestamp: Date.now(),
      },
      {
        id: narratorId,
        role: "narrator",
        content: "",
        timestamp: Date.now(),
      },
    ];

    setMessages(newMessages);
    setIsLoading(true);

    const prompt = `Continue the story based on the player's action: "${playerAction}"

React to what they do naturally within the world's logic. Remember:
- Belief shapes reality in Tasern
- NPCs have their own goals and personalities
- The world is alive and reactive
- Consequences flow from actions

Write 2-4 paragraphs continuing the narrative. End in a way that invites further action.`;

    await smartGenerate("continue", prompt, newMessages.slice(0, -1), narratorId);
    setIsLoading(false);
  };

  // Check if we should show WebLLM setup
  const shouldOfferWebLLM =
    !hasDeclinedWebLLM &&
    !webLLMReady &&
    webLLMStatus !== "unsupported" &&
    webLLMStatus !== "downloading" &&
    webLLMStatus !== "loading";

  // Show WebLLM setup screen
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

  // Determine if ANY AI is available
  const hasAnyAI = localOllamaAvailable || webLLMReady;
  const isLoadingWebLLM = webLLMStatus === "downloading" || webLLMStatus === "loading";
  const isCheckingAI = checkingLocalOllama;

  // Pre-story screen
  if (!hasStarted) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-xl text-center space-y-8 animate-fade-in">
          <div className="space-y-4">
            <h2
              className="text-2xl text-gold"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Welcome, Traveler
            </h2>
            <p className="text-parchment/70">
              You feel yourself falling—through time, through space, through the
              membrane between what is and what was. The slow gravity of Tasern
              has caught you.
            </p>
          </div>

          {/* AI Status indicator */}
          <div className="text-sm space-y-2">
            {isCheckingAI ? (
              <span className="text-parchment/50">● Checking AI availability...</span>
            ) : (
              <>
                {localOllamaAvailable && (
                  <div className="text-green-400">● Local Ollama Ready ({localOllamaModel})</div>
                )}

                {webLLMReady ? (
                  <div className="text-green-400">● Browser AI Ready</div>
                ) : isLoadingWebLLM ? (
                  <div className="text-gold">● Loading Browser AI...</div>
                ) : null}

                {!hasAnyAI && !isLoadingWebLLM && (
                  <div className="text-red-400/80">● No AI Backend Available</div>
                )}
              </>
            )}
          </div>

          {/* No AI warning */}
          {!isCheckingAI && !hasAnyAI && !isLoadingWebLLM && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 text-sm text-parchment/80">
              <p className="font-semibold text-red-400 mb-2">No AI Available</p>
              <p className="mb-3">Choose how to power your story:</p>

              <div className="text-left space-y-4">
                {/* Browser AI Option */}
                <div className="bg-green-900/20 border border-green-500/30 rounded p-3">
                  <span className="text-green-400 font-medium">✨ Browser AI (Easiest)</span>
                  <p className="text-xs mt-1 text-parchment/60">
                    Click the button below to download a ~2GB model. Runs entirely in your browser - no installation needed.
                  </p>
                </div>

                {/* Local Ollama Option */}
                <div className="bg-blue-900/20 border border-blue-500/30 rounded p-3">
                  <span className="text-blue-400 font-medium">🦙 Local Ollama (Faster)</span>
                  <p className="text-xs mt-1 text-parchment/60 mb-2">
                    Better performance if you have Ollama installed locally.
                  </p>
                  <ol className="text-xs space-y-1.5 text-parchment/50 list-decimal list-inside">
                    <li>
                      Install from{" "}
                      <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300">
                        ollama.ai
                      </a>
                    </li>
                    <li>
                      Open a terminal and run:{" "}
                      <code className="bg-gray-800 px-1.5 py-0.5 rounded text-green-400">ollama pull llama3.2</code>
                    </li>
                    <li>
                      Start Ollama with web access enabled:
                      <div className="mt-1 p-2 bg-gray-800 rounded font-mono text-green-400 select-all text-[10px]">
                        {typeof window !== 'undefined' && navigator.platform?.includes('Win')
                          ? 'set OLLAMA_ORIGINS=https://tasern-4.vercel.app && ollama serve'
                          : 'OLLAMA_ORIGINS=https://tasern-4.vercel.app ollama serve'}
                      </div>
                    </li>
                    <li>Refresh this page</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={startStory}
              className="btn-primary text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!hasAnyAI && !isLoadingWebLLM}
            >
              {isCheckingAI ? "Checking..." : "Begin Your Story"}
            </button>

            {shouldOfferWebLLM && (
              <button
                onClick={() => setShowWebLLMSetup(true)}
                className={`block w-full text-sm ${
                  !hasAnyAI
                    ? "text-gold hover:text-gold/80 font-semibold"
                    : "text-parchment/50 hover:text-parchment/70"
                }`}
              >
                {!hasAnyAI ? "⬇ Download Browser AI (Recommended)" : "Enable Local AI (runs in browser)"}
              </button>
            )}
          </div>

          {isConnected && address && (
            <p className="text-parchment/40 text-sm">
              Connected as {address.slice(0, 6)}...{address.slice(-4)}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Story interface
  return (
    <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
      {/* Story display */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`animate-fade-in ${
              message.role === "player" ? "pl-8 border-l-2 border-gold/40" : ""
            }`}
          >
            {message.role === "player" && (
              <p
                className="text-gold/60 text-sm mb-1 tracking-wide"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                YOUR ACTION
              </p>
            )}
            <div
              className={`story-text ${
                message.role === "player"
                  ? "text-gold/90 italic"
                  : "text-parchment/90"
              }`}
            >
              {message.content || (
                <span className="loading-dots text-parchment/50">
                  The story unfolds
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gold/20 p-4 bg-void/80 backdrop-blur-sm">
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
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="btn-primary"
            >
              {isLoading ? "..." : "Act"}
            </button>
          </div>
          <div className="flex justify-between items-center mt-2 text-xs">
            <p className="text-parchment/30">
              Describe your action, speak to characters, or explore the world
            </p>
            {llmSource && (
              <p className="text-parchment/30">
                {llmSource === "local-ollama" ? "🏠 Local Ollama" : "🖥️ Browser AI"}
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
