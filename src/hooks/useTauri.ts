'use client';

import { useState, useEffect, useCallback } from 'react';

// Types for Ollama status from Rust backend
export interface OllamaStatus {
  installed: boolean;
  running: boolean;
  models: string[];
}

// Check if we're running inside Tauri
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  return '__TAURI__' in window || '__TAURI_INTERNALS__' in window;
}

// Lazy-load Tauri invoke to avoid SSR issues
async function getTauriInvoke() {
  if (!isTauri()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke;
  } catch {
    return null;
  }
}

export function useTauri() {
  const [isInTauri, setIsInTauri] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>({
    installed: false,
    running: false,
    models: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if running in Tauri on mount
  useEffect(() => {
    setIsInTauri(isTauri());
  }, []);

  // Check Ollama status
  const checkOllamaStatus = useCallback(async () => {
    const invoke = await getTauriInvoke();
    if (!invoke) {
      // Not in Tauri, use browser-based detection
      try {
        const response = await fetch('http://localhost:11434/api/tags', {
          signal: AbortSignal.timeout(2000),
        });
        if (response.ok) {
          const data = await response.json();
          const models = data.models?.map((m: { name: string }) => m.name) || [];
          setOllamaStatus({ installed: true, running: true, models });
        } else {
          setOllamaStatus({ installed: false, running: false, models: [] });
        }
      } catch {
        setOllamaStatus({ installed: false, running: false, models: [] });
      }
      setIsLoading(false);
      return;
    }

    // In Tauri, use Rust commands
    try {
      setIsLoading(true);
      const status = await invoke<OllamaStatus>('get_ollama_status');
      setOllamaStatus(status);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Start Ollama server
  const startOllama = useCallback(async (): Promise<boolean> => {
    const invoke = await getTauriInvoke();
    if (!invoke) {
      setError('Cannot start Ollama from browser - please start it manually');
      return false;
    }

    try {
      setIsLoading(true);
      await invoke('start_ollama');
      // Wait and recheck status
      await new Promise((r) => setTimeout(r, 2000));
      await checkOllamaStatus();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [checkOllamaStatus]);

  // Pull a model
  const pullModel = useCallback(async (model: string): Promise<boolean> => {
    const invoke = await getTauriInvoke();
    if (!invoke) {
      setError('Cannot pull models from browser - please use Ollama CLI');
      return false;
    }

    try {
      setIsLoading(true);
      await invoke('pull_model', { model });
      await checkOllamaStatus();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [checkOllamaStatus]);

  // Check if specific model exists
  const hasModel = useCallback(
    (model: string): boolean => {
      return ollamaStatus.models.some((m) => m.startsWith(model));
    },
    [ollamaStatus.models]
  );

  // Open Ollama download page
  const openOllamaDownload = useCallback(async () => {
    const invoke = await getTauriInvoke();
    if (invoke) {
      try {
        await invoke('open_ollama_download');
      } catch {
        window.open('https://ollama.ai/download', '_blank');
      }
    } else {
      window.open('https://ollama.ai/download', '_blank');
    }
  }, []);

  // Initial check on mount
  useEffect(() => {
    checkOllamaStatus();
  }, [checkOllamaStatus]);

  return {
    isInTauri,
    ollamaStatus,
    isLoading,
    error,
    checkOllamaStatus,
    startOllama,
    pullModel,
    hasModel,
    openOllamaDownload,
  };
}
