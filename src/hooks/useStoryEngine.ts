"use client";

import { useCallback, useRef, useState } from "react";
import {
  useStoryStore,
  type StoryMessage,
  type StoryMemory,
  type SavedStory,
  type InventoryItem,
} from "@/state/storyStore";
import { useWebLLM } from "./useWebLLM";
import { useLocalOllama } from "./useLocalOllama";
import { useWalletContext } from "./useWalletContext";
import {
  composeSystemPrompt,
  buildDicePrompt,
  MEMORY_EXTRACTION_PROMPT,
  MEMORY_EXTRACTION_SYSTEM,
  type CharacterContext,
} from "@/lib/prompt";
import type { CharacterChoices } from "@/components/CharacterCreation";
import { safeUUID } from "@/lib/id";

const MEMORY_EXTRACTION_THRESHOLD = 10;

export function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

export interface RollTier {
  name: string;
  description: string;
  color: string;
}

export function getRollTier(roll: number): RollTier {
  if (roll === 1) return { name: "Critical Failure", description: "Everything goes spectacularly wrong", color: "text-red-400" };
  if (roll <= 7) return { name: "Failure", description: "The attempt fails, with consequences", color: "text-red-400/70" };
  if (roll <= 14) return { name: "Partial Success", description: "Mixed results, complications arise", color: "text-gold" };
  if (roll <= 19) return { name: "Success", description: "The action succeeds as intended", color: "text-green-400" };
  return { name: "Critical Success", description: "Beyond expectations, extraordinary outcome", color: "text-green-300" };
}

function parseRollRequired(content: string): { cleanContent: string; reason: string | null } {
  const match = content.match(/\[ROLL_REQUIRED:\s*(.+?)\]/);
  if (match) {
    const cleanContent = content.replace(/\[ROLL_REQUIRED:\s*.+?\]/g, "").trimEnd();
    return { cleanContent, reason: match[1].trim() };
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

  cleaned = cleaned.replace(/\[ITEM_GAINED:\s*([^\]]+?)\s+-\s+(.+?)\]\s*/g, (_, name, desc) => {
    itemsGained.push({ name: name.trim(), description: desc.trim() });
    return "";
  });
  cleaned = cleaned.replace(/\[ITEM_GAINED:\s*(.+?)\]\s*/g, (_, name) => {
    itemsGained.push({ name: name.trim(), description: "" });
    return "";
  });
  cleaned = cleaned.replace(/\[ITEM_LOST:\s*(.+?)\]\s*/g, (_, name) => {
    itemsLost.push(name.trim());
    return "";
  });
  cleaned = cleaned.replace(/\[SPELL_LEARNED:\s*([^\]]+?)\s+-\s+(.+?)\]\s*/g, (_, name, desc) => {
    spellsLearned.push({ name: name.trim(), description: desc.trim() });
    return "";
  });
  cleaned = cleaned.replace(/\[SPELL_LEARNED:\s*(.+?)\]\s*/g, (_, name) => {
    spellsLearned.push({ name: name.trim(), description: "" });
    return "";
  });
  cleaned = cleaned.replace(/\[SPELL_LOST:\s*(.+?)\]\s*/g, (_, name) => {
    spellsLost.push(name.trim());
    return "";
  });

  return { cleanContent: cleaned.trimEnd(), itemsGained, itemsLost, spellsLearned, spellsLost };
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

