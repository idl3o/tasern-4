'use client';

import { useState, useEffect, useCallback } from 'react';
import { recheckOllama } from '@/hooks/useLocalOllama';
import { isTauri } from '@/lib/platform';

// Lazy-load Tauri invoke to avoid SSR issues
async function getTauriInvoke() {
  if (!isTauri()) return null;
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke;
}

/**
 * Desktop-only actions on the Ollama install: whether it is installed, starting it,
 * and opening the download page. Whether it is running, and which models it has,
 * come from useLocalOllama, the single source of truth for both builds.
 */
export function useTauri() {
  const [isInTauri, setIsInTauri] = useState(false);
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsInTauri(isTauri());
  }, []);

  const checkInstalled = useCallback(async () => {
    const invoke = await getTauriInvoke();
    if (!invoke) return;
    try {
      setInstalled(await invoke<boolean>('check_ollama_installed'));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  // Start the server, then re-read Ollama's state through the shared monitor.
  const startOllama = useCallback(async () => {
    const invoke = await getTauriInvoke();
    if (!invoke) return;
    setIsStarting(true);
    try {
      await invoke('start_ollama');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      await recheckOllama();
      setIsStarting(false);
    }
  }, []);

  const openOllamaDownload = useCallback(async () => {
    const invoke = await getTauriInvoke();
    if (!invoke) {
      window.open('https://ollama.ai/download', '_blank');
      return;
    }
    try {
      await invoke('open_ollama_download');
    } catch (err) {
      console.warn('[Tauri] open_ollama_download failed, using window.open:', err);
      window.open('https://ollama.ai/download', '_blank');
    }
  }, []);

  useEffect(() => {
    void checkInstalled();
  }, [checkInstalled]);

  return { isInTauri, installed, isStarting, error, checkInstalled, startOllama, openOllamaDownload };
}
