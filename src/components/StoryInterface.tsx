"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { useWebLLM } from "@/hooks/useWebLLM";
import { WebLLMSetup } from "./WebLLMSetup";

interface StoryMessage {
  id: string;
  role: "narrator" | "player" | "system";
  content: string;
  timestamp: number;
}

interface ServerLLMStatus {
  local: { available: boolean; url: string; model: string };
  anthropic: { available: boolean };
  active: "local" | "anthropic" | "none";
  serverAvailable: boolean;
}

const START_PROMPT = `Begin an interactive story for a new arrival to Tasern.

The character has just fallen through the cosmic drain—that space between dying worlds where Tasern's slow gravity catches the lost. They're waking up somewhere on Tasern (you choose where—make it interesting and evocative).

Describe their arrival with rich sensory detail. Establish the strangeness of this world at the edge of existence. End with a situation that invites action—perhaps they see something, someone approaches, or they face an immediate choice.

Do NOT ask them questions directly. Simply narrate their arrival and leave space for them to act.

Keep the opening to 2-3 paragraphs. Make it memorable.`;

export function StoryInterface() {
  const { address } = useAccount();
  const [messages, setMessages] = useState<StoryMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [showWebLLMSetup, setShowWebLLMSetup] = useState(false);
  const [llmSource, setLlmSource] = useState<"webllm" | "server" | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerLLMStatus | null>(null);
  const [checkingServer, setCheckingServer] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    isReady: webLLMReady,
    status: webLLMStatus,
    preferWebLLM,
    hasDeclinedWebLLM,
    generate: webLLMGenerate,
  } = useWebLLM();

  // Check server LLM status on mount
  useEffect(() => {
    async function checkServerStatus() {
      try {
        const res = await fetch("/api/llm/status");
        const data = await res.json();
        setServerStatus(data);
      } catch {
        setServerStatus({
          local: { available: false, url: "", model: "" },
          anthropic: { available: false },
          active: "none",
          serverAvailable: false,
        });
      } finally {
        setCheckingServer(false);
      }
    }
    checkServerStatus();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  // Generate using server API (Ollama → Anthropic)
  const generateWithServer = useCallback(
    async (
      action: "start" | "continue",
      playerAction: string | undefined,
      history: StoryMessage[],
      messageId: string
    ) => {
      try {
        const response = await fetch("/api/story", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            playerAction,
            history: history.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            address,
          }),
        });

        if (!response.ok) throw new Error("Server request failed");

        // Check which LLM was used
        const provider = response.headers.get("X-LLM-Provider");
        setLlmSource(provider === "local" ? "server" : "server");

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          let fullContent = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            fullContent += chunk;

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === messageId ? { ...msg, content: fullContent } : msg
              )
            );
          }
        }
        return true;
      } catch (e) {
        console.error("[Server] Generation failed:", e);
        return false;
      }
    },
    [address]
  );

  // Smart generate with fallback chain: WebLLM → Server (Ollama → Anthropic)
  const smartGenerate = useCallback(
    async (
      action: "start" | "continue",
      prompt: string,
      history: StoryMessage[],
      messageId: string
    ) => {
      // Try WebLLM first if ready and preferred
      if (webLLMReady && preferWebLLM && !hasDeclinedWebLLM) {
        console.log("[AI] Trying WebLLM...");
        const success = await generateWithWebLLM(prompt, history, messageId);
        if (success) return;
        console.log("[AI] WebLLM failed, falling back to server...");
      }

      // Fall back to server
      console.log("[AI] Using server API...");
      const success = await generateWithServer(
        action,
        action === "continue" ? prompt : undefined,
        history,
        messageId
      );

      if (!success) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? {
                  ...msg,
                  content:
                    "The threads of fate tangle... something interferes with your arrival. (Connection error - please try again)",
                }
              : msg
          )
        );
      }
    },
    [
      webLLMReady,
      preferWebLLM,
      hasDeclinedWebLLM,
      generateWithWebLLM,
      generateWithServer,
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
  const hasAnyAI = webLLMReady || serverStatus?.serverAvailable;
  const isLoadingWebLLM = webLLMStatus === "downloading" || webLLMStatus === "loading";

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
            {checkingServer ? (
              <span className="text-parchment/50">● Checking AI availability...</span>
            ) : (
              <>
                {webLLMReady ? (
                  <div className="text-green-400">● Browser AI Ready</div>
                ) : isLoadingWebLLM ? (
                  <div className="text-gold">● Loading Browser AI...</div>
                ) : null}

                {serverStatus?.local.available ? (
                  <div className="text-green-400">● Local Server (Ollama) Ready</div>
                ) : serverStatus?.anthropic.available ? (
                  <div className="text-green-400">● Cloud AI (Anthropic) Ready</div>
                ) : !webLLMReady && !isLoadingWebLLM ? (
                  <div className="text-red-400/80">● No AI Backend Available</div>
                ) : null}
              </>
            )}
          </div>

          {/* No AI warning */}
          {!checkingServer && !hasAnyAI && !isLoadingWebLLM && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 text-sm text-parchment/80">
              <p className="font-semibold text-red-400 mb-2">No AI Available</p>
              <p className="mb-3">To play, you need at least one AI option:</p>
              <ul className="text-left space-y-1 text-parchment/60">
                <li>• <span className="text-gold">Browser AI</span> - Click below to download (~2GB)</li>
                <li>• <span className="text-gold">Ollama</span> - Run <code className="bg-void/50 px-1 rounded">ollama serve</code> locally</li>
                <li>• <span className="text-gold">Anthropic</span> - Add ANTHROPIC_API_KEY to .env.local</li>
              </ul>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={startStory}
              className="btn-primary text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!hasAnyAI && !isLoadingWebLLM}
            >
              {checkingServer ? "Checking..." : "Begin Your Story"}
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

          <p className="text-parchment/40 text-sm">
            Connected as {address?.slice(0, 6)}...{address?.slice(-4)}
          </p>
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
                {llmSource === "webllm" ? "🖥️ Browser AI" : "☁️ Server AI"}
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
