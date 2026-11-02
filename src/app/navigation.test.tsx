// @vitest-environment jsdom
// Navigation coverage for the web build: every route on the playtest map, through
// the real components, stores and hooks. Only the network (a scripted Ollama) and
// the dice RNG are faked. Route IDs (N1...) match the map.

import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";
import { createFakeOllama, type FakeOllama } from "@/lib/ollama/testing";
import { recheckOllama } from "@/hooks/useLocalOllama";
import { useOllamaStore } from "@/state/ollamaStore";
import { useStoryStore } from "@/state/storyStore";
import { useWebLLMStore } from "@/state/webllmStore";
import { useWorldStore } from "@/state/worldStore";

configure({ asyncUtilTimeout: 4000 }); // creation steps animate for 300ms each, rolls for 500ms

const initial = {
  story: useStoryStore.getState(),
  ollama: useOllamaStore.getState(),
  webllm: useWebLLMStore.getState(),
  world: useWorldStore.getState(),
};

let fake: FakeOllama;

beforeEach(() => {
  localStorage.clear();
  useStoryStore.setState(initial.story, true);
  useOllamaStore.setState(initial.ollama, true);
  useWebLLMStore.setState(initial.webllm, true);
  useWorldStore.setState(initial.world, true);
  fake = createFakeOllama();
  vi.stubGlobal("fetch", fake.fetch);
  // 0.99: the d20 lands on 20 and fate never stirs, so every route is deterministic.
  vi.spyOn(Math, "random").mockReturnValue(0.99);
  Element.prototype.scrollIntoView = () => undefined; // not implemented by jsdom
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const button = (name: string | RegExp) => screen.getByRole<HTMLButtonElement>("button", { name });
const click = (name: string | RegExp) => fireEvent.click(button(name));
const findButton = (name: string | RegExp) => screen.findByRole("button", { name });

async function toStartScreen() {
  render(<Home />);
  click(/skip intro/i);
  await screen.findByText(/welcome, traveler/i);
  await screen.findByText(/local ollama ready/i);
}

/** Begin New Story through all four creation steps, up to Enter Tasern. */
async function createCharacter(name: string) {
  click(/begin new story/i);
  const nameBox = await screen.findByPlaceholderText(/enter your name/i);
  fireEvent.change(nameBox, { target: { value: name } });
  fireEvent.keyDown(nameBox, { key: "Enter" });
  fireEvent.click(await findButton(/a dying world/i));
  click(/^continue/i);
  fireEvent.click(await findButton(/knowledge is the true power/i));
  click(/^continue/i);
  fireEvent.click(await findButton(/durgan dynasty/i));
  click(/enter tasern/i);
}

async function beginStory(name = "Wren") {
  await createCharacter(name);
  await screen.findByText(/Narration 1/);
}

function typeAction(text: string) {
  fireEvent.change(screen.getByPlaceholderText(/what do you do/i), { target: { value: text } });
  click(/^act$/i);
}

describe("intro", () => {
  it("N1: Continue through every page, then Begin, reaches the start screen", async () => {
    render(<Home />);
    for (const next of [/final membrane/, /twin suns/, /time moves slowly/i, /slow gravity of tasern/i]) {
      click(/^continue/i);
      await screen.findByText(next);
    }
    click(/^begin/i);
    await screen.findByText(/welcome, traveler/i);
  });

  it("N2: Skip intro reaches the start screen, with no wallet in the header", async () => {
    await toStartScreen();
    expect(within(screen.getByRole("banner")).queryByRole("button")).toBeNull();
  });
});

describe("start screen", () => {
  it("N8: lists the installed models, warms the default, and swaps on pick", async () => {
    await toStartScreen();
    const picker = screen.getByRole("combobox", { name: /ollama model/i });
    expect(Array.from((picker as HTMLSelectElement).options).map((o) => o.value)).toEqual([
      "gemma4:latest",
      "llama3.2:latest",
    ]);
    await waitFor(() => expect(fake.management).toContainEqual({ model: "gemma4:latest", keep_alive: "30m" }));
    fireEvent.change(picker, { target: { value: "llama3.2:latest" } });
    await waitFor(() => expect(fake.management).toContainEqual({ model: "llama3.2:latest", keep_alive: "30m" }));
    expect(fake.management).toContainEqual({ model: "gemma4:latest", keep_alive: 0 });
    expect(useOllamaStore.getState().chosenModel).toBe("llama3.2:latest");
  });

  it("N12: Ollama going away shows the setup help; coming back restores Ready", async () => {
    await toStartScreen();
    fake.up = false;
    await act(() => recheckOllama());
    await screen.findByText(/no ai backend available/i);
    click(/advanced: use local ollama instead/i);
    await screen.findByText(/OLLAMA_ORIGINS=/);
    fake.up = true;
    await act(() => recheckOllama());
    await screen.findByText(/local ollama ready/i);
  });

  it("N11: Delete asks to confirm, reverts after 3s, and deletes on confirm", async () => {
    await toStartScreen();
    await beginStory();
    click(/exit story/i);
    await screen.findByText(/saved stories/i);
    click(/^delete$/i);
    await findButton(/confirm\?/i);
    await waitFor(() => button(/^delete$/i), { timeout: 4500 });
    click(/^delete$/i);
    click(/confirm\?/i);
    await waitFor(() => expect(screen.queryByText(/saved stories/i)).toBeNull());
  });

  it("N13: after skipping the browser AI, the player can still enable it later", async () => {
    await toStartScreen();
    click(/enable local ai/i);
    await screen.findByText(/enable local ai\?/i);
    click(/^skip$/i);
    await screen.findByText(/welcome, traveler/i);
    expect(screen.queryByRole("button", { name: /enable local ai/i })).toBeNull(); // the offer is quieter
    click(/enable browser ai/i);
    await screen.findByText(/enable local ai\?/i);
  });
});

describe("character creation", () => {
  it("N15-N17: name is optional, picks gate Continue, Back keeps earlier picks", async () => {
    await toStartScreen();
    click(/begin new story/i);
    await screen.findByPlaceholderText(/enter your name/i);
    expect(button(/^continue/i).disabled).toBe(false); // blank name allowed
    click(/^continue/i);
    await findButton(/a dying world/i);
    expect(button(/^continue/i).disabled).toBe(true);
    fireEvent.click(button(/a dying world/i));
    expect(button(/^continue/i).disabled).toBe(false);
    click(/^continue/i);
    await findButton(/knowledge is the true power/i);
    click(/^back$/i);
    await findButton(/a dying world/i);
    expect(button(/^continue/i).disabled).toBe(false); // origin still chosen
  });

  it("N18: creation can be abandoned from its first step", async () => {
    await toStartScreen();
    click(/begin new story/i);
    await screen.findByPlaceholderText(/enter your name/i);
    click(/^back$/i);
    await screen.findByText(/welcome, traveler/i);
  });

  it("N19: Enter Tasern opens the story and streams the opening", async () => {
    await toStartScreen();
    await beginStory();
    expect(fake.turns[0]).toMatch(/begin an interactive story/i);
    await findButton(/look around/i);
  });
});

describe("story view", () => {
  it("N20-N22: a suggested move, a typed action, and a test of fate each get a reply", async () => {
    await toStartScreen();
    await beginStory();
    fireEvent.click(await findButton(/look around/i));
    await screen.findByText(/Narration 2/);
    typeAction("I wave at the stranger");
    await screen.findByText(/Narration 3/);
    fireEvent.change(screen.getByPlaceholderText(/what do you do/i), { target: { value: "I leap the gap" } });
    fireEvent.click(screen.getByTitle(/rolling Perception/));
    await screen.findByText(/Narration 4/);
    expect(fake.turns[3]).toMatch(/deliberately attempts: "I leap the gap"/);
  });

  it("N23: the narrator asks for a roll, the player rolls, the story continues", async () => {
    await toStartScreen();
    await beginStory();
    typeAction("I roll for it across the ice");
    await screen.findByText(/the fates demand a roll/i);
    click(/roll d20/i);
    await screen.findByText(/Narration 3/);
    expect(fake.turns[2]).toMatch(/fate roll has been cast/i);
  });

  it("N24: Journal and Chronicle open and close, and opening one closes the other", async () => {
    await toStartScreen();
    await beginStory();
    click(/^chronicle$/i);
    expect(screen.getAllByRole("button", { name: /close/i })).toHaveLength(1);
    click(/^journal/i);
    expect(screen.queryByRole("heading", { name: /journal/i })).not.toBeNull();
    expect(screen.getAllByRole("button", { name: /close/i })).toHaveLength(1);
    click(/close/i);
    expect(screen.queryByRole("heading", { name: /journal/i })).toBeNull();
  });

  it("N25: Exit then Continue restores the transcript", async () => {
    await toStartScreen();
    await beginStory();
    fireEvent.click(await findButton(/look around/i));
    await screen.findByText(/Narration 2/);
    click(/exit story/i);
    await screen.findByText(/saved stories/i);
    click(/^continue$/i);
    await screen.findByText(/Narration 1/);
    expect(screen.queryByText(/Narration 2/)).not.toBeNull();
  });

  it("N25b: Continue restores the last suggested moves", async () => {
    await toStartScreen();
    await beginStory();
    click(/exit story/i);
    await screen.findByText(/saved stories/i);
    click(/^continue$/i);
    await screen.findByText(/Narration 1/);
    expect(screen.queryByRole("button", { name: /look around/i })).not.toBeNull();
  });

  it("N26: exiting mid-reply and starting a new story still streams the new opening", async () => {
    await toStartScreen();
    const release = fake.hold();
    await createCharacter("First");
    await screen.findByText(/Narration 1/); // first half only: the reply is held
    click(/exit story/i);
    expect(fake.cancelled).toBe(1); // Ollama stops generating the abandoned reply
    await createCharacter("Second");
    release();
    await waitFor(() => expect(fake.turns.filter((t) => /begin an interactive story/i.test(t))).toHaveLength(2));
    await screen.findByText(/Narration 2/);
  }, 20_000);

  it("N27: Exit Story works while a roll is pending, and Continue brings the roll back", async () => {
    await toStartScreen();
    await beginStory();
    typeAction("I roll for it across the ice");
    await screen.findByText(/the fates demand a roll/i);
    click(/exit story/i);
    await screen.findByText(/saved stories/i);
    click(/^continue$/i);
    await screen.findByText(/the fates demand a roll/i);
    await findButton(/roll d20/i);
  });

  it("N28: after a reload, the start screen header shows no story title", async () => {
    await toStartScreen();
    await beginStory();
    // A reload: memory is wiped and the store rehydrates from what is on disk. Resetting
    // the store would also persist the empty state, so put the disk back afterwards.
    const disk = Object.fromEntries(Object.entries(localStorage));
    expect(Object.keys(disk)).toContain("tasern-stories");
    cleanup();
    useStoryStore.setState(initial.story, true);
    localStorage.clear();
    for (const [key, value] of Object.entries(disk)) localStorage.setItem(key, value);
    await act(() => useStoryStore.persist.rehydrate());
    render(<Home />);
    click(/skip intro/i);
    await screen.findByText(/welcome, traveler/i);
    expect(within(screen.getByRole("banner")).queryByText(/wren's tale/i)).toBeNull();
    expect(screen.getByText(/wren's tale/i)).toBeTruthy(); // the story itself survived
  });

  it("N29: Ollama going away mid-story is named, and play resumes once it is back", async () => {
    await toStartScreen();
    await beginStory();
    fake.up = false;
    typeAction("I listen");
    await screen.findByText(/ollama isn't running on this machine/i);
    fake.up = true;
    await act(() => recheckOllama());
    typeAction("I listen again");
    await screen.findByText(/Narration 2/); // the failed turn never reached Ollama
  });
});

describe("chapters", () => {
  it("C1: near the budget the narrator winds down, then a new chapter opens in a fresh window", async () => {
    await toStartScreen();
    await beginStory();
    expect(screen.getByText(/^Chapter 1$/)).toBeTruthy();

    fake.promptTokens = 6_000; // 73% of the 8192-token window: past the wind-down mark
    typeAction("I press on");
    await screen.findByText(/Narration 2/);
    await screen.findByText(/the chapter draws toward its close/i);

    fake.promptTokens = 7_200; // 88%: past the close mark
    typeAction("I press on again");
    await screen.findByText(/Narration 3/);
    expect(fake.turns[2]).toMatch(/drawing toward its close/i); // the steer reached the narrator
    fake.promptTokens = 120;

    await screen.findByText(/Chapter 2 ❖/);
    await screen.findByText(/Narration 4/);
    expect(fake.extractions).toBeGreaterThan(0); // the climax was summarised first
    expect(fake.turns[3]).toMatch(/a new chapter of the traveller's saga begins: chapter 2/i);
    expect(fake.histories[3]).toBe(0); // a fresh window: nothing from before the divider
    expect(screen.getByText(/^Chapter 2$/)).toBeTruthy();
  }, 20_000);

  it("C2: Continue keeps the chapter, and the next turn sees only this chapter's history", async () => {
    await toStartScreen();
    await beginStory();
    fake.promptTokens = 7_200;
    typeAction("I press on");
    await screen.findByText(/Narration 2/);
    fake.promptTokens = 120;
    await screen.findByText(/Narration 3/); // the Chapter 2 opening
    click(/exit story/i);
    await screen.findByText(/saved stories/i);
    click(/^continue$/i);
    await screen.findByText(/^Chapter 2$/);
    fireEvent.click(await findButton(/look around/i));
    await screen.findByText(/Narration 4/);
    expect(fake.histories[3]).toBe(1); // just the chapter opening, not the whole saga
  }, 20_000);
});
