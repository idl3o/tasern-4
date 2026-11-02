import { describe, expect, it } from "vitest";
import { normaliseModelName, rankModels, sameModel, selectModel } from "./models";
import { parseShow } from "./parse";
import { fixtureJson } from "./testing";
import type { ModelDetails, ModelName } from "./types";

function model(name: string, capabilities: string[] | null = ["completion"]): ModelDetails {
  return {
    name: name as ModelName,
    family: null,
    parameterSize: null,
    capabilities: capabilities && new Set(capabilities),
    contextLength: null,
  };
}

// Sam's machine, in /api/tags order: the case where `includes("llama3.2")` failed
// and the app fell through to gpt-oss.
const installed = [
  model("gpt-oss:20b", ["completion", "tools", "thinking"]),
  model("gemma4:latest", ["completion", "thinking"]),
  model("gemma4:e4b-it-qat", ["completion", "thinking"]),
  model("nomic-embed-text:latest", ["embedding"]),
  parseShow("llama3.2:latest" as ModelName, fixtureJson("show-llama3.2.json")),
];

describe("model names", () => {
  it("treats a bare name and its :latest tag as the same model", () => {
    expect(normaliseModelName("llama3.2:latest")).toBe("llama3.2");
    expect(sameModel("llama3.2", "llama3.2:latest")).toBe(true);
    expect(sameModel("llama3.2:1b", "llama3.2")).toBe(false);
  });
});

describe("rankModels", () => {
  it("drops models that can't chat and puts reasoning-first models last", () => {
    expect(rankModels(installed).map((m) => m.name)).toEqual([
      "gemma4:latest",
      "gemma4:e4b-it-qat",
      "llama3.2:latest",
      "gpt-oss:20b",
    ]);
  });

  it("keeps models whose capabilities are unknown", () => {
    expect(rankModels([model("mystery:7b", null)])).toHaveLength(1);
  });
});

describe("selectModel", () => {
  it("honours the player's choice, written with or without :latest", () => {
    expect(selectModel(installed, "llama3.2")?.name).toBe("llama3.2:latest");
    expect(selectModel(installed, "gpt-oss:20b")?.name).toBe("gpt-oss:20b");
  });

  it("falls back to the best-ranked model when the choice is gone or can't chat", () => {
    expect(selectModel(installed, "uninstalled:1b")?.name).toBe("gemma4:latest");
    expect(selectModel(installed, "nomic-embed-text")?.name).toBe("gemma4:latest");
    expect(selectModel(installed, null)?.name).toBe("gemma4:latest");
  });

  it("returns null when nothing installed can chat", () => {
    expect(selectModel([model("nomic-embed-text:latest", ["embedding"])], null)).toBeNull();
  });
});
