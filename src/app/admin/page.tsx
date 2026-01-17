"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface LLMStatus {
  local: { available: boolean; url: string; model: string };
  anthropic: { available: boolean };
  active: "local" | "anthropic" | "none";
}

interface AdminStatus {
  llm: LLMStatus;
  env: {
    nodeEnv: string;
    hasAnthropicKey: boolean;
    hasWalletConnectId: boolean;
    preferLocalLLM: boolean;
  };
  timestamp: string;
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/status");
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
        setIsAuthenticated(true);
      } else if (response.status === 401) {
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error("Failed to fetch status:", err);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        setIsAuthenticated(true);
        setPassword("");
        fetchStatus();
      } else {
        const data = await response.json();
        setError(data.error || "Login failed");
      }
    } catch (err) {
      setError("Connection error");
    }

    setLoading(false);
  };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    setIsAuthenticated(false);
    setStatus(null);
  };

  // Login screen
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h1 className="font-display text-3xl text-gold">Admin Access</h1>
            <p className="text-parchment/60 mt-2">Tales of Tasern</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="story-input w-full"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="btn-primary w-full"
            >
              {loading ? "Authenticating..." : "Enter"}
            </button>
          </form>

          <div className="text-center">
            <Link href="/" className="text-parchment/40 hover:text-parchment/60 text-sm">
              ← Back to Tales
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Admin dashboard
  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gold/20 bg-void/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="font-display text-xl text-gold tracking-wider">
            ADMIN DASHBOARD
          </h1>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-parchment/60 hover:text-parchment text-sm">
              View Site
            </Link>
            <button
              onClick={handleLogout}
              className="text-red-400/60 hover:text-red-400 text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-8 space-y-8">
        {/* LLM Status */}
        <section className="border border-gold/20 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl text-gold">LLM Status</h2>
            <button
              onClick={fetchStatus}
              className="text-parchment/60 hover:text-parchment text-sm"
            >
              Refresh
            </button>
          </div>

          {status && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Local LLM */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      status.llm.local.available
                        ? "bg-green-500"
                        : "bg-red-500"
                    }`}
                  />
                  <span className="font-display text-parchment">Local LLM</span>
                  {status.llm.active === "local" && (
                    <span className="text-xs bg-gold/20 text-gold px-2 py-0.5 rounded">
                      ACTIVE
                    </span>
                  )}
                </div>
                <div className="text-sm text-parchment/60 space-y-1 pl-5">
                  <p>URL: {status.llm.local.url}</p>
                  <p>Model: {status.llm.local.model}</p>
                  <p>
                    Status:{" "}
                    {status.llm.local.available ? (
                      <span className="text-green-400">Online</span>
                    ) : (
                      <span className="text-red-400">Offline</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Anthropic */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      status.llm.anthropic.available
                        ? "bg-green-500"
                        : "bg-red-500"
                    }`}
                  />
                  <span className="font-display text-parchment">Anthropic</span>
                  {status.llm.active === "anthropic" && (
                    <span className="text-xs bg-gold/20 text-gold px-2 py-0.5 rounded">
                      ACTIVE
                    </span>
                  )}
                </div>
                <div className="text-sm text-parchment/60 space-y-1 pl-5">
                  <p>Model: claude-sonnet-4-20250514</p>
                  <p>
                    API Key:{" "}
                    {status.llm.anthropic.available ? (
                      <span className="text-green-400">Configured</span>
                    ) : (
                      <span className="text-red-400">Missing</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {status?.llm.active === "none" && (
            <div className="bg-red-500/10 border border-red-500/30 rounded p-4 text-red-400">
              No LLM available. Configure local Ollama or set ANTHROPIC_API_KEY.
            </div>
          )}
        </section>

        {/* Environment */}
        <section className="border border-gold/20 rounded-lg p-6 space-y-4">
          <h2 className="font-display text-xl text-gold">Environment</h2>

          {status && (
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-parchment/60">Node Environment</span>
                <span className="text-parchment">{status.env.nodeEnv}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-parchment/60">Prefer Local LLM</span>
                <span className="text-parchment">
                  {status.env.preferLocalLLM ? "Yes" : "No"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-parchment/60">Anthropic API Key</span>
                <span className={status.env.hasAnthropicKey ? "text-green-400" : "text-red-400"}>
                  {status.env.hasAnthropicKey ? "Set" : "Missing"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-parchment/60">WalletConnect ID</span>
                <span className={status.env.hasWalletConnectId ? "text-green-400" : "text-red-400"}>
                  {status.env.hasWalletConnectId ? "Set" : "Missing"}
                </span>
              </div>
            </div>
          )}
        </section>

        {/* Configuration Help */}
        <section className="border border-gold/20 rounded-lg p-6 space-y-4">
          <h2 className="font-display text-xl text-gold">Configuration</h2>

          <div className="text-sm text-parchment/70 space-y-4">
            <div>
              <h3 className="text-parchment font-semibold mb-2">Local LLM (Ollama)</h3>
              <pre className="bg-void border border-gold/10 rounded p-3 overflow-x-auto">
{`# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3.2

# Start server (default: http://localhost:11434)
ollama serve`}
              </pre>
            </div>

            <div>
              <h3 className="text-parchment font-semibold mb-2">Environment Variables</h3>
              <pre className="bg-void border border-gold/10 rounded p-3 overflow-x-auto">
{`# .env.local
ADMIN_PASSWORD=your_secure_password
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_WALLET_CONNECT_ID=your_project_id

# Optional - Local LLM config
LOCAL_LLM_URL=http://localhost:11434
LOCAL_LLM_MODEL=llama3.2
PREFER_LOCAL_LLM=true`}
              </pre>
            </div>
          </div>
        </section>

        {/* Timestamp */}
        {status && (
          <p className="text-center text-parchment/30 text-sm">
            Last updated: {new Date(status.timestamp).toLocaleString()}
          </p>
        )}
      </div>
    </main>
  );
}
