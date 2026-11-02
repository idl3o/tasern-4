// @vitest-environment jsdom
// The wallet is cordoned off: with NEXT_PUBLIC_ENABLE_WALLET unset, the app's provider
// tree must render its children without loading or connecting anything wallet-side.

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Providers } from "./providers";
import { WALLET_ENABLED } from "./wallet/flag";

const sockets: string[] = [];
const requests: string[] = [];

beforeEach(() => {
  sockets.length = 0;
  requests.length = 0;
  // Tripwires: WalletConnect opens a relay WebSocket and fetches its remote config.
  vi.stubGlobal(
    "WebSocket",
    class {
      constructor(url: string) {
        sockets.push(url);
      }
    }
  );
  vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
    requests.push(String(input));
    return Promise.reject(new Error("no network in this test"));
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("renders children with no wallet connections when the wallet is not enabled", async () => {
  expect(WALLET_ENABLED).toBe(false);
  render(
    <Providers>
      <p>the story</p>
    </Providers>
  );
  await act(() => new Promise((resolve) => setTimeout(resolve, 50))); // let any lazy work start
  expect(screen.getByText("the story")).toBeTruthy();
  expect(sockets).toEqual([]);
  expect(requests).toEqual([]);
});
