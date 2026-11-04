"use client";

import { describeOllamaError, type OllamaError } from "@/lib/ollama/errors";
import { pageIsLoopback } from "@/lib/ollama/loopbackPermission";
import { detectOS, type DesktopOS } from "@/lib/platform";

// The model the narrator's tag protocol was tuned against (6/6 in the 2026-11-02 playtest).
export const RECOMMENDED_MODEL = "gemma4";
const PUBLIC_ORIGIN = "https://tasern-4.vercel.app";

interface OllamaConnectPanelProps {
  open: boolean;
  onToggle: () => void;
  /** Nothing has been tried yet: the browser would ask the player first. */
  isIdle: boolean;
  isChecking: boolean;
  /** Ollama answered but has no model that can chat. */
  isRunning: boolean;
  error: OllamaError | null;
  onConnect: () => void;
}

/** Web-build setup for a player's own Ollama: honest steps per OS, and the connect gesture. */
export default function OllamaConnectPanel(props: OllamaConnectPanelProps) {
  const { open, onToggle, isIdle, isChecking, isRunning, error, onConnect } = props;
  const origin = typeof window === "undefined" ? PUBLIC_ORIGIN : window.location.origin;
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
          <p className="mb-3">
            Tasern can run on Ollama on your own computer. Your story never leaves your machine, and on most
            computers it answers faster than the browser AI. Works in Chrome, Edge and Firefox. Safari may refuse
            the connection.
          </p>
          <ol className="space-y-2 list-decimal list-inside">
            <li>
              Install Ollama from{" "}
              <a href="https://ollama.com/download" target="_blank" rel="noopener noreferrer" className={LINK}>
                ollama.com/download
              </a>{" "}
              and open it.
            </li>
            <li>
              Download the storyteller: <Command>ollama pull {RECOMMENDED_MODEL}</Command> (about 7 GB, once).
            </li>
            <AllowSiteStep os={detectOS()} origin={origin} />
            <li>
              Click Connect. Chrome and Edge will ask whether this site may reach programs on your computer.
              Choose Allow. Firefox doesn&apos;t ask.
            </li>
          </ol>

          {error && (
            <p role="alert" className="mt-3 text-gold">
              {describeOllamaError(error)}
            </p>
          )}
          {isRunning && (
            <p role="alert" className="mt-3 text-gold">
              Ollama is connected but has no model that can tell stories. Run{" "}
              <Command>ollama pull {RECOMMENDED_MODEL}</Command>, then connect again.
            </p>
          )}
          <button onClick={onConnect} disabled={isChecking} className={CONNECT}>
            {isChecking ? "Connecting..." : isIdle ? "Connect to Ollama" : "Try again"}
          </button>
        </div>
      )}
    </div>
  );
}

const LINK = "text-blue-400 underline hover:text-blue-300";
const CONNECT =
  "mt-4 w-full py-2 px-4 rounded bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30 disabled:opacity-50 disabled:cursor-not-allowed";

function Command({ children }: { children: React.ReactNode }) {
  return (
    <code className="inline-block my-1 px-2 py-1 bg-gray-800 rounded font-mono text-green-400 select-all break-all">
      {children}
    </code>
  );
}

/** How to put this page on Ollama's allowed-origins list, the way Ollama's own docs say to for each OS. */
function AllowSiteStep({ os, origin }: { os: DesktopOS; origin: string }) {
  if (pageIsLoopback()) {
    return <li>Allow this site: nothing to do. Ollama already accepts pages served from your own machine.</li>;
  }
  if (os === "windows") {
    return (
      <li>
        Allow this site. Quit Ollama from the system tray, then in a terminal run{" "}
        <Command>setx OLLAMA_ORIGINS {origin}</Command> and start Ollama again from the Start menu. This replaces
        any OLLAMA_ORIGINS you had set before; if you already allow other sites, add this one to that list instead.
      </li>
    );
  }
  if (os === "mac") {
    return (
      <li>
        Allow this site. In Terminal run <Command>launchctl setenv OLLAMA_ORIGINS {origin}</Command>, then quit
        Ollama from the menu bar and open it again.
      </li>
    );
  }
  return (
    <li>
      Allow this site. If Ollama runs as a service: <Command>sudo systemctl edit ollama</Command>, add{" "}
      <Command>[Service]</Command> <Command>Environment=&quot;OLLAMA_ORIGINS={origin}&quot;</Command>, then{" "}
      <Command>sudo systemctl restart ollama</Command>. If you start it by hand:{" "}
      <Command>OLLAMA_ORIGINS={origin} ollama serve</Command>.
    </li>
  );
}
