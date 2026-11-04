"use client";

import { useEffect, useState } from "react";
import { useLocalOllama } from "@/hooks/useLocalOllama";
import { deriveStage, type ConnectStage } from "@/lib/ollama/connectStage";
import { describeOllamaError, type OllamaError } from "@/lib/ollama/errors";
import { pageIsLoopback } from "@/lib/ollama/loopbackPermission";
import { detectOS, type DesktopOS } from "@/lib/platform";
import type { PullState } from "@/state/ollamaStore";
import PullProgressBar from "./PullProgressBar";

// The model the narrator's tag protocol was tuned against (6/6 in the 2026-11-02 playtest).
export const RECOMMENDED_MODEL = "gemma4";

interface OllamaConnectPanelProps {
  open: boolean;
  onToggle: () => void;
}

/**
 * Web-build setup for a player's own Ollama, as a wizard: Connect first, then the
 * one step the attempt found missing. Rendered only while Ollama can't narrate.
 */
export default function OllamaConnectPanel({ open, onToggle }: OllamaConnectPanelProps) {
  const ollama = useLocalOllama();
  const stage = deriveStage({
    idle: ollama.isIdle,
    checking: ollama.isChecking,
    running: ollama.isRunning,
    error: ollama.error,
  });
  return (
    <div className="bg-void/50 border border-gold/30 rounded-lg p-4 text-sm text-parchment/80">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="text-xs text-parchment/40 hover:text-parchment/60 flex items-center gap-1"
      >
        <span className={`transition-transform ${open ? "rotate-90" : ""}`}>&#9654;</span>
        Advanced: use local Ollama instead
      </button>

      {open && (
        <div className="mt-3 p-3 bg-gray-900/50 rounded text-xs text-parchment/60 text-left">
          <StageView
            stage={stage}
            pull={ollama.pull}
            pullFailure={ollama.lastFailure}
            onConnect={() => void ollama.connect()}
            onPull={() => void ollama.pullModel(RECOMMENDED_MODEL)}
          />
        </div>
      )}
    </div>
  );
}

interface StageViewProps {
  stage: ConnectStage;
  pull: PullState | null;
  pullFailure: OllamaError | null;
  onConnect: () => void;
  onPull: () => void;
}

function StageView({ stage, pull, pullFailure, onConnect, onPull }: StageViewProps) {
  switch (stage.stage) {
    case "start":
      return <StartStage onConnect={onConnect} />;
    case "checking":
      return (
        <>
          <p role="status">Looking for Ollama on this machine...</p>
          <button disabled className={ACTION}>
            Connecting...
          </button>
        </>
      );
    case "install":
      return <InstallStage onRetry={onConnect} />;
    case "allow":
      return <AllowStage origin={stage.origin} onRetry={onConnect} />;
    case "browser":
      return <Failed message={describeOllamaError({ kind: "loopback-denied", state: stage.state })} onRetry={onConnect} />;
    case "download":
      return <DownloadStage pull={pull} failure={pullFailure} onPull={onPull} />;
    case "failed":
      return <Failed message={describeOllamaError(stage.error)} onRetry={onConnect} />;
  }
}

function StartStage({ onConnect }: { onConnect: () => void }) {
  return (
    <>
      <p className="mb-2">
        Tasern can run on Ollama on your own computer. Your story never leaves your machine, and on most computers
        it answers faster than the browser AI. Works in Chrome, Edge and Firefox. Safari may refuse the connection.
      </p>
      <p>
        Chrome and Edge will first ask whether this site may reach programs on your computer. Choose Allow. Firefox
        doesn&apos;t ask. If Ollama isn&apos;t set up yet, the next step tells you what&apos;s missing.
      </p>
      <button onClick={onConnect} className={ACTION}>
        Connect to Ollama
      </button>
    </>
  );
}

function InstallStage({ onRetry }: { onRetry: () => void }) {
  return (
    <>
      <StepLabel>Step 1 of 3: Ollama</StepLabel>
      <p>
        Ollama isn&apos;t running on this machine. If it isn&apos;t installed yet, get it from{" "}
        <a href="https://ollama.com/download" target="_blank" rel="noopener noreferrer" className={LINK}>
          ollama.com/download
        </a>
        . Open it, then check again.
      </p>
      <button onClick={onRetry} className={ACTION}>
        Check again
      </button>
    </>
  );
}

