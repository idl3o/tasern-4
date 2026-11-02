/**
 * Splits a stream of byte chunks into complete, non-empty NDJSON lines. Decodes
 * UTF-8 as a stream, so a multi-byte character straddling two chunks survives.
 */
export async function* ndjsonLines(
  chunks: AsyncIterable<Uint8Array>
): AsyncGenerator<string, void, undefined> {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of chunks) {
    buffer += decoder.decode(chunk, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) yield line;
    }
  }
  const tail = (buffer + decoder.decode()).trim();
  if (tail) yield tail;
}

/** A fetch body as an async iterable; async iteration of ReadableStream isn't universal yet. */
export async function* readerChunks(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<Uint8Array, void, undefined> {
  const reader = body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}
