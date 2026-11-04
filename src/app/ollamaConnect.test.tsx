// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://tasern-4.vercel.app/" }
// The hosted web build in a browser that asks before a public page may reach localhost
// (Chrome/Edge 142+): nothing is probed until the player clicks Connect, and the
// browser's own refusal is named as such. Route IDs continue the playtest map.

import { cleanup, configure, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";
import { createFakeOllama, type FakeOllama } from "@/lib/ollama/testing";
import { useOllamaStore } from "@/state/ollamaStore";
import { useStoryStore } from "@/state/storyStore";
import { useWebLLMStore } from "@/state/webllmStore";
import { useWorldStore } from "@/state/worldStore";

configure({ asyncUtilTimeout: 4000 });

const initial = {
  story: useStoryStore.getState(),
  ollama: useOllamaStore.getState(),
  webllm: useWebLLMStore.getState(),
  world: useWorldStore.getState(),
};

let fake: FakeOllama;
let fetchSpy: ReturnType<typeof vi.fn>;
let permission: PermissionState;

beforeEach(() => {
  localStorage.clear();
  useStoryStore.setState(initial.story, true);
  useOllamaStore.setState(initial.ollama, true);
  useWebLLMStore.setState(initial.webllm, true);
  useWorldStore.setState(initial.world, true);
  fake = createFakeOllama();
  fetchSpy = vi.fn(fake.fetch);
  vi.stubGlobal("fetch", fetchSpy);
  Object.defineProperty(navigator, "permissions", {
    configurable: true,
    value: { query: async () => ({ state: permission }) },
  });
  Element.prototype.scrollIntoView = () => undefined;
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, "permissions");
  vi.unstubAllGlobals();
});

const click = (name: RegExp) => fireEvent.click(screen.getByRole("button", { name }));

async function toStartScreen() {
  render(<Home />);
  click(/skip intro/i);
  await screen.findByText(/welcome, traveler/i);
}

describe("hosted web build behind the browser's local-network question", () => {
  it("N30: probes nothing on load; Connect is what reaches Ollama", async () => {
    permission = "prompt";
    await toStartScreen();
    await screen.findByText(/no ai backend available/i);
    expect(fetchSpy).not.toHaveBeenCalled();
    click(/advanced: use local ollama instead/i);
    // jsdom reports no OS, so the Linux steps show; the origin named is the page's own.
    expect(await screen.findAllByText(/OLLAMA_ORIGINS=https:\/\/tasern-4\.vercel\.app/)).not.toHaveLength(0);
    click(/connect to ollama/i);
    await screen.findByText(/local ollama ready/i);
    expect(fetchSpy).toHaveBeenCalled();
  });

  it("N31: a refusal already given is named as the browser's, with nothing probed", async () => {
    permission = "denied";
    await toStartScreen();
    await screen.findByText(/your browser is blocking this site/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("N32: a grant already given connects on load as before", async () => {
    permission = "granted";
    await toStartScreen();
    await screen.findByText(/local ollama ready/i);
  });
});
