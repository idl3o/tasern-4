import { createOpenAI } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { LanguageModel } from "ai";

export interface LLMConfig {
  provider: "local" | "anthropic";
  model: string;
  baseURL?: string;
  available: boolean;
}

// Check if local LLM (Ollama) is available
async function checkLocalLLM(baseURL: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${baseURL}/api/tags`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

// Get the best available LLM
export async function getLLM(): Promise<{ model: LanguageModel; config: LLMConfig }> {
  const localBaseURL = process.env.LOCAL_LLM_URL || "http://localhost:11434";
  const localModel = process.env.LOCAL_LLM_MODEL || "llama3.2";
  const preferLocal = process.env.PREFER_LOCAL_LLM !== "false";

  // Try local first if preferred
  if (preferLocal) {
    const localAvailable = await checkLocalLLM(localBaseURL);

    if (localAvailable) {
      const ollama = createOpenAI({
        baseURL: `${localBaseURL}/v1`,
        apiKey: "ollama", // Ollama doesn't need a real key
      });

      return {
        model: ollama(localModel),
        config: {
          provider: "local",
          model: localModel,
          baseURL: localBaseURL,
          available: true,
        },
      };
    }
  }

  // Fallback to Anthropic
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("No LLM available: Local LLM offline and ANTHROPIC_API_KEY not set");
  }

  return {
    model: anthropic("claude-sonnet-4-20250514"),
    config: {
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      available: true,
    },
  };
}

// Get LLM status without making a request
export async function getLLMStatus(): Promise<{
  local: { available: boolean; url: string; model: string };
  anthropic: { available: boolean };
  active: "local" | "anthropic" | "none";
}> {
  const localBaseURL = process.env.LOCAL_LLM_URL || "http://localhost:11434";
  const localModel = process.env.LOCAL_LLM_MODEL || "llama3.2";
  const localAvailable = await checkLocalLLM(localBaseURL);
  const anthropicAvailable = !!process.env.ANTHROPIC_API_KEY;
  const preferLocal = process.env.PREFER_LOCAL_LLM !== "false";

  let active: "local" | "anthropic" | "none" = "none";
  if (preferLocal && localAvailable) {
    active = "local";
  } else if (anthropicAvailable) {
    active = "anthropic";
  }

  return {
    local: {
      available: localAvailable,
      url: localBaseURL,
      model: localModel,
    },
    anthropic: {
      available: anthropicAvailable,
    },
    active,
  };
}
