'use client';

import { useEffect } from 'react';
import { useLocalOllama } from '@/hooks/useLocalOllama';
import { useTauri } from '@/hooks/useTauri';
import { describeOllamaError } from '@/lib/ollama/errors';

// Offered only when no chat model is installed. gemma4 is the model the narrator's tag
// protocol was tuned against (llama3.2 scored 1/6 in the 2026-11-02 playtest); ~7 GB.
const STARTER_MODEL = 'gemma4';

type Step = 'checking' | 'install' | 'start' | 'pull' | 'ready';

interface OllamaSetupProps {
  onReady: () => void;
}

/** Desktop first-run setup: install Ollama, start it, and pull a model only if none can chat. */
export default function OllamaSetup({ onReady }: OllamaSetupProps) {
  const { installed, isStarting, error: tauriError, checkInstalled, startOllama, openOllamaDownload } = useTauri();
  const { available, isChecking, isRunning, models, pull, pullModel, lastFailure, recheck } = useLocalOllama();

  const step: Step = available
    ? 'ready'
    : isChecking
      ? 'checking'
      : isRunning
        ? 'pull'
        : installed === false
          ? 'install'
          : 'start';

  useEffect(() => {
    if (step === 'ready') onReady();
  }, [step, onReady]);

  const checkAgain = async () => {
    await checkInstalled();
    await recheck();
  };
  const failure = tauriError ?? (lastFailure ? describeOllamaError(lastFailure) : null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-800/50 backdrop-blur-sm rounded-lg border border-purple-500/30 p-8">
        <h1 className="text-2xl font-bold text-purple-200 mb-2 text-center">Tasern Setup</h1>
        <p className="text-gray-400 text-center mb-8">Preparing the storytelling engine...</p>

        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-2">
            <StepIndicator step={1} label="Install" active={step === 'install'} complete={installed === true || isRunning} />
            <div className="w-8 h-0.5 bg-gray-600" />
            <StepIndicator step={2} label="Start" active={step === 'start'} complete={isRunning} />
            <div className="w-8 h-0.5 bg-gray-600" />
            <StepIndicator step={3} label="Model" active={step === 'pull'} complete={available} />
          </div>
        </div>

        {failure && (
          <div role="alert" className="mb-6 p-3 bg-red-900/30 border border-red-500/50 rounded text-red-300 text-sm">
            {failure}
          </div>
        )}

        {step === 'checking' && <p className="text-center text-gray-400">Looking for Ollama...</p>}

        {step === 'install' && (
          <div className="text-center">
            <div className="text-6xl mb-4">🦙</div>
            <h2 className="text-xl text-purple-200 mb-4">Install Ollama</h2>
            <p className="text-gray-400 mb-6">
              Tasern uses Ollama to run AI locally on your computer. It&apos;s free and keeps your stories private.
            </p>
            <button onClick={() => void openOllamaDownload()} className={PRIMARY}>
              Download Ollama
            </button>
            <button onClick={() => void checkAgain()} className={SECONDARY}>
              I&apos;ve installed it - Check again
            </button>
          </div>
        )}

        {step === 'start' && (
          <div className="text-center">
            <div className="text-6xl mb-4">⚡</div>
            <h2 className="text-xl text-purple-200 mb-4">Start Ollama</h2>
            <p className="text-gray-400 mb-6">Ollama is installed but not running. Click below to start it.</p>
            <button onClick={() => void startOllama()} disabled={isStarting} className={PRIMARY}>
              {isStarting ? 'Starting...' : 'Start Ollama'}
            </button>
            <button onClick={() => void checkAgain()} className={SECONDARY}>
              Check again
            </button>
          </div>
        )}

        {step === 'pull' && (
          <div className="text-center">
            <div className="text-6xl mb-4">📥</div>
            <h2 className="text-xl text-purple-200 mb-4">Download a storytelling model</h2>
            <p className="text-gray-400 mb-6">
              Ollama is running but has no model that can tell stories. {STARTER_MODEL} is a one-time download of about 7 GB.
            </p>
            {pull ? <PullProgressBar status={pull.status} fraction={pull.fraction} /> : (
              <button onClick={() => void pullModel(STARTER_MODEL)} className={PRIMARY}>
                Download {STARTER_MODEL}
              </button>
            )}
          </div>
        )}

        {step === 'ready' && (
          <div className="text-center">
            <div className="text-6xl mb-4">✨</div>
            <h2 className="text-xl text-purple-200 mb-4">Ready!</h2>
            <p className="text-gray-400">Everything is set up. Entering Tasern...</p>
          </div>
        )}

        {step !== 'ready' && (
          <button onClick={onReady} className="w-full mt-6 text-sm text-gray-500 hover:text-gray-300">
            Skip - use the in-browser AI instead
          </button>
        )}

        {models.length > 0 && (
          <div className="mt-8 pt-4 border-t border-gray-700">
            <p className="text-xs text-gray-500 mb-2">Available models:</p>
            <div className="flex flex-wrap gap-2">
              {models.map((model) => (
                <span key={model} className="px-2 py-1 bg-gray-700/50 rounded text-xs text-gray-400">
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

const PRIMARY =
  'w-full py-3 px-6 bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white rounded-lg font-medium transition-colors mb-4';
const SECONDARY = 'w-full py-2 px-6 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors';

function PullProgressBar({ status, fraction }: { status: string; fraction: number | null }) {
  const percent = fraction === null ? null : Math.round(fraction * 100);
  return (
    <div role="status" aria-live="polite" className="mb-4">
      <div
        className="h-2 bg-gray-700 rounded overflow-hidden"
        role="progressbar"
        aria-label="Model download"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
      >
        <div className="h-full bg-purple-500 transition-all" style={{ width: `${percent ?? 0}%` }} />
      </div>
      <p className="text-xs text-gray-400 mt-2">
        {status}
        {percent !== null && ` - ${percent}%`}
      </p>
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
          complete ? 'bg-green-600 text-white' : active ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-400'
        }`}
      >
        {complete ? '✓' : step}
      </div>
      <span className={`text-xs mt-1 ${active ? 'text-purple-300' : 'text-gray-500'}`}>{label}</span>
    </div>
  );
}
