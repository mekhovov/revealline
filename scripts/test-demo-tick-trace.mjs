import test from 'node:test';
import assert from 'node:assert/strict';
import {
  captureDemoTickTrace,
  compareDemoTickTrace,
  demoTickSHA256,
  DEMO_TICK_LIMIT,
} from './demo-tick-trace.mjs';

const runtime = { engine: 'node', version: process.version, implementation: 'test-native-v1' };
const identity = (tick) => tick.toString(16).padStart(16, '0');
const terminal = { terminalTick: 19, terminalIdentity: identity(19), outcome: 'won' };
const binding = {
  modeId: 'solo',
  levelId: 'fixture',
  variantId: 'standard',
  contentIdentity: 'exact-content-v1',
  simulationIdentity: 'exact-simulation-v1',
  recordingIdentity: 'a'.repeat(64),
};
function adapter(options = {}) {
  const calls = { verify: 0, observe: 0, disposed: 0, ticks: [] };
  return {
    binding: { ...binding, ...options.binding },
    maxTicks: options.maxTicks ?? 100,
    calls,
    async verify() {
      calls.verify++;
      if (options.failure) throw options.failure;
      return options.verified ?? terminal;
    },
    async observe({ onTick, signal }) {
      calls.observe++;
      try {
        for (let tick = 0; tick <= (options.lastTick ?? 19); tick++) {
          signal?.throwIfAborted();
          if (tick === options.skipTick) continue;
          calls.ticks.push(tick);
          await onTick({
            tick,
            stateIdentity: tick === options.divergeAt ? 'f'.repeat(16) : identity(tick),
          });
          options.afterTick?.(tick);
        }
        return options.observed ?? terminal;
      } finally {
        calls.disposed++;
      }
    },
  };
}

test('canonical recording bindings ignore object key order but retain exact values', async () => {
  assert.equal(
    await demoTickSHA256({ z: 2, a: [1, 3] }),
    await demoTickSHA256({ a: [1, 3], z: 2 }),
  );
  assert.notEqual(await demoTickSHA256({ a: [1, 3] }), await demoTickSHA256({ a: [3, 1] }));
  await assert.rejects(demoTickSHA256({ invalid: NaN }), /finite JSON/);
});

test('capture independently verifies and observes the whole native terminal performance', async () => {
  const reference = adapter();
  const packet = await captureDemoTickTrace(reference, { runtime });
  assert.equal(packet.trace.hashes.length, 20);
  assert.deepEqual(reference.calls, {
    verify: 1,
    observe: 1,
    disposed: 1,
    ticks: Array.from({ length: 20 }, (_, tick) => tick),
  });
  assert.equal(packet.receipt.traceSha256, await demoTickSHA256(packet.trace));
  const candidate = adapter();
  const result = await compareDemoTickTrace(candidate, packet, { runtime });
  assert.equal(result.match, true);
  assert.equal(result.firstDivergentTick, null);
  assert.equal(result.lastMatchingTick, 19);
  assert.equal(result.nativeVerification.passed, true);
  assert.equal(candidate.calls.disposed, 1);
});

test('first divergent tick is exact even when later ticks and terminal state reconverge', async () => {
  const packet = await captureDemoTickTrace(adapter(), { runtime });
  const candidate = adapter({ divergeAt: 13 });
  const result = await compareDemoTickTrace(candidate, packet);
  assert.equal(result.firstDivergentTick, 13);
  assert.equal(result.lastMatchingTick, 12);
  assert.equal(result.expected, identity(13));
  assert.equal(result.actual, 'f'.repeat(16));
  assert.equal(result.nativeVerification.passed, true);
  assert.equal(result.match, false);
  assert.equal(candidate.calls.ticks.at(-1), 13);
  assert.equal(candidate.calls.disposed, 1);
});

test('initial state divergence is tick zero, with no invented prior matching tick', async () => {
  const packet = await captureDemoTickTrace(adapter(), { runtime });
  const result = await compareDemoTickTrace(adapter({ divergeAt: 0 }), packet);
  assert.equal(result.firstDivergentTick, 0);
  assert.equal(result.lastMatchingTick, null);
});

test('native verification failure remains a failure even if all diagnostic hashes match', async () => {
  const packet = await captureDemoTickTrace(adapter(), { runtime });
  const result = await compareDemoTickTrace(
    adapter({ failure: new Error('Full summary mismatch') }),
    packet,
  );
  assert.equal(result.match, false);
  assert.equal(result.firstDivergentTick, null);
  assert.equal(result.kind, 'native-verification-failed');
  assert.equal(result.nativeVerification.error.message, 'Full summary mismatch');
});

test('reference capture rejects failed verification before observing anything', async () => {
  const reference = adapter({ failure: new Error('Native checkpoint rejected') });
  await assert.rejects(captureDemoTickTrace(reference, { runtime }), /Native checkpoint rejected/);
  assert.equal(reference.calls.observe, 0);
});

