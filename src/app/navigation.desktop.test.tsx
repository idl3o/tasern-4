// @vitest-environment jsdom
// Navigation coverage for the desktop build: the setup routes and a story turn,
// through the real Tauri transport and Tauri's real JS library. Only the IPC
// boundary (window.__TAURI_INTERNALS__, standing in for the Rust side) and the
// network are faked.

import { cleanup, configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";
import { createFakeOllama, type FakeOllama } from "@/lib/ollama/testing";
import { useOllamaStore } from "@/state/ollamaStore";
import { useStoryStore } from "@/state/storyStore";

configure({ asyncUtilTimeout: 4000 });

type Handler = (command: string, args: Record<string, unknown>) => Promise<unknown>;

// Tauri's IPC callbacks, as the WebView host keeps them: a Channel registers one,
// then receives { index, message } frames followed by { index, end: true }.
const callbacks = new Map<number, (frame: unknown) => void>();

/** Sends messages to a real Channel the way Tauri's Rust side does. */
function channelSink(channel: unknown) {
  const id = (channel as { id: number }).id;
  let index = 0;
  return {
    send: (message: unknown) => callbacks.get(id)?.({ index: index++, message }),
    end: () => callbacks.get(id)?.({ index: index++, end: true }),
  };
}

const OLLAMA = "http://127.0.0.1:11434";
const initial = { story: useStoryStore.getState(), ollama: useOllamaStore.getState() };
let fake: FakeOllama;
let installed: boolean;

/** The Rust side, as ollama_proxy.rs and lib.rs behave, over the fake Ollama. */
const rust: Handler = async (command, args) => {
  const send = async (path: unknown, body: unknown) => {
    try {
      return await fake.fetch(`${OLLAMA}${String(path)}`, body ? { method: "POST", body: JSON.stringify(body) } : {});
    } catch {
      throw "unreachable: connection refused";
    }
  };
  switch (command) {
    case "check_ollama_installed":
      return installed;
    case "start_ollama":
      fake.up = true;
      return null;
    case "open_ollama_download":
    case "ollama_cancel":
      return null;
    case "ollama_request": {
      const res = await send(args.path, args.body);
      return { status: res.status, body: await res.text() };
    }
    case "ollama_stream": {
      const sink = channelSink(args.onLine);
      const res = await send(args.path, args.body);
      const text = await res.text();
      if (res.ok) for (const line of text.split("\n").filter(Boolean)) sink.send({ kind: "line", line });
      sink.send({ kind: "end", status: res.status, body: res.ok ? "" : text });
      sink.end();
      return null;
    }
    default:
      throw new Error(`unexpected Tauri command: ${command}`);
  }
};

beforeEach(() => {
  localStorage.clear();
  useStoryStore.setState(initial.story, true);
  useOllamaStore.setState(initial.ollama, true);
  fake = createFakeOllama();
  installed = true;
  // Any request that skipped the proxy would hit this and fail the test.
  vi.stubGlobal("fetch", () => Promise.reject(new Error("the desktop build must not fetch Ollama directly")));
  vi.spyOn(Math, "random").mockReturnValue(0.99);
  Element.prototype.scrollIntoView = () => undefined;
  let nextCallback = 1;
  callbacks.clear();
  Object.assign(window, {
    __TAURI_INTERNALS__: {
      invoke: (command: string, args: Record<string, unknown> = {}) => rust(command, args),
      transformCallback: (callback: (frame: unknown) => void) => {
        const id = nextCallback++;
        callbacks.set(id, callback);
        return id;
      },
      unregisterCallback: (id: number) => callbacks.delete(id),
    },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));

async function launch() {
  render(<Home />);
  click(/skip intro/i);
}

describe("desktop setup", () => {
  it("skips setup when Ollama can narrate, and plays a turn through the proxy", async () => {
    await launch();
    await screen.findByText(/local ollama ready/i);
    expect(screen.queryByText(/tasern setup/i)).toBeNull();
    click(/begin new story/i);
    fireEvent.keyDown(await screen.findByPlaceholderText(/enter your name/i), { key: "Enter" });
    fireEvent.click(await screen.findByRole("button", { name: /a dying world/i }));
    click(/^continue/i);
    fireEvent.click(await screen.findByRole("button", { name: /knowledge is the true power/i }));
    click(/^continue/i);
    fireEvent.click(await screen.findByRole("button", { name: /durgan dynasty/i }));
    click(/enter tasern/i);
    await screen.findByText(/Narration 1/);
  });

  it("N3: Start Ollama from setup, then enter the game", async () => {
    fake.up = false;
    await launch();
    await screen.findByText(/tasern setup/i);
    click(await screen.findByRole("button", { name: /^start ollama$/i }).then(() => /^start ollama$/i));
    await screen.findByText(/local ollama ready/i);
  });

  it("N4: Check again while Ollama is still off stays on the Start step", async () => {
    fake.up = false;
    await launch();
    await screen.findByRole("button", { name: /^start ollama$/i });
    click(/check again/i);
    await waitFor(() => expect(screen.getByRole("button", { name: /^start ollama$/i })).toBeTruthy());
    expect(screen.queryByText(/welcome, traveler/i)).toBeNull();
  });

  it("N5: Skip leaves setup for the start screen", async () => {
    fake.up = false;
    await launch();
    await screen.findByText(/tasern setup/i);
    click(/skip - use the in-browser ai/i);
    await screen.findByText(/welcome, traveler/i);
    await screen.findByText(/no ai backend available/i);
  });

  it("offers Install when Ollama is absent, then moves on once it is installed", async () => {
    fake.up = false;
    installed = false;
    await launch();
    await screen.findByRole("heading", { name: /install ollama/i });
    installed = true;
    click(/i've installed it/i);
    await screen.findByRole("button", { name: /^start ollama$/i });
  });

  it("asks for a pull only when no model can chat, and enters the game after it", async () => {
    fake.models = [];
    await launch();
    await screen.findByRole("heading", { name: /download a storytelling model/i });
    click(/download llama3\.2/i);
    await screen.findByText(/local ollama ready/i);
    expect(fake.models).toContain("llama3.2:latest");
  });
});
