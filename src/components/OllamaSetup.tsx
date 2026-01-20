'use client';

import { useTauri } from '@/hooks/useTauri';
import { useState } from 'react';

const REQUIRED_MODEL = 'llama3.2';

interface OllamaSetupProps {
  onReady: () => void;
}

export default function OllamaSetup({ onReady }: OllamaSetupProps) {
  const {
    isInTauri,
    ollamaStatus,
    isLoading,
    error,
    checkOllamaStatus,
    startOllama,
    pullModel,
    hasModel,
    openOllamaDownload,
  } = useTauri();

  const [isPulling, setIsPulling] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // Determine current setup step
  const getSetupStep = () => {
    if (!ollamaStatus.installed) return 'install';
    if (!ollamaStatus.running) return 'start';
    if (!hasModel(REQUIRED_MODEL)) return 'pull';
    return 'ready';
  };

  const step = getSetupStep();

  // If ready, notify parent
  if (step === 'ready' && !isLoading) {
    // Use setTimeout to avoid state update during render
    setTimeout(() => onReady(), 0);
  }

  const handleStartOllama = async () => {
    setIsStarting(true);
    await startOllama();
    setIsStarting(false);
  };

  const handlePullModel = async () => {
    setIsPulling(true);
    await pullModel(REQUIRED_MODEL);
    setIsPulling(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-800/50 backdrop-blur-sm rounded-lg border border-purple-500/30 p-8">
        <h1 className="text-2xl font-bold text-purple-200 mb-2 text-center">
          Tasern Setup
        </h1>
        <p className="text-gray-400 text-center mb-8">
          Preparing the storytelling engine...
        </p>

        {/* Progress indicator */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-2">
            <StepIndicator
              step={1}
              label="Install"
              active={step === 'install'}
              complete={ollamaStatus.installed}
            />
            <div className="w-8 h-0.5 bg-gray-600" />
            <StepIndicator
              step={2}
              label="Start"
              active={step === 'start'}
              complete={ollamaStatus.running}
            />
            <div className="w-8 h-0.5 bg-gray-600" />
            <StepIndicator
              step={3}
              label="Model"
              active={step === 'pull'}
              complete={hasModel(REQUIRED_MODEL)}
            />
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-6 p-3 bg-red-900/30 border border-red-500/50 rounded text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Step content */}
        {step === 'install' && (
          <div className="text-center">
            <div className="text-6xl mb-4">🦙</div>
            <h2 className="text-xl text-purple-200 mb-4">Install Ollama</h2>
            <p className="text-gray-400 mb-6">
              Tasern uses Ollama to run AI locally on your computer. It&apos;s free
              and keeps your stories private.
            </p>
            <button
              onClick={openOllamaDownload}
              className="w-full py-3 px-6 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors mb-4"
            >
              Download Ollama
            </button>
            <button
              onClick={checkOllamaStatus}
              disabled={isLoading}
              className="w-full py-2 px-6 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
            >
              {isLoading ? 'Checking...' : 'I\'ve installed it - Check again'}
            </button>
          </div>
        )}

        {step === 'start' && (
          <div className="text-center">
            <div className="text-6xl mb-4">⚡</div>
            <h2 className="text-xl text-purple-200 mb-4">Start Ollama</h2>
            <p className="text-gray-400 mb-6">
              Ollama is installed but not running.
              {isInTauri
                ? ' Click below to start it.'
                : ' Please start it from your system tray or terminal.'}
            </p>
            {isInTauri ? (
              <button
                onClick={handleStartOllama}
                disabled={isStarting}
                className="w-full py-3 px-6 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors mb-4"
              >
                {isStarting ? 'Starting...' : 'Start Ollama'}
              </button>
            ) : (
              <div className="p-4 bg-gray-700/50 rounded-lg mb-4">
                <code className="text-green-400">ollama serve</code>
              </div>
            )}
            <button
              onClick={checkOllamaStatus}
              disabled={isLoading}
              className="w-full py-2 px-6 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
            >
              {isLoading ? 'Checking...' : 'Check again'}
            </button>
          </div>
        )}

        {step === 'pull' && (
          <div className="text-center">
            <div className="text-6xl mb-4">📥</div>
            <h2 className="text-xl text-purple-200 mb-4">Download AI Model</h2>
            <p className="text-gray-400 mb-6">
              Ollama is ready! Now we need to download the storytelling model
              ({REQUIRED_MODEL}). This is a one-time ~2GB download.
            </p>
            {isInTauri ? (
              <button
                onClick={handlePullModel}
                disabled={isPulling}
                className="w-full py-3 px-6 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors mb-4"
              >
                {isPulling ? 'Downloading... (this may take a while)' : 'Download Model'}
              </button>
            ) : (
              <>
                <div className="p-4 bg-gray-700/50 rounded-lg mb-4">
                  <code className="text-green-400">ollama pull {REQUIRED_MODEL}</code>
                </div>
                <button
                  onClick={checkOllamaStatus}
                  disabled={isLoading}
                  className="w-full py-2 px-6 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
                >
                  {isLoading ? 'Checking...' : 'I\'ve downloaded it - Check again'}
                </button>
              </>
            )}
          </div>
        )}

        {step === 'ready' && (
          <div className="text-center">
            <div className="text-6xl mb-4">✨</div>
            <h2 className="text-xl text-purple-200 mb-4">Ready!</h2>
            <p className="text-gray-400">
              Everything is set up. Entering Tasern...
            </p>
          </div>
        )}

        {/* Available models */}
        {ollamaStatus.models.length > 0 && (
          <div className="mt-8 pt-4 border-t border-gray-700">
            <p className="text-xs text-gray-500 mb-2">Available models:</p>
            <div className="flex flex-wrap gap-2">
              {ollamaStatus.models.map((model) => (
                <span
                  key={model}
                  className="px-2 py-1 bg-gray-700/50 rounded text-xs text-gray-400"
                >
                  {model}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StepIndicator({
  step,
  label,
  active,
  complete,
}: {
  step: number;
  label: string;
  active: boolean;
  complete: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
          complete
            ? 'bg-green-600 text-white'
            : active
            ? 'bg-purple-600 text-white'
            : 'bg-gray-700 text-gray-400'
        }`}
      >
        {complete ? '✓' : step}
      </div>
      <span
        className={`text-xs mt-1 ${
          active ? 'text-purple-300' : 'text-gray-500'
        }`}
      >
        {label}
      </span>
    </div>
  );
}