test('reference observation must reach the exact independently verified outcome, tick and hash', async () => {
  for (const options of [
    { lastTick: 18 },
    { skipTick: 8 },
    { observed: { ...terminal, outcome: 'lost' } },
    { observed: { ...terminal, terminalIdentity: 'f'.repeat(16) } },
    { observed: { ...terminal, terminalTick: 18 } },
    { divergeAt: 19 },
  ])
    await assert.rejects(captureDemoTickTrace(adapter(options), { runtime }));
});

test('wrong recording, content, simulation, level, mode or variant rejects before candidate work', async () => {
  const packet = await captureDemoTickTrace(adapter(), { runtime });
  for (const key of Object.keys(binding)) {
    const value =
      key === 'recordingIdentity'
        ? 'b'.repeat(64)
        : key === 'modeId'
          ? 'snake'
          : `${binding[key]}-changed`;
    const candidate = adapter({ binding: { [key]: value } });
    await assert.rejects(compareDemoTickTrace(candidate, packet), /different recording/);
    assert.equal(candidate.calls.verify, 0);
    assert.equal(candidate.calls.observe, 0);
  }
});

test('retained reference receipt detects changed trace hashes and runtime provenance', async () => {
  for (const change of [
    (trace) => {
      trace.hashes[3] = 'f'.repeat(16);
    },
    (trace) => {
      trace.runtime.version = 'modified';
    },
  ]) {
    const packet = await captureDemoTickTrace(adapter(), { runtime });
    change(packet.trace);
    await assert.rejects(compareDemoTickTrace(adapter(), packet), /retained receipt/);
  }
});

test('malformed or incomplete references are rejected before candidate execution', async () => {
  for (const change of [
    (trace) => {
      trace.hashes.splice(3, 1);
    },
    (trace) => {
      trace.hashes[3] = 12345678;
    },
    (trace) => {
      trace.verification.terminalTick = 0;
    },
    (trace) => {
      trace.verification.outcome = 'running';
    },
  ]) {
    const packet = await captureDemoTickTrace(adapter(), { runtime });
    change(packet.trace);
    await assert.rejects(compareDemoTickTrace(adapter(), packet));
  }
});

test('missing and extra native ticks are distinct from measured state divergence', async () => {
  const packet = await captureDemoTickTrace(adapter(), { runtime });
  const short = await compareDemoTickTrace(adapter({ lastTick: 8 }), packet);
  assert.equal(short.kind, 'missing-native-tick');
  assert.equal(short.firstDivergentTick, 9);
  assert.equal(short.actual, null);
  const long = await compareDemoTickTrace(adapter({ lastTick: 20 }), packet);
  assert.equal(long.kind, 'extra-native-tick');
  assert.equal(long.firstDivergentTick, 20);
  assert.equal(long.expected, null);
});

test('observation faults do not invent an exact divergent tick', async () => {
  const packet = await captureDemoTickTrace(adapter(), { runtime });
  const result = await compareDemoTickTrace(adapter({ skipTick: 8 }), packet);
  assert.equal(result.kind, 'observation-failed');
  assert.equal(result.firstDivergentTick, null);
  assert.equal(result.lastMatchingTick, 7);
});

test('cancellation interrupts reference and candidate observation with cleanup', async () => {
  const packet = await captureDemoTickTrace(adapter(), { runtime });
  for (const capture of [true, false]) {
    const controller = new AbortController();
    const value = adapter({
      afterTick: (tick) => {
        if (tick === 7) controller.abort();
      },
    });
    await assert.rejects(
      capture
        ? captureDemoTickTrace(value, { runtime, signal: controller.signal })
        : compareDemoTickTrace(value, packet, { signal: controller.signal }),
      { name: 'AbortError' },
    );
    assert.equal(value.calls.disposed, 1);
    assert.equal(value.calls.ticks.at(-1), 7);
  }
});

test('absolute tick cap and invalid verification identities fail closed', async () => {
  await assert.rejects(
    captureDemoTickTrace(adapter({ maxTicks: DEMO_TICK_LIMIT + 1 }), { runtime }),
    /adapter/,
  );
  await assert.rejects(
    captureDemoTickTrace(adapter({ verified: { ...terminal, terminalIdentity: 12345678 } }), {
      runtime,
    }),
    /terminal verification/,
  );
});

test('admitted reference and receipt are owned while asynchronous hashing is pending', async () => {
  const packet = await captureDemoTickTrace(adapter(), { runtime });
  const expected = packet.receipt.traceSha256;
  const pending = compareDemoTickTrace(adapter(), packet);
  packet.receipt.traceSha256 = 'f'.repeat(64);
  packet.trace.hashes[5] = 'f'.repeat(16);
  const result = await pending;
  assert.equal(result.match, true);
  assert.equal(result.referenceTraceSha256, expected);
});

test('binding mutation during reference or candidate observation rejects its result', async () => {
  const packet = await captureDemoTickTrace(adapter(), { runtime });
  for (const capture of [true, false]) {
    const value = adapter({
      afterTick(tick) {
        if (tick === 7) value.binding.levelId = 'changed';
      },
    });
    await assert.rejects(
      capture ? captureDemoTickTrace(value, { runtime }) : compareDemoTickTrace(value, packet),
      /binding changed/,
    );
  }
});
