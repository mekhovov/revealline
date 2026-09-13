import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';

// Real Blob/WebCrypto work can finish after hundreds of immediate callbacks.
// Keep the observable predicate authoritative and bound elapsed waiting instead.
export async function waitFor(
  predicate,
  { message = 'Asynchronous test action did not settle.', timeoutMs = 5000 } = {},
) {
  const deadline = performance.now() + timeoutMs;
  while (!predicate()) {
    assert.ok(performance.now() < deadline, message);
    await delay(5);
  }
}
