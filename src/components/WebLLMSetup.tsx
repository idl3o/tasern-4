"use client";

import { useEffect } from "react";
import { useWebLLM } from "@/hooks/useWebLLM";
import { AVAILABLE_MODELS } from "@/state/webllmStore";

interface WebLLMSetupProps {
  onReady?: () => void;
  onSkip?: () => void;
}

export function WebLLMSetup({ onReady, onSkip }: WebLLMSetupProps) {
  const {
    status,
    progress,
    progressText,
    error,
    isReady,
    isSupported,
    initialize,
    declineWebLLM,
    checkSupport,
  } = useWebLLM();

  // Check support on mount
  useEffect(() => {
    checkSupport();
  }, [checkSupport]);

  // Notify when ready
  useEffect(() => {
    if (isReady && onReady) {
      onReady();
    }
  }, [isReady, onReady]);

  const handleSkip = () => {
    declineWebLLM();
    onSkip?.();
  };

  const handleInitialize = () => {
    initialize();
  };

  // Not supported
  if (status === "unsupported") {
    return (
      <div className="panel p-6 max-w-md mx-auto text-center space-y-4">
        <h3 className="text-gold">Browser AI Unavailable</h3>
        <p className="text-parchment/70 text-sm">
          Your browser doesn't support WebGPU, which is needed for local AI.
          We'll use server-based AI instead.
        </p>
        <button onClick={handleSkip} className="btn-primary">
          Continue with Server AI
        </button>
      </div>
    );
  }

  // Error state
  if (status === "error") {
    return (
      <div className="panel p-6 max-w-md mx-auto text-center space-y-4">
        <h3 className="text-red-400">Setup Failed</h3>
        <p className="text-parchment/70 text-sm">{error}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={handleInitialize} className="btn-secondary">
            Retry
          </button>
          <button onClick={handleSkip} className="btn-primary">
            Use Server AI
          </button>
        </div>
      </div>
    );
  }

  // Downloading/Loading
  if (status === "downloading" || status === "loading") {
    return (
      <div className="panel p-6 max-w-md mx-auto space-y-4">
        <div className="text-center">
          <h3 className="text-gold mb-2">
            {status === "downloading" ? "Downloading AI Model" : "Initializing..."}
          </h3>
          <p className="text-parchment/60 text-sm">
            {progressText || "Please wait..."}
          </p>
        </div>

        {/* Progress bar */}
        <div className="relative h-3 bg-void border border-gold/30 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-bronze to-gold transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="text-center text-gold text-lg">{progress}%</p>

        <p className="text-parchment/40 text-xs text-center">
          This only happens once. The model will be cached for future visits.
        </p>

        <button
          onClick={handleSkip}
          className="w-full text-parchment/50 hover:text-parchment/70 text-sm"
        >
          Skip and use server AI instead
        </button>
      </div>
    );
  }

  // Ready state
  if (status === "ready") {
    return (
      <div className="panel p-6 max-w-md mx-auto text-center space-y-4">
        <div className="text-4xl">✓</div>
        <h3 className="text-gold">AI Ready</h3>
        <p className="text-parchment/70 text-sm">
          Running locally in your browser. No data sent to servers.
        </p>
        <button onClick={onReady} className="btn-primary">
          Begin Your Story
        </button>
      </div>
    );
  }

  // Idle - offer to download
  return (
    <div className="panel p-6 max-w-lg mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-gold text-xl">Enable Local AI?</h3>
        <p className="text-parchment/70">
          Run the AI directly in your browser for faster, private storytelling.
        </p>
      </div>

      {/* Model info */}
      <div className="bg-void/50 border border-gold/20 rounded-lg p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-parchment/60">Model</span>
          <span className="text-parchment">Llama 3.2 3B</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-parchment/60">Download Size</span>
          <span className="text-parchment">~2 GB (one-time)</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-parchment/60">Requires</span>
          <span className="text-parchment">WebGPU (modern browser)</span>
        </div>
      </div>

      {/* Benefits */}
      <ul className="text-sm text-parchment/70 space-y-1">
        <li>✓ Runs completely offline after download</li>
        <li>✓ No API keys needed</li>
        <li>✓ Your story stays private</li>
        <li>✓ Falls back to server if needed</li>
      </ul>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={handleSkip} className="btn-secondary flex-1">
          Skip
        </button>
        <button onClick={handleInitialize} className="btn-primary flex-1">
          Download AI
        </button>
      </div>

      <p className="text-parchment/40 text-xs text-center">
        You can change this later in settings
      </p>
    </div>
  );
}
