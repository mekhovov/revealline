import assert from 'node:assert/strict';
import { hrtime } from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

// Real Blob/WebCrypto work can finish after hundreds of immediate callbacks.
// Keep the observable predicate authoritative and bound elapsed waiting instead.
// Host fixtures may freeze performance.now for gameplay/controller input.
const monotonicNow = () => Number(hrtime.bigint()) / 1e6;
export async function waitFor(
  predicate,
  { message = 'Asynchronous test action did not settle.', timeoutMs = 5000 } = {},
) {
  const deadline = monotonicNow() + timeoutMs;
  while (!predicate()) {
    assert.ok(monotonicNow() < deadline, message);
    await delay(5);
  }
}
