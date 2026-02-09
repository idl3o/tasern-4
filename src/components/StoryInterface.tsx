"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { useWebLLM } from "@/hooks/useWebLLM";
import { useLocalOllama } from "@/hooks/useLocalOllama";
import { WebLLMSetup } from "./WebLLMSetup";
import { CharacterCreation, type CharacterChoices } from "./CharacterCreation";
import {
  useStoryStore,
  type StoryMessage,
  type StoryMemory,
  type SavedStory,
  type InventoryItem,
} from "@/state/storyStore";

const MEMORY_EXTRACTION_THRESHOLD = 10;

const START_PROMPT = `Begin an interactive story for a new arrival to Tasern.

The character has just fallen through the cosmic drain—that space between dying worlds where Tasern's slow gravity catches the lost. They're waking up somewhere on Tasern (you choose where—make it interesting and evocative).

Describe their arrival with rich sensory detail. Establish the strangeness of this world at the edge of existence. End with a situation that invites action—perhaps they see something, someone approaches, or they face an immediate choice.

Do NOT ask them questions directly. Simply narrate their arrival and leave space for them to act.

Keep the opening to 2-3 paragraphs. Make it memorable.`;

const MEMORY_EXTRACTION_PROMPT = `Analyze this interactive story and extract key facts as JSON.
Respond ONLY with valid JSON, no other text or markdown formatting.

{
  "characterName": "name if established, or null",
  "currentLocation": "where the character currently is",
  "keyEvents": ["brief summary of each major event, max 15"],
  "npcsEncountered": ["Name - one line description"],
  "beliefs": ["things the character believes or has expressed"],
  "faction": "faction affinity if established, or null",
  "summary": "A 2-3 paragraph prose summary of the entire story so far, covering the key plot arc and current situation",
  "inventory": [{"name": "Item Name", "description": "brief description"}],
  "spells": [{"name": "Spell Name", "description": "brief description"}]
}

Here is the story:
`;

function buildMemoryContext(memory: StoryMemory): string {
  if (!memory.summary) return "";
  const parts = [`\n\n## STORY SO FAR (narrator notes)\n${memory.summary}`];
  if (memory.characterName) parts.push(`Character: ${memory.characterName}`);
  if (memory.currentLocation) parts.push(`Location: ${memory.currentLocation}`);
  if (memory.beliefs.length > 0) parts.push(`Beliefs: ${memory.beliefs.join(", ")}`);
  if (memory.faction) parts.push(`Faction: ${memory.faction}`);
  if (memory.npcsEncountered.length > 0) parts.push(`Known NPCs: ${memory.npcsEncountered.join(", ")}`);
  if (memory.inventory.length > 0) parts.push(`Inventory: ${memory.inventory.map((i) => i.name).join(", ")}`);
  if (memory.spells.length > 0) parts.push(`Known Spells: ${memory.spells.map((s) => s.name).join(", ")}`);
  return parts.join("\n");
}

function serializeMessagesForExtraction(messages: StoryMessage[]): string {
  const recent = messages.slice(-30);
  return recent
    .map((m) => {
      const label = m.role === "narrator" ? "NARRATOR" : m.role === "player" ? "PLAYER" : "SYSTEM";
      return `${label}: ${m.content}`;
    })
    .join("\n\n");
}

function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

function getRollTier(roll: number): { name: string; description: string; color: string } {
  if (roll === 1) return { name: "Critical Failure", description: "Everything goes spectacularly wrong", color: "text-red-400" };
  if (roll <= 7) return { name: "Failure", description: "The attempt fails, with consequences", color: "text-red-400/70" };
  if (roll <= 14) return { name: "Partial Success", description: "Mixed results, complications arise", color: "text-gold" };
  if (roll <= 19) return { name: "Success", description: "The action succeeds as intended", color: "text-green-400" };
  return { name: "Critical Success", description: "Beyond expectations, extraordinary outcome", color: "text-green-300" };
}

