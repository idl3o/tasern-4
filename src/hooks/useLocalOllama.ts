"use client";

import { useState, useEffect, useCallback } from "react";
import { CONTEXT_TOKENS } from "@/lib/chapters";

const OLLAMA_URL = "http://localhost:11434";
const DEFAULT_MODEL = "llama3.2";

export interface GenStats {
  promptTokens: number;
  evalTokens: number;
}

interface OllamaStatus {
  available: boolean;
  models: string[];
  selectedModel: string;
}

export function useLocalOllama() {
  const [status, setStatus] = useState<OllamaStatus>({
    available: false,
    models: [],
    selectedModel: DEFAULT_MODEL,
  });
  const [isChecking, setIsChecking] = useState(true);

  // Check if local Ollama is running, then keep polling while it isn't so a
  // server started after page load is picked up without a manual refresh.
  useEffect(() => {
    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | undefined;

    async function checkOllama() {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(`${OLLAMA_URL}/api/tags`, {
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.ok) {
          const data = await response.json();
          const models = data.models?.map((m: { name: string }) => m.name) || [];
          if (cancelled) return;
          setStatus({
            available: true,
            models,
            selectedModel: models.includes(DEFAULT_MODEL) ? DEFAULT_MODEL : models[0] || DEFAULT_MODEL,
          });
          if (poll) clearInterval(poll); // found it — stop polling
        }
      } catch {
        // Ollama not available - this is fine, keep polling
        if (!cancelled) setStatus((prev) => ({ ...prev, available: false }));
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    }

    checkOllama();
    poll = setInterval(() => {
      // Only keep probing while unavailable
      if (!cancelled) checkOllama();
    }, 15000);

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
    };
  }, []);

  // Generate text using local Ollama's chat endpoint (carries conversation history)
  const generate = useCallback(
    async function* (
      prompt: string,
      systemPrompt: string,
      history?: Array<{ role: string; content: string }>,
      onStats?: (stats: GenStats) => void
    ): AsyncGenerator<string, void, unknown> {
      if (!status.available) {
        throw new Error("Local Ollama not available");
      }

      // Map our roles to the chat API's user/assistant; drop system-role notes.
      const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system", content: systemPrompt },
      ];
      if (history) {
        for (const msg of history) {
          if (msg.role === "narrator") chatMessages.push({ role: "assistant", content: msg.content });
          else if (msg.role === "player") chatMessages.push({ role: "user", content: msg.content });
        }
      }
      chatMessages.push({ role: "user", content: prompt });

      // Abort if the server stalls without producing any output.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);

      let response: Response;
      try {
        response = await fetch(`${OLLAMA_URL}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: status.selectedModel,
            messages: chatMessages,
            stream: true,
            options: { num_ctx: CONTEXT_TOKENS },
          }),
          signal: controller.signal,
        });
      } catch (e) {
        clearTimeout(timeout);
        throw e;
      }

      if (!response.ok) {
        clearTimeout(timeout);
        throw new Error(`Ollama error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        clearTimeout(timeout);
        throw new Error("No response body");
      }

      // NDJSON can split across reads; buffer partial lines and decode as a stream
      // so multi-byte UTF-8 characters straddling a chunk boundary aren't mangled.
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          clearTimeout(timeout); // first bytes arrived; drop the stall guard

          buffer += decoder.decode(value, { stream: true });
          let newlineIndex: number;
          while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);
            if (!line) continue;
            try {
              const json = JSON.parse(line);
              const delta = json.message?.content;
              if (delta) yield delta;
              if (json.done && onStats) {
                onStats({ promptTokens: json.prompt_eval_count ?? 0, evalTokens: json.eval_count ?? 0 });
              }
            } catch {
              // Skip invalid JSON lines
            }
          }
        }

        // Flush any trailing complete object left in the buffer
        const tail = buffer.trim();
        if (tail) {
          try {
            const json = JSON.parse(tail);
            const delta = json.message?.content;
            if (delta) yield delta;
            if (json.done && onStats) {
              onStats({ promptTokens: json.prompt_eval_count ?? 0, evalTokens: json.eval_count ?? 0 });
            }
          } catch {
            // ignore incomplete trailing data
          }
        }
      } finally {
        clearTimeout(timeout);
      }
    },
    [status.available, status.selectedModel]
  );

  return {
    available: status.available,
    isChecking,
    models: status.models,
    selectedModel: status.selectedModel,
    generate,
  };
}
