import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';
import { hrtime } from 'node:process';
import { waitFor } from './helpers/wait-for.mjs';

test('observable waits allow delayed real SHA-256 work without substituting its result', async () => {
  const bytes = new TextEncoder().encode('abc');
  let received = null;
  const work = crypto.subtle.digest('SHA-256', bytes).then(async (result) => {
    await delay(25);
    received = Buffer.from(result).toString('hex');
  });
  await waitFor(() => received !== null);
  await work;
  assert.equal(received, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('an unresolved observable predicate still fails at a finite elapsed deadline', async () => {
  const started = performance.now();
  await assert.rejects(
    waitFor(() => false, { timeoutMs: 20, message: 'Original never became ready.' }),
    { name: 'AssertionError', message: 'Original never became ready.' },
  );
  assert.ok(performance.now() - started >= 20);
});

test('a frozen gameplay clock cannot disable the observable wait deadline', async (t) => {
  t.mock.method(performance, 'now', () => 1000);
  const started = hrtime.bigint();
  let checks = 0;
  await assert.rejects(
    waitFor(
      () => {
        // Bound this regression even if the old frozen-clock implementation returns.
        if (++checks > 20) throw new Error('The wait deadline followed the frozen gameplay clock.');
        return false;
      },
      { timeoutMs: 20, message: 'Original never became ready under a frozen gameplay clock.' },
    ),
    {
      name: 'AssertionError',
      message: 'Original never became ready under a frozen gameplay clock.',
    },
  );
  assert.ok(Number(hrtime.bigint() - started) / 1e6 >= 20);
  assert.equal(performance.now(), 1000);
});