function buildDicePrompt(roll: number): string {
  const tier = getRollTier(roll);
  return `\n\n[DICE ROLL: ${roll}/20 — ${tier.name}]
The player rolled a d20 and got ${roll}. This is a ${tier.description}.
Narrate the outcome of their action with this result in mind. Do not mention dice or game mechanics explicitly — weave the success or failure naturally into the narrative.`;
}

function parseRollRequired(content: string): { cleanContent: string; reason: string | null } {
  const match = content.match(/\[ROLL_REQUIRED:\s*(.+?)\]\s*$/);
  if (match) {
    return {
      cleanContent: content.slice(0, match.index).trimEnd(),
      reason: match[1].trim(),
    };
  }
  return { cleanContent: content, reason: null };
}

function parseItemSpellTags(content: string): {
  cleanContent: string;
  itemsGained: InventoryItem[];
  itemsLost: string[];
  spellsLearned: InventoryItem[];
  spellsLost: string[];
} {
  const itemsGained: InventoryItem[] = [];
  const itemsLost: string[] = [];
  const spellsLearned: InventoryItem[] = [];
  const spellsLost: string[] = [];

  let cleaned = content;

  // [ITEM_GAINED: Name - description]
  cleaned = cleaned.replace(/\[ITEM_GAINED:\s*(.+?)\s*-\s*(.+?)\]\s*/g, (_, name, desc) => {
    itemsGained.push({ name: name.trim(), description: desc.trim() });
    return "";
  });
  // [ITEM_GAINED: Name] (no description)
  cleaned = cleaned.replace(/\[ITEM_GAINED:\s*(.+?)\]\s*/g, (_, name) => {
    itemsGained.push({ name: name.trim(), description: "" });
    return "";
  });

  // [ITEM_LOST: Name]
  cleaned = cleaned.replace(/\[ITEM_LOST:\s*(.+?)\]\s*/g, (_, name) => {
    itemsLost.push(name.trim());
    return "";
  });

  // [SPELL_LEARNED: Name - description]
  cleaned = cleaned.replace(/\[SPELL_LEARNED:\s*(.+?)\s*-\s*(.+?)\]\s*/g, (_, name, desc) => {
    spellsLearned.push({ name: name.trim(), description: desc.trim() });
    return "";
  });
  // [SPELL_LEARNED: Name] (no description)
  cleaned = cleaned.replace(/\[SPELL_LEARNED:\s*(.+?)\]\s*/g, (_, name) => {
    spellsLearned.push({ name: name.trim(), description: "" });
    return "";
  });

  // [SPELL_LOST: Name]
  cleaned = cleaned.replace(/\[SPELL_LOST:\s*(.+?)\]\s*/g, (_, name) => {
    spellsLost.push(name.trim());
    return "";
  });

  return { cleanContent: cleaned.trimEnd(), itemsGained, itemsLost, spellsLearned, spellsLost };
}

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
  const { address, isConnected } = useAccount();
  const [messages, setMessages] = useState<StoryMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [showWebLLMSetup, setShowWebLLMSetup] = useState(false);
  const [llmSource, setLlmSource] = useState<"local-ollama" | "webllm" | null>(null);
  const [showAdvancedSetup, setShowAdvancedSetup] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [diceRoll, setDiceRoll] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [pendingRoll, setPendingRoll] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [showStatus, setShowStatus] = useState(false);
  const [showCharCreation, setShowCharCreation] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const extractingRef = useRef(false);

  const {
    stories,
    activeStoryId,
    getActiveStory,
    createStory,
    loadStory,
    deleteStory,
    setActiveMessages,
    updateMemory,
    updateTitle,
    setMessageCountAtLastExtraction,
    clearActiveStory,
    addItem,
    removeItem,
    addSpell,
    removeSpell,
  } = useStoryStore();

  const {
    isReady: webLLMReady,
    status: webLLMStatus,
    preferWebLLM,
    hasDeclinedWebLLM,
    generate: webLLMGenerate,
    generateComplete: webLLMGenerateComplete,
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

  // Animated dice roll - cycles through random numbers then lands
  const animateRoll = useCallback((onComplete?: (result: number) => void) => {
    setIsRolling(true);
    const finalResult = rollD20();
    let ticks = 0;
    const maxTicks = 10;
    const interval = setInterval(() => {
      setDiceRoll(rollD20());
      ticks++;
      if (ticks >= maxTicks) {
        clearInterval(interval);
        setDiceRoll(finalResult);
        setIsRolling(false);
        onComplete?.(finalResult);
      }
    }, 50);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Get memory context for the active story
  const activeStory = getActiveStory();
  const memoryContext = activeStory?.memory ? buildMemoryContext(activeStory.memory) : "";

  // World context for local generation
  const WORLD_CONTEXT = `You are the narrator for Tales of Tasern, an interactive fiction experience.
Tasern exists at the edge of reality, where time moves slowly. It orbits twin suns and has three moons.
In Tasern, BELIEF IS MAGIC - what enough minds hold true becomes true.
Write in second person with rich, evocative prose. Never break character.
When the situation is particularly risky, dramatic, or uncertain, you may request a dice roll by ending your response with [ROLL_REQUIRED: brief reason]. Use this sparingly — only for moments of real tension like combat, dangerous actions, persuasion of hostile NPCs, or life-threatening situations.
When the player acquires a notable item, append [ITEM_GAINED: Item Name - brief description] at the end of your response.
When the player loses or uses up an item, append [ITEM_LOST: Item Name].
When the player learns a spell or ability, append [SPELL_LEARNED: Spell Name - brief description].
When a spell is lost or forgotten, append [SPELL_LOST: Spell Name].
You may include multiple tags at the end of your response, each on its own line.${memoryContext}`;

  // Auto-save messages to store after loading completes
  const saveMessages = useCallback(
    (msgs: StoryMessage[]) => {
      if (activeStoryId) {
        setActiveMessages(msgs);
      }
    },
    [activeStoryId, setActiveMessages]
  );

  // Memory extraction
  const extractMemory = useCallback(
    async (msgs: StoryMessage[]) => {
      const story = getActiveStory();
      if (!story || extractingRef.current) return;

      const sinceLastExtraction = msgs.length - story.messageCountAtLastExtraction;
      if (sinceLastExtraction < MEMORY_EXTRACTION_THRESHOLD && story.messageCountAtLastExtraction > 0) return;

      extractingRef.current = true;
      console.log("[Memory] Extracting story memory...");

      try {
        const serialized = serializeMessagesForExtraction(msgs);
        const prompt = MEMORY_EXTRACTION_PROMPT + serialized;
        let response = "";

        // Try WebLLM first (has generateComplete), then Ollama
        if (webLLMReady) {
          response = await webLLMGenerateComplete(prompt);
        } else if (localOllamaAvailable) {
          for await (const chunk of localOllamaGenerate(
            prompt,
            "You are a story analyst. Extract facts from the story as JSON. Respond ONLY with valid JSON."
          )) {
            response += chunk;
          }
        }

        if (!response) {
          console.log("[Memory] No AI available for extraction");
          return;
        }

        // Try to parse JSON from response
        let memory: StoryMemory;
        try {
          // Strip markdown code fences if present
          const jsonStr = response.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();
          const parsed = JSON.parse(jsonStr);
          memory = {
            characterName: parsed.characterName || null,
            currentLocation: parsed.currentLocation || null,
            keyEvents: Array.isArray(parsed.keyEvents) ? parsed.keyEvents.slice(0, 15) : [],
            npcsEncountered: Array.isArray(parsed.npcsEncountered) ? parsed.npcsEncountered : [],
            beliefs: Array.isArray(parsed.beliefs) ? parsed.beliefs : [],
            faction: parsed.faction || null,
            summary: parsed.summary || "",
            inventory: Array.isArray(parsed.inventory) ? parsed.inventory : [],
            spells: Array.isArray(parsed.spells) ? parsed.spells : [],
          };
        } catch {
          // Graceful degradation: store raw text as summary
          console.log("[Memory] JSON parse failed, storing raw summary");
          memory = {
            ...(story.memory || { characterName: null, currentLocation: null, keyEvents: [], npcsEncountered: [], beliefs: [], faction: null, inventory: [], spells: [] }),
            summary: response.slice(0, 2000),
          };
        }

        updateMemory(memory);
        setMessageCountAtLastExtraction(msgs.length);

        // Update title from extracted data if still the default
        if (story.title.startsWith("Story - ") && (memory.currentLocation || memory.characterName)) {
          const name = memory.characterName || "A Traveler";
          const location = memory.currentLocation || "Tasern";
          updateTitle(`${name} in ${location}`);
        }

        console.log("[Memory] Extraction complete:", memory.characterName, memory.currentLocation);
      } catch (e) {
        console.error("[Memory] Extraction failed:", e);
      } finally {
        extractingRef.current = false;
      }
    },
    [
      getActiveStory,
      webLLMReady,
      webLLMGenerateComplete,
      localOllamaAvailable,
      localOllamaGenerate,
      updateMemory,
      updateTitle,
      setMessageCountAtLastExtraction,
    ]
  );

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
    [localOllamaGenerate, WORLD_CONTEXT]
  );

  // Generate using WebLLM (browser)
  const generateWithWebLLM = useCallback(
    async (prompt: string, history: StoryMessage[], messageId: string) => {
      try {
        // Limit history to last 20 messages when memory exists
        const trimmedHistory = memoryContext && history.length > 20
          ? history.slice(-20)
          : history;

        const historyForLLM = trimmedHistory.map((m) => ({
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
    [webLLMGenerate, memoryContext]
  );

  // Smart generate with fallback chain: Local Ollama -> WebLLM
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

  // Check for item/spell tags after generation and update store
  const checkForItemSpellTags = useCallback((msgs: StoryMessage[]): StoryMessage[] => {
    const lastNarrator = [...msgs].reverse().find((m) => m.role === "narrator");
    if (!lastNarrator || !lastNarrator.content) return msgs;

    const { cleanContent, itemsGained, itemsLost, spellsLearned, spellsLost } =
      parseItemSpellTags(lastNarrator.content);

    const hasChanges =
      itemsGained.length > 0 || itemsLost.length > 0 ||
      spellsLearned.length > 0 || spellsLost.length > 0;

    if (!hasChanges) return msgs;

    // Update store
    for (const item of itemsGained) addItem(item.name, item.description);
    for (const name of itemsLost) removeItem(name);
    for (const spell of spellsLearned) addSpell(spell.name, spell.description);
    for (const name of spellsLost) removeSpell(name);

    // Build notification messages
    const notifications: StoryMessage[] = [];
    for (const item of itemsGained) {
      notifications.push({
        id: crypto.randomUUID(),
        role: "system",
        content: `+ ${item.name}${item.description ? ` — ${item.description}` : ""}`,
        timestamp: Date.now(),
      });
    }
    for (const name of itemsLost) {
      notifications.push({
        id: crypto.randomUUID(),
        role: "system",
        content: `- ${name}`,
        timestamp: Date.now(),
      });
    }
    for (const spell of spellsLearned) {
      notifications.push({
        id: crypto.randomUUID(),
        role: "system",
        content: `✦ ${spell.name}${spell.description ? ` — ${spell.description}` : ""}`,
        timestamp: Date.now(),
      });
    }
    for (const name of spellsLost) {
      notifications.push({
        id: crypto.randomUUID(),
        role: "system",
        content: `✧ Lost: ${name}`,
        timestamp: Date.now(),
      });
    }

    // Strip tags from narrator message and append notifications
    return msgs.map((msg) =>
      msg.id === lastNarrator.id ? { ...msg, content: cleanContent } : msg
    ).concat(notifications);
  }, [addItem, removeItem, addSpell, removeSpell]);

  // Check for AI-initiated roll requests after generation
  const checkForRollRequest = useCallback((msgs: StoryMessage[]) => {
    const lastNarrator = [...msgs].reverse().find((m) => m.role === "narrator");
    if (!lastNarrator || !lastNarrator.content) return;

    const { cleanContent, reason } = parseRollRequired(lastNarrator.content);
    if (reason) {
      // Strip the tag from the displayed message
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === lastNarrator.id ? { ...msg, content: cleanContent } : msg
        )
      );
      setPendingRoll(reason);
    }
  }, []);

  // Handle a pending roll (AI-initiated) — roll result triggers next generation
  const handlePendingRoll = useCallback(() => {
    animateRoll(async (result) => {
      setPendingRoll(null);

      const narratorId = crypto.randomUUID();
      const rollMsg: StoryMessage = {
        id: crypto.randomUUID(),
        role: "system",
        content: `Rolled d20: ${result} — ${getRollTier(result).name}`,
        timestamp: Date.now(),
        diceRoll: result,
      };

      setMessages((prev) => [
        ...prev,
        rollMsg,
        { id: narratorId, role: "narrator", content: "", timestamp: Date.now() },
      ]);
      setIsLoading(true);

      const tier = getRollTier(result);
      const prompt = `[DICE ROLL: ${result}/20 — ${tier.name}]
The fate roll has been cast. The result is ${result} — ${tier.description}.
Continue the story based on this roll result. Do not mention dice or game mechanics — weave the outcome naturally into the narrative.
Write 2-4 paragraphs. End in a way that invites further action.`;

      await smartGenerate("continue", prompt, messages, narratorId);
      setIsLoading(false);

      setMessages((prev) => {
        const updated = checkForItemSpellTags(prev);
        checkForRollRequest(updated);
        saveMessages(updated);
        extractMemory(updated);
        return updated;
      });
    });
  }, [animateRoll, smartGenerate, messages, checkForItemSpellTags, checkForRollRequest, saveMessages, extractMemory]);

  const startStory = () => {
    setShowCharCreation(true);
  };

  const startStoryWithCharacter = async (choices: CharacterChoices) => {
    setShowCharCreation(false);
    const storyId = createStory();

    // Seed initial memory from character creation
    updateMemory({
      characterName: choices.name || null,
      currentLocation: null,
      keyEvents: [],
      npcsEncountered: [],
      beliefs: [choices.belief],
      faction: choices.faction,
      summary: "",
      inventory: [],
      spells: [],
    });

    // Grant starting gift
    if (choices.startingGift.type === "spell") {
      addSpell(choices.startingGift.name, choices.startingGift.description);
    } else {
      addItem(choices.startingGift.name, choices.startingGift.description);
    }

    // Build custom start prompt
    const charName = choices.name || "an unnamed traveler";
    const customPrompt = `Begin an interactive story for a new arrival to Tasern.

CHARACTER DETAILS:
- Name: ${charName}
- Origin: ${choices.origin}
- Core Belief: "${choices.belief}"
- Faction Affinity: ${choices.faction} — they carry a ${choices.startingGift.name} (${choices.startingGift.description})

The character has just fallen through the cosmic drain — that space between dying worlds where Tasern's slow gravity catches the lost. They arrived because: ${choices.origin}.

Describe their arrival with rich sensory detail. Reference their ${choices.startingGift.name} naturally — they find it on their person or nearby.
Weave their belief ("${choices.belief}") into the scene — in Tasern, belief has weight and consequence.
End with a situation that invites action — perhaps they see something, someone approaches, or they face an immediate choice.

Do NOT ask them questions directly. Simply narrate their arrival and leave space for them to act.
Keep the opening to 2-3 paragraphs. Make it memorable.`;

    setIsLoading(true);
    setHasStarted(true);

    // Update title with character name
    if (choices.name) {
      updateTitle(`${choices.name}'s Tale`);
    }

    const openingId = crypto.randomUUID();
    const initialMessages: StoryMessage[] = [
      {
        id: openingId,
        role: "narrator",
        content: "",
        timestamp: Date.now(),
      },
    ];
    setMessages(initialMessages);

    await smartGenerate("start", customPrompt, [], openingId);
    setIsLoading(false);

    // Auto-save and check for tags/rolls
    setMessages((prev) => {
      const updated = checkForItemSpellTags(prev);
      checkForRollRequest(updated);
      saveMessages(updated);
      extractMemory(updated);
      return updated;
    });
  };

  const submitAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // Lock in the action and show the dice roll screen
    setPendingAction(input.trim());
    setInput("");
    setDiceRoll(null);
  };

  // Execute the locked-in action with the dice roll result
  const executeAction = useCallback(async (action: string, roll: number) => {
    setPendingAction(null);

    const playerId = crypto.randomUUID();
    const narratorId = crypto.randomUUID();

    const newMessages: StoryMessage[] = [
      ...messages,
      {
        id: playerId,
        role: "player",
        content: action,
        timestamp: Date.now(),
        diceRoll: roll,
      },
      {
        id: crypto.randomUUID(),
        role: "system",
        content: `Rolled d20: ${roll} — ${getRollTier(roll).name}`,
        timestamp: Date.now(),
        diceRoll: roll,
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

    let prompt = `Continue the story based on the player's action: "${action}"

React to what they do naturally within the world's logic. Remember:
- Belief shapes reality in Tasern
- NPCs have their own goals and personalities
- The world is alive and reactive
- Consequences flow from actions

Write 2-4 paragraphs continuing the narrative. End in a way that invites further action.`;

    prompt += buildDicePrompt(roll);

    await smartGenerate("continue", prompt, newMessages.slice(0, -1), narratorId);
    setIsLoading(false);

    // Auto-save and check for tags/rolls
    setMessages((prev) => {
      const updated = checkForItemSpellTags(prev);
      checkForRollRequest(updated);
      saveMessages(updated);
      extractMemory(updated);
      return updated;
    });
  }, [messages, smartGenerate, checkForItemSpellTags, checkForRollRequest, saveMessages, extractMemory]);

  const continueStory = (story: SavedStory) => {
    loadStory(story.id);
    setMessages(story.messages);
    setHasStarted(true);
  };

  const handleExitStory = () => {
    clearActiveStory();
    setMessages([]);
    setHasStarted(false);
    setLlmSource(null);
    setDiceRoll(null);
    setPendingRoll(null);
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

  // Show character creation flow
  if (showCharCreation) {
    return <CharacterCreation onComplete={startStoryWithCharacter} />;
  }

  // Determine if ANY AI is available
  const hasAnyAI = localOllamaAvailable || webLLMReady;
  const isLoadingWebLLM = webLLMStatus === "downloading" || webLLMStatus === "loading";
  const isCheckingAI = checkingLocalOllama;

  // Sort saved stories by most recent
  const sortedStories = [...stories].sort((a, b) => b.updatedAt - a.updatedAt);

  // Pre-story screen
  if (!hasStarted) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-xl w-full text-center space-y-8 animate-fade-in">
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

          {/* No AI warning */}
          {!isCheckingAI && !hasAnyAI && !isLoadingWebLLM && (
            <div className="bg-void/50 border border-gold/30 rounded-lg p-4 text-sm text-parchment/80">
              <p className="font-semibold text-gold mb-2">AI Required</p>
              <p className="text-parchment/60 mb-4">
                Click below to download the storytelling engine (~2GB). Runs entirely in your browser - no installation needed.
              </p>

              {/* Advanced: Local Ollama Option */}
              <div className="border-t border-gold/20 pt-3 mt-3">
                <button
                  onClick={() => setShowAdvancedSetup(!showAdvancedSetup)}
                  className="text-xs text-parchment/40 hover:text-parchment/60 flex items-center gap-1"
                >
                  <span className={`transition-transform ${showAdvancedSetup ? 'rotate-90' : ''}`}>&#9654;</span>
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
                          {typeof window !== 'undefined' && navigator.platform?.includes('Win')
                            ? 'set OLLAMA_ORIGINS=https://tasern-4.vercel.app && ollama serve'
                            : 'OLLAMA_ORIGINS=https://tasern-4.vercel.app ollama serve'}
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
              onClick={startStory}
              className="btn-primary text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!hasAnyAI && !isLoadingWebLLM}
            >
              {isCheckingAI ? "Checking..." : "Begin New Story"}
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
                {!hasAnyAI ? "Download Browser AI (Recommended)" : "Enable Local AI (runs in browser)"}
              </button>
            )}
          </div>

          {/* Saved Stories */}
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
                        <h4
                          className="text-gold text-sm font-medium truncate"
                          style={{ fontFamily: "'Cinzel', serif" }}
                        >
                          {story.title}
                        </h4>
                        <p className="text-parchment/40 text-xs mt-1">
                          {formatTimeAgo(story.updatedAt)} · {story.messages.length} messages
                          {story.memory.currentLocation && (
                            <span> · {story.memory.currentLocation}</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => continueStory(story)}
                          disabled={!hasAnyAI && !isLoadingWebLLM}
                          className="text-sm text-gold hover:text-gold/80 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Continue
                        </button>
                        <button
                          onClick={() => handleDeleteStory(story.id)}
                          className={`text-xs ${
                            deletingId === story.id
                              ? "text-red-400"
                              : "text-parchment/30 hover:text-red-400/60"
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

  // Story interface
  return (
    <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full relative">
      {/* Journal toggle */}
      <div className="flex justify-end px-4 pt-2">
        <button
          onClick={() => setShowStatus(!showStatus)}
          className={`text-xs tracking-widest uppercase px-3 py-1 border rounded transition-all ${
            showStatus
              ? "text-gold border-gold/40 bg-gold/10"
              : "text-parchment/40 border-gold/20 hover:text-gold hover:border-gold/40"
          }`}
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          Journal
          {hasStatusContent && !showStatus && (
            <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-gold" />
          )}
        </button>
      </div>

      {/* Status panel overlay */}
      {showStatus && (
        <div className="absolute top-10 right-4 z-40 w-72 max-h-[70vh] overflow-y-auto bg-void/95 border border-gold/30 rounded-lg p-5 shadow-2xl animate-fade-in">
          <div className="flex justify-between items-center mb-4">
            <h3
              className="text-gold text-sm tracking-widest uppercase"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Journal
            </h3>
            <button
              onClick={() => setShowStatus(false)}
              className="text-parchment/30 hover:text-parchment/60 text-xs"
            >
              close
            </button>
          </div>

          {/* Character */}
          <div className="space-y-1 mb-4">
            <h4
              className="text-gold/60 text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Character
            </h4>
            <p className="text-parchment/80 text-sm">
              {activeStory?.memory?.characterName || "Unknown"}
            </p>
            <p className="text-parchment/50 text-xs">
              {activeStory?.memory?.currentLocation || "Location unknown"}
            </p>
            {activeStory?.memory?.faction && (
              <p className="text-gold/50 text-xs">{activeStory.memory.faction}</p>
            )}
          </div>

          {/* Inventory */}
          <div className="space-y-1 mb-4">
            <h4
              className="text-gold/60 text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Inventory
            </h4>
            {activeStory?.memory?.inventory && activeStory.memory.inventory.length > 0 ? (
              <ul className="space-y-1.5">
                {activeStory.memory.inventory.map((item) => (
                  <li key={item.name} className="text-sm">
                    <span className="text-gold/90">{item.name}</span>
                    {item.description && (
                      <p className="text-parchment/40 text-xs">{item.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-parchment/30 text-xs italic">Empty</p>
            )}
          </div>

          {/* Spells */}
          <div className="space-y-1 mb-4">
            <h4
              className="text-purple-400/60 text-xs tracking-widest uppercase"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Spells
            </h4>
            {activeStory?.memory?.spells && activeStory.memory.spells.length > 0 ? (
              <ul className="space-y-1.5">
                {activeStory.memory.spells.map((spell) => (
                  <li key={spell.name} className="text-sm">
                    <span className="text-purple-400/90">{spell.name}</span>
                    {spell.description && (
                      <p className="text-parchment/40 text-xs">{spell.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-parchment/30 text-xs italic">None learned</p>
            )}
          </div>

          {/* NPCs */}
          {activeStory?.memory?.npcsEncountered && activeStory.memory.npcsEncountered.length > 0 && (
            <div className="space-y-1 mb-4">
              <h4
                className="text-gold/60 text-xs tracking-widest uppercase"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                Known NPCs
              </h4>
              <ul className="space-y-1">
                {activeStory.memory.npcsEncountered.map((npc) => (
                  <li key={npc} className="text-parchment/60 text-xs">{npc}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Summary */}
          {activeStory?.memory?.summary && (
            <div className="space-y-1 border-t border-gold/10 pt-3">
              <h4
                className="text-gold/60 text-xs tracking-widest uppercase"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
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

      {/* Story display */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`animate-fade-in ${
              message.role === "player" ? "pl-8 border-l-2 border-gold/40" :
              message.role === "system" ? "text-center" : ""
            }`}
          >
            {message.role === "player" && (
              <>
                <p
                  className="text-gold/60 text-sm mb-1 tracking-wide"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
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
              <div className={`inline-flex items-center gap-1 text-sm italic ${
                message.content.startsWith("+") ? "text-gold" :
                message.content.startsWith("✦") ? "text-purple-400" :
                message.content.startsWith("-") || message.content.startsWith("✧") ? "text-parchment/40" :
                "text-parchment/50"
              }`}>
                {message.content}
              </div>
            )}
            {message.role !== "system" && (
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
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gold/20 p-4 bg-void/80 backdrop-blur-sm">
        {pendingRoll ? (
          /* AI-initiated roll UI */
          <div className="max-w-4xl mx-auto text-center space-y-3">
            <p className="text-parchment/60 text-sm italic">{pendingRoll}</p>
            <p
              className="text-gold text-sm tracking-widest uppercase"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              The fates demand a roll
            </p>
            {diceRoll && !isRolling ? (
              <div className="space-y-2">
                <p className={`text-3xl font-bold ${getRollTier(diceRoll).color}`}>
                  {diceRoll}
                </p>
                <p className={`text-sm ${getRollTier(diceRoll).color}`}>
                  {getRollTier(diceRoll).name}
                </p>
                <button
                  onClick={handlePendingRoll}
                  disabled={isLoading}
                  className="btn-primary"
                >
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
                {isRolling ? (
                  <span className="text-2xl font-bold">{diceRoll}</span>
                ) : (
                  <>Roll d20</>
                )}
              </button>
            )}
          </div>
        ) : pendingAction ? (
          /* Player-initiated roll after locking in action */
          <div className="max-w-4xl mx-auto text-center space-y-3">
            <p className="text-parchment/60 text-sm italic">
              &ldquo;{pendingAction}&rdquo;
            </p>
            <p
              className="text-gold text-sm tracking-widest uppercase"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Roll for fate
            </p>
            {diceRoll && !isRolling ? (
              <div className="space-y-2">
                <p className={`text-3xl font-bold ${getRollTier(diceRoll).color}`}>
                  {diceRoll}
                </p>
                <p className={`text-sm ${getRollTier(diceRoll).color}`}>
                  {getRollTier(diceRoll).name}
                </p>
                <button
                  onClick={() => executeAction(pendingAction, diceRoll)}
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
                  {isRolling ? (
                    <span className="text-2xl font-bold">{diceRoll}</span>
                  ) : (
                    <>Roll d20</>
                  )}
                </button>
                <button
                  onClick={() => { setPendingAction(null); setInput(pendingAction); }}
                  className="block mx-auto text-parchment/30 hover:text-parchment/60 text-xs"
                >
                  change action
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Normal input UI */
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
