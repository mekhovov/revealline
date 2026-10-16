import { boundedJSON } from '../../game/data-json.mjs';

export const STUDIO_SOURCE_BYTES = 4 * 1024 * 1024;

/** Bound the response before decoding, including when Content-Length is absent. */
export async function readStudioJSON(
  url,
  { signal, originalText = false, fetcher = globalThis.fetch } = {},
) {
  signal?.throwIfAborted();
  const response = await fetcher(url, { signal, redirect: 'error' });
  if (!response.ok)
    throw new Error(
      'Source file is unavailable. Import a complete draft or save its declared source.',
    );
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Source files require a bounded streaming response.');
  const chunks = [];
  let length = 0;
  const cancel = () => {
    // A transport's cancellation may reject or never settle. Cleanup must not
    // delay the original byte-budget or abort failure.
    try {
      void reader.cancel().catch(() => {});
    } catch {
      /* Best effort; preserve the read operation's original error. */
    }
  };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    signal?.throwIfAborted();
    const declared = response.headers?.get('content-length');
    if (declared !== null && declared !== undefined && Number(declared) > STUDIO_SOURCE_BYTES)
      throw new Error('Source file exceeds the 4 MiB byte budget.');
    for (;;) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      signal?.throwIfAborted();
      if (done) break;
      length += value.byteLength;
      if (length > STUDIO_SOURCE_BYTES)
        throw new Error('Source file exceeds the 4 MiB byte budget.');
      chunks.push(value);
    }
  } catch (error) {
    cancel();
    throw error;
  } finally {
    signal?.removeEventListener('abort', cancel);
    try {
      reader.releaseLock();
    } catch {
      /* A cleanup failure must not replace the original read failure. */
    }
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  // Preserve a BOM, whitespace and final newline for immutable retained snapshots.
  const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  const data = boundedJSON(text);
  signal?.throwIfAborted();
  return originalText ? text : data;
}
