import { describe, expect, it } from "vitest";
import { ndjsonLines } from "./ndjson";
import { collect, fromArray } from "./testing";

const bytes = (s: string) => new TextEncoder().encode(s);

describe("ndjsonLines", () => {
  it("joins a line split across chunks and skips blank lines", async () => {
    const chunks = [bytes('{"a":'), bytes('1}\n\n{"b"'), bytes(":2}\n")];
    expect(await collect(ndjsonLines(fromArray(chunks)))).toEqual(['{"a":1}', '{"b":2}']);
  });

  it("yields a final line that has no trailing newline", async () => {
    expect(await collect(ndjsonLines(fromArray([bytes('{"a":1}\n{"done":true}')])))).toEqual([
      '{"a":1}',
      '{"done":true}',
    ]);
  });

  it("keeps a multi-byte character split across two chunks", async () => {
    const encoded = bytes('{"content":"Tasern—é"}\n');
    const cut = encoded.indexOf(0xc3) + 1; // between the two bytes of "é"
    const lines = await collect(ndjsonLines(fromArray([encoded.slice(0, cut), encoded.slice(cut)])));
    expect(lines).toEqual(['{"content":"Tasern—é"}']);
  });

  it("splits identically however the stream is chunked", async () => {
    const text = '{"x":"α"}\n{"y":"ω"}\n{"z":3}\n';
    const encoded = bytes(text);
    for (let size = 1; size <= encoded.length; size++) {
      const chunks: Uint8Array[] = [];
      for (let i = 0; i < encoded.length; i += size) chunks.push(encoded.slice(i, i + size));
      expect(await collect(ndjsonLines(fromArray(chunks)))).toEqual(text.trim().split("\n"));
    }
  });
});