export function useStoryEngine() {
  const [messages, setMessages] = useState<StoryMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingRoll, setPendingRoll] = useState<string | null>(null);
  const [llmSource, setLlmSource] = useState<"local-ollama" | "webllm" | null>(null);
  const characterRef = useRef<CharacterContext | null>(null);
  const extractingRef = useRef(false);
  const isGeneratingRef = useRef(false);

  const {
    getActiveStory,
    createStory,
    loadStory,
    setActiveMessages,
    updateMemory,
    reinforceBeliefs,
    updateTitle,
    setMessageCountAtLastExtraction,
    addItem,
    removeItem,
    addSpell,
    removeSpell,
  } = useStoryStore();

  const {
    isReady: webLLMReady,
    generate: webLLMGenerate,
    generateComplete: webLLMGenerateComplete,
  } = useWebLLM();

  const {
    available: localOllamaAvailable,
    generate: localOllamaGenerate,
  } = useLocalOllama();

  const { promptContext: walletPromptContext } = useWalletContext();

  // Build the system prompt fresh on every generate using latest store state
  const buildSystemPrompt = useCallback(() => {
    const story = getActiveStory();
    return composeSystemPrompt({
      character: characterRef.current,
      memory: story?.memory ?? null,
      wallet: walletPromptContext,
    });
  }, [getActiveStory, walletPromptContext]);

  const generateWithLocalOllama = useCallback(
    async (
      prompt: string,
      systemPrompt: string,
      history: StoryMessage[],
      messageId: string
    ): Promise<string | null> => {
      try {
        const historyForLLM = history.map((m) => ({ role: m.role, content: m.content }));
        let fullContent = "";
        for await (const chunk of localOllamaGenerate(prompt, systemPrompt, historyForLLM)) {
          fullContent += chunk;
          setMessages((prev) =>
            prev.map((msg) => (msg.id === messageId ? { ...msg, content: fullContent } : msg))
          );
        }
        setLlmSource("local-ollama");
        return fullContent;
      } catch (e) {
        console.error("[Local Ollama] Generation failed:", e);
        return null;
      }
    },
    [localOllamaGenerate]
  );

  const generateWithWebLLM = useCallback(
    async (
      prompt: string,
      systemPrompt: string,
      history: StoryMessage[],
      messageId: string
    ): Promise<string | null> => {
      try {
        // Trim history when memory exists
        const story = getActiveStory();
        const hasMemory = !!story?.memory?.summary;
        const trimmed = hasMemory && history.length > 20 ? history.slice(-20) : history;
        const historyForLLM = trimmed.map((m) => ({ role: m.role, content: m.content }));

        let fullContent = "";
        for await (const chunk of webLLMGenerate(prompt, systemPrompt, historyForLLM)) {
          fullContent += chunk;
          setMessages((prev) =>
            prev.map((msg) => (msg.id === messageId ? { ...msg, content: fullContent } : msg))
          );
        }
        setLlmSource("webllm");
        return fullContent;
      } catch (e) {
        console.error("[WebLLM] Generation failed:", e);
        return null;
      }
    },
    [webLLMGenerate, getActiveStory]
  );

  // Returns the final narrator content (or a fallback message when no AI is available).
  const smartGenerate = useCallback(
    async (prompt: string, history: StoryMessage[], messageId: string): Promise<string> => {
      const systemPrompt = buildSystemPrompt();
      if (process.env.NODE_ENV !== "production") {
        console.log("[StoryEngine] system prompt length:", systemPrompt.length);
      }

      if (localOllamaAvailable) {
        const content = await generateWithLocalOllama(prompt, systemPrompt, history, messageId);
        if (content !== null) return content;
      }

      if (webLLMReady) {
        const content = await generateWithWebLLM(prompt, systemPrompt, history, messageId);
        if (content !== null) return content;
      }

      const fallback =
        "The threads of fate tangle... something interferes with your arrival. (No AI available - please ensure Ollama is running)";
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, content: fallback } : msg))
      );
      return fallback;
    },
    [buildSystemPrompt, localOllamaAvailable, generateWithLocalOllama, webLLMReady, generateWithWebLLM]
  );

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

        if (webLLMReady) {
          response = await webLLMGenerateComplete(prompt, MEMORY_EXTRACTION_SYSTEM);
        } else if (localOllamaAvailable) {
          for await (const chunk of localOllamaGenerate(prompt, MEMORY_EXTRACTION_SYSTEM)) {
            response += chunk;
          }
        }

        if (!response) {
          console.log("[Memory] No AI available for extraction");
          return;
        }

        let memory: StoryMemory;
        try {
          // Tolerate models that wrap JSON in prose/fences: take first { … last }.
          const cleaned = response.replace(/```json?\s*/gi, "").replace(/```\s*/g, "");
          const first = cleaned.indexOf("{");
          const last = cleaned.lastIndexOf("}");
          const jsonStr = first !== -1 && last !== -1 ? cleaned.slice(first, last + 1) : cleaned.trim();
          const parsed = JSON.parse(jsonStr);
          memory = {
            characterName: parsed.characterName || null,
            currentLocation: parsed.currentLocation || null,
            keyEvents: Array.isArray(parsed.keyEvents) ? parsed.keyEvents.slice(0, 15) : [],
            npcsEncountered: Array.isArray(parsed.npcsEncountered) ? parsed.npcsEncountered.slice(0, 20) : [],
            beliefs: Array.isArray(parsed.beliefs) ? parsed.beliefs.slice(0, 20) : [],
            beliefStrengths: story.memory?.beliefStrengths || {},
            faction: parsed.faction || null,
            summary: parsed.summary || "",
            // Inventory & spells are authoritatively tracked via [ITEM_GAINED]/[SPELL_LEARNED]
            // tags in the store — never let the extraction LLM overwrite them.
            inventory: story.memory?.inventory || [],
            spells: story.memory?.spells || [],
          };
        } catch {
          console.log("[Memory] JSON parse failed, storing raw summary");
          memory = {
            ...(story.memory || {
              characterName: null,
              currentLocation: null,
              keyEvents: [],
              npcsEncountered: [],
              beliefs: [],
              beliefStrengths: {},
              faction: null,
              inventory: [],
              spells: [],
              summary: "",
            }),
            summary: response.slice(0, 2000),
          };
        }

        updateMemory(memory);
        if (memory.beliefs.length > 0) {
          reinforceBeliefs(memory.beliefs);
        }
        setMessageCountAtLastExtraction(msgs.length);

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
      reinforceBeliefs,
      updateTitle,
      setMessageCountAtLastExtraction,
    ]
  );

  const checkForItemSpellTags = useCallback(
    (msgs: StoryMessage[]): StoryMessage[] => {
      const lastNarrator = [...msgs].reverse().find((m) => m.role === "narrator");
      if (!lastNarrator || !lastNarrator.content) return msgs;

      const { cleanContent, itemsGained, itemsLost, spellsLearned, spellsLost } =
        parseItemSpellTags(lastNarrator.content);

      const hasChanges =
        itemsGained.length > 0 ||
        itemsLost.length > 0 ||
        spellsLearned.length > 0 ||
        spellsLost.length > 0;

      if (!hasChanges) return msgs;

      for (const item of itemsGained) addItem(item.name, item.description);
      for (const name of itemsLost) removeItem(name);
      for (const spell of spellsLearned) addSpell(spell.name, spell.description);
      for (const name of spellsLost) removeSpell(name);

      const notifications: StoryMessage[] = [];
      for (const item of itemsGained) {
        notifications.push({
          id: safeUUID(),
          role: "system",
          content: `+ ${item.name}${item.description ? ` — ${item.description}` : ""}`,
          timestamp: Date.now(),
        });
      }
      for (const name of itemsLost) {
        notifications.push({ id: safeUUID(), role: "system", content: `- ${name}`, timestamp: Date.now() });
      }
      for (const spell of spellsLearned) {
        notifications.push({
          id: safeUUID(),
          role: "system",
          content: `✦ ${spell.name}${spell.description ? ` — ${spell.description}` : ""}`,
          timestamp: Date.now(),
        });
      }
      for (const name of spellsLost) {
        notifications.push({
          id: safeUUID(),
          role: "system",
          content: `✧ Lost: ${name}`,
          timestamp: Date.now(),
        });
      }

      return msgs
        .map((msg) => (msg.id === lastNarrator.id ? { ...msg, content: cleanContent } : msg))
        .concat(notifications);
    },
    [addItem, removeItem, addSpell, removeSpell]
  );

  // Pure: strips a [ROLL_REQUIRED] tag from the last narrator message and reports the reason.
  const checkForRollRequest = useCallback(
    (msgs: StoryMessage[]): { messages: StoryMessage[]; reason: string | null } => {
      const lastNarrator = [...msgs].reverse().find((m) => m.role === "narrator");
      if (!lastNarrator || !lastNarrator.content) return { messages: msgs, reason: null };

      const { cleanContent, reason } = parseRollRequired(lastNarrator.content);
      if (!reason) return { messages: msgs, reason: null };

      const updated = msgs.map((msg) =>
        msg.id === lastNarrator.id ? { ...msg, content: cleanContent } : msg
      );
      return { messages: updated, reason };
    },
    []
  );

  const saveMessages = useCallback(
    (msgs: StoryMessage[]) => {
      const story = getActiveStory();
      if (story) setActiveMessages(msgs);
    },
    [getActiveStory, setActiveMessages]
  );

  // Runs after a generation completes. Side effects (store mutations, extraction)
  // execute exactly once here — never inside a setState updater — so React StrictMode's
  // double-invocation of updaters can't double-grant items or double-fire extraction.
  const finalizeAfterGeneration = useCallback(
    (finalMessages: StoryMessage[]) => {
      const withItems = checkForItemSpellTags(finalMessages);
      const { messages: cleaned, reason } = checkForRollRequest(withItems);
      setMessages(cleaned);
      saveMessages(cleaned);
      if (reason) setPendingRoll(reason);
      extractMemory(cleaned);
    },
    [checkForItemSpellTags, checkForRollRequest, saveMessages, extractMemory]
  );

  const startStory = useCallback(
    async (choices: CharacterChoices) => {
      if (isGeneratingRef.current) return;
      isGeneratingRef.current = true;
      createStory();

      // Persist character context for the prompt
      characterRef.current = {
        name: choices.name || null,
        faction: choices.faction,
        belief: choices.belief,
      };

      // Seed initial memory + record stated belief
      updateMemory({
        characterName: choices.name || null,
        currentLocation: null,
        keyEvents: [],
        npcsEncountered: [],
        beliefs: [choices.belief],
        beliefStrengths: {},
        faction: choices.faction,
        summary: "",
        inventory: [],
        spells: [],
      });
      reinforceBeliefs([choices.belief]);

      if (choices.startingGift.type === "spell") {
        addSpell(choices.startingGift.name, choices.startingGift.description);
      } else {
        addItem(choices.startingGift.name, choices.startingGift.description);
      }

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

      if (choices.name) {
        updateTitle(`${choices.name}'s Tale`);
      }

      const openingId = safeUUID();
      const initial: StoryMessage[] = [
        { id: openingId, role: "narrator", content: "", timestamp: Date.now() },
      ];
      setMessages(initial);

      try {
        const content = await smartGenerate(customPrompt, [], openingId);
        const finalMessages = initial.map((m) => (m.id === openingId ? { ...m, content } : m));
        finalizeAfterGeneration(finalMessages);
      } finally {
        setIsLoading(false);
        isGeneratingRef.current = false;
      }
    },
    [createStory, updateMemory, reinforceBeliefs, addSpell, addItem, updateTitle, smartGenerate, finalizeAfterGeneration]
  );

  const continueStory = useCallback(
    (story: SavedStory) => {
      loadStory(story.id);
      setMessages(story.messages);
      // Restore character context from memory if possible
      if (story.memory) {
        characterRef.current = {
          name: story.memory.characterName,
          faction: story.memory.faction,
          belief: story.memory.beliefs[0] || null,
        };
      }
    },
    [loadStory]
  );

  const sendAction = useCallback(
    async (action: string, roll: number) => {
      if (isGeneratingRef.current) return;
      isGeneratingRef.current = true;

      const playerId = safeUUID();
      const narratorId = safeUUID();

      // History for the LLM = the story so far, before this turn's action. The action
      // is restated in the prompt, so including it here too would duplicate it.
      const priorHistory = messages;

      const newMessages: StoryMessage[] = [
        ...messages,
        { id: playerId, role: "player", content: action, timestamp: Date.now(), diceRoll: roll },
        {
          id: safeUUID(),
          role: "system",
          content: `Rolled d20: ${roll} — ${getRollTier(roll).name}`,
          timestamp: Date.now(),
          diceRoll: roll,
        },
        { id: narratorId, role: "narrator", content: "", timestamp: Date.now() },
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

      try {
        const content = await smartGenerate(prompt, priorHistory, narratorId);
        const finalMessages = newMessages.map((m) => (m.id === narratorId ? { ...m, content } : m));
        finalizeAfterGeneration(finalMessages);
      } finally {
        setIsLoading(false);
        isGeneratingRef.current = false;
      }
    },
    [messages, smartGenerate, finalizeAfterGeneration]
  );

  const resolveAIRoll = useCallback(
    async (roll: number) => {
      if (isGeneratingRef.current) return;
      isGeneratingRef.current = true;
      setPendingRoll(null);

      const narratorId = safeUUID();
      const tier = getRollTier(roll);
      const rollMsg: StoryMessage = {
        id: safeUUID(),
        role: "system",
        content: `Rolled d20: ${roll} — ${tier.name}`,
        timestamp: Date.now(),
        diceRoll: roll,
      };

      const priorHistory = messages;
      const newMessages: StoryMessage[] = [
        ...messages,
        rollMsg,
        { id: narratorId, role: "narrator", content: "", timestamp: Date.now() },
      ];
      setMessages(newMessages);
      setIsLoading(true);

      const prompt = `[DICE ROLL: ${roll}/20 — ${tier.name}]
The fate roll has been cast. The result is ${roll} — ${tier.description}.
Continue the story based on this roll result. Do not mention dice or game mechanics — weave the outcome naturally into the narrative.
Write 2-4 paragraphs. End in a way that invites further action.`;

      try {
        const content = await smartGenerate(prompt, priorHistory, narratorId);
        const finalMessages = newMessages.map((m) => (m.id === narratorId ? { ...m, content } : m));
        finalizeAfterGeneration(finalMessages);
      } finally {
        setIsLoading(false);
        isGeneratingRef.current = false;
      }
    },
    [messages, smartGenerate, finalizeAfterGeneration]
  );

  const resetSession = useCallback(() => {
    setMessages([]);
    setIsLoading(false);
    setPendingRoll(null);
    setLlmSource(null);
    characterRef.current = null;
  }, []);

  return {
    messages,
    isLoading,
    pendingRoll,
    llmSource,
    startStory,
    continueStory,
    sendAction,
    resolveAIRoll,
    resetSession,
    rollD20,
  };
}
