"use client";

import { useState, useEffect, useCallback } from "react";

const OLLAMA_URL = "http://localhost:11434";
const DEFAULT_MODEL = "llama3.2";

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

  // Check if local Ollama is running
  useEffect(() => {
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
          setStatus({
            available: true,
            models,
            selectedModel: models.includes(DEFAULT_MODEL) ? DEFAULT_MODEL : models[0] || DEFAULT_MODEL,
          });
        }
      } catch {
        // Ollama not available - this is fine
        setStatus((prev) => ({ ...prev, available: false }));
      } finally {
        setIsChecking(false);
      }
    }

    checkOllama();
  }, []);

  // Generate text using local Ollama
  const generate = useCallback(
    async function* (
      prompt: string,
      systemPrompt: string
    ): AsyncGenerator<string, void, unknown> {
      if (!status.available) {
        throw new Error("Local Ollama not available");
      }

      const response = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: status.selectedModel,
          prompt,
          system: systemPrompt,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter(Boolean);

        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            if (json.response) {
              yield json.response;
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
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