function AllowStage({ origin, onRetry }: { origin: string; onRetry: () => void }) {
  return (
    <>
      <StepLabel>Step 2 of 3: Allow this site</StepLabel>
      <p className="mb-2">
        Ollama is running but hasn&apos;t been told to accept this site. This is the one step a browser can&apos;t do
        for you.
      </p>
      <AllowSiteStep os={detectOS()} origin={origin} />
      <button onClick={onRetry} className={ACTION}>
        Check again
      </button>
    </>
  );
}

function DownloadStage({ pull, failure, onPull }: { pull: PullState | null; failure: OllamaError | null; onPull: () => void }) {
  return (
    <>
      <StepLabel>Step 3 of 3: The storyteller</StepLabel>
      <p className="mb-2">
        Ollama is connected but has no model that can tell stories. {RECOMMENDED_MODEL} is the one the narrator was
        written against: a one-time download of about 7 GB, done from here.
      </p>
      {failure && (
        <p role="alert" className="mb-2 text-gold">
          {describeOllamaError(failure)}
        </p>
      )}
      {pull ? (
        <PullProgressBar status={pull.status} fraction={pull.fraction} />
      ) : (
        <button onClick={onPull} className={ACTION}>
          Download {RECOMMENDED_MODEL}
        </button>
      )}
    </>
  );
}

function Failed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <>
      <p role="alert" className="text-gold">
        {message}
      </p>
      <button onClick={onRetry} className={ACTION}>
        Try again
      </button>
    </>
  );
}

function StepLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[10px] uppercase tracking-widest text-parchment/40">{children}</p>;
}

const LINK = "text-blue-400 underline hover:text-blue-300";
const ACTION =
  "mt-4 w-full py-2 px-4 rounded bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30 disabled:opacity-50 disabled:cursor-not-allowed";

/** A command to run, with a Copy button where the browser offers a clipboard. */
function Command({ text }: { text: string }) {
  const [canCopy, setCanCopy] = useState(false);
  const [copied, setCopied] = useState(false);
  // Decided after mount so the server-rendered markup matches the first client render.
  useEffect(() => setCanCopy(typeof navigator !== "undefined" && "clipboard" in navigator), []);
  const copy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <span className="inline-flex items-start gap-2 my-1 max-w-full">
      <code className="px-2 py-1 bg-gray-800 rounded font-mono text-green-400 select-all whitespace-pre-wrap break-all">
        {text}
      </code>
      {canCopy && (
        <button type="button" onClick={copy} aria-label={`Copy: ${text}`} className="text-parchment/50 hover:text-parchment">
          {copied ? "Copied" : "Copy"}
        </button>
      )}
    </span>
  );
}

/** Ollama's documented route for each OS. The restart comes last, so the step ends on what makes it work. */
function AllowSiteStep({ os, origin }: { os: DesktopOS; origin: string }) {
  if (pageIsLoopback()) {
    return (
      <p>
        Ollama refused a page from your own machine, which its default settings allow. Check that an OLLAMA_ORIGINS
        setting isn&apos;t overriding them.
      </p>
    );
  }
  if (os === "windows") {
    return (
      <>
        <p>In a terminal run:</p>
        <Command text={`setx OLLAMA_ORIGINS ${origin}`} />
        <p>
          Then quit Ollama from the system tray and start it again from the Start menu. This replaces any
          OLLAMA_ORIGINS you had set before; if you already allow other sites, add this one to that list instead.
        </p>
      </>
    );
  }
  if (os === "mac") {
    return (
      <>
        <p>In Terminal run:</p>
        <Command text={`launchctl setenv OLLAMA_ORIGINS ${origin}`} />
        <p>Then quit Ollama from the menu bar and open it again.</p>
      </>
    );
  }
  return (
    <>
      <p>If Ollama runs as a service, edit it with:</p>
      <Command text="sudo systemctl edit ollama" />
      <p>add under the service section:</p>
      <Command text={`[Service]\nEnvironment="OLLAMA_ORIGINS=${origin}"`} />
      <p>then:</p>
      <Command text="sudo systemctl restart ollama" />
      <p>If you start Ollama by hand instead:</p>
      <Command text={`OLLAMA_ORIGINS=${origin} ollama serve`} />
    </>
  );
}
