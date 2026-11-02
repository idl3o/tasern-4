// Contract test against a real local Ollama. Skipped unless OLLAMA_LIVE=1, since it
// needs a running server and loads models: `OLLAMA_LIVE=1 npx vitest run live`.

import { afterAll, describe, expect, it } from "vitest";
import { createOllamaClient } from "./client";
import { rankModels, sameModel } from "./models";
import { collect } from "./testing";
import { createHttpTransport, OLLAMA_URL } from "./transport";
import type { ChatEvent, ModelDetails } from "./types";

const live = process.env.OLLAMA_LIVE === "1";
const client = createOllamaClient(createHttpTransport(), { idleTimeoutMs: 180_000 });
const narrator = "You are the narrator of a dark fantasy story. Second person. One short paragraph.";

async function unload(model: string) {
  await fetch(`${OLLAMA_URL}/api/generate`, { method: "POST", body: JSON.stringify({ model, keep_alive: 0 }) });
}

const text = (events: ChatEvent[], type: "content" | "thinking") =>
  events.flatMap((e) => (e.type === type ? [e.text] : [])).join("");

describe.skipIf(!live)("live Ollama", () => {
  let models: ModelDetails[] = [];
  const used = new Set<string>();

  afterAll(async () => {
    await Promise.all(Array.from(used).map(unload));
  });

  it("lists installed models with capabilities", async () => {
    models = rankModels(await client.listModels());
    expect(models.length).toBeGreaterThan(0);
    expect(models.every((m) => m.capabilities?.has("completion") ?? true)).toBe(true);
  });

  it("keeps a thinking model's reasoning out of the story with think: false", async () => {
    const thinker = models.find((m) => m.capabilities?.has("thinking") && !m.name.startsWith("gpt-oss"));
    if (!thinker) return;
    used.add(thinker.name);
    const events = await collect(
      client.chat({
        model: thinker.name,
        messages: [
          { role: "system", content: narrator },
          { role: "user", content: "I step through the cosmic drain into Tasern." },
        ],
        numCtx: 4096,
        keepAlive: "5m",
        think: false,
      })
    );
    expect(text(events, "thinking")).toBe("");
    expect(text(events, "content").length).toBeGreaterThan(40);
  }, 180_000);

  it("holds the model for the requested keep_alive", async () => {
    const model = models.find((m) => !m.capabilities?.has("thinking")) ?? models[0];
    if (!model) return;
    used.add(model.name);
    await collect(
      client.chat({ model: model.name, messages: [{ role: "user", content: "Say hi." }], numCtx: 2048, keepAlive: "30m" })
    );
    const ps = (await (await fetch(`${OLLAMA_URL}/api/ps`)).json()) as { models: { name: string; expires_at: string }[] };
    const loaded = ps.models.find((m) => sameModel(m.name, model.name));
    const minutesLeft = loaded ? (Date.parse(loaded.expires_at) - Date.now()) / 60_000 : 0;
    expect(minutesLeft).toBeGreaterThan(25);
  }, 180_000);
});
