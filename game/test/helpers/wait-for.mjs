import assert from 'node:assert/strict';
import { hrtime } from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

// Real Blob/WebCrypto work can finish after hundreds of immediate callbacks, and
// hosted shards run several asset-heavy files concurrently. Keep the observable
// predicate authoritative and bound elapsed waiting without a five-second race.
// Host fixtures may freeze performance.now for gameplay/controller input.
const monotonicNow = () => Number(hrtime.bigint()) / 1e6;
export async function waitFor(
  predicate,
  { message = 'Asynchronous test action did not settle.', timeoutMs = 15000 } = {},
) {
  const deadline = monotonicNow() + timeoutMs;
  while (!predicate()) {
    assert.ok(monotonicNow() < deadline, message);
    await delay(5);
  }
}
