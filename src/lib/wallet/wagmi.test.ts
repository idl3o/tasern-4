// The wallet config must be created once per process. `next dev` re-evaluates server
// modules on every rebuild; a config per evaluation leaks a WalletConnect Core each time
// (the 2026-11-02 dev server reached 100 GB of commit overnight that way).
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const getDefaultConfig = vi.fn(() => ({ marker: Symbol("wagmi config") }));
vi.mock("@rainbow-me/rainbowkit", () => ({ getDefaultConfig }));
vi.mock("wagmi/chains", () => ({ polygon: { id: 137 } }));

const slot = globalThis as typeof globalThis & { __tasernWagmiConfig?: unknown };

beforeEach(() => {
  delete slot.__tasernWagmiConfig;
  getDefaultConfig.mockClear();
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_WALLET_CONNECT_ID", "test-project");
});

afterEach(() => {
  delete slot.__tasernWagmiConfig;
  vi.unstubAllEnvs();
});

it("builds the config once and hands the same instance to every re-evaluation", async () => {
  const first = await import("./wagmi");
  vi.resetModules(); // what a dev-server rebuild does to this module
  const second = await import("./wagmi");

  expect(second.config).toBe(first.config);
  expect(getDefaultConfig).toHaveBeenCalledTimes(1);
});

it("refuses to build without a WalletConnect project ID", async () => {
  vi.stubEnv("NEXT_PUBLIC_WALLET_CONNECT_ID", "");
  await expect(import("./wagmi")).rejects.toThrow(/NEXT_PUBLIC_WALLET_CONNECT_ID/);
  expect(getDefaultConfig).not.toHaveBeenCalled();
});