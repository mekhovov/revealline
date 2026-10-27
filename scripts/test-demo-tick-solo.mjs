import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDemoTickAdapter } from './demo-tick-adapters.mjs';
import { captureDemoTickTrace, compareDemoTickTrace } from './demo-tick-trace.mjs';

const recording = JSON.parse(
  await readFile(
    new URL('../game/demo-data/solo-qualified-bda094dfb23a16c2.replay.json', import.meta.url),
    'utf8',
  ),
);
const runtime = { engine: 'node', version: process.versions.node, implementation: 'test-fixture' };

test('Solo exact trace reaches the independently verified native terminal state', async () => {
  const adapter = await createDemoTickAdapter({ modeId: 'solo', recording });
  const reference = await captureDemoTickTrace(adapter, { runtime });
  assert.equal(reference.trace.hashes.length, recording.ticks + 1);
  assert.equal(reference.trace.verification.outcome, recording.summary.status);
  assert.equal(reference.trace.hashes.at(-1), recording.checkpoint.hash);
  const compared = await compareDemoTickTrace(adapter, reference);
  assert.equal(compared.match, true);
  assert.equal(compared.nativeVerification.passed, true);
  assert.equal(compared.lastMatchingTick, recording.ticks);
});

test('Solo diagnosis locates an early transient mismatch between sparse checkpoints', async () => {
  const adapter = await createDemoTickAdapter({ modeId: 'solo', recording });
  const reference = await captureDemoTickTrace(adapter, { runtime });
  const visited = [];
  const candidate = {
    ...adapter,
    observe: (options) =>
      adapter.observe({
        ...options,
        onTick(row) {
          visited.push(row.tick);
          return options.onTick(
            row.tick === 17 ? { ...row, stateIdentity: '0000000000000000' } : row,
          );
        },
      }),
  };
  const result = await compareDemoTickTrace(candidate, reference);
  assert.equal(result.firstDivergentTick, 17);
  assert.equal(result.lastMatchingTick, 16);
  assert.equal(result.match, false);
  assert.equal(result.nativeVerification.passed, true);
  assert.equal(visited.at(-1), 17, 'Observation stops at the first mismatch.');
});

test('Solo observation awaits callbacks and cancellation stops further native ticks', async () => {
  const adapter = await createDemoTickAdapter({ modeId: 'solo', recording });
  const controller = new AbortController();
  const seen = [];
  await assert.rejects(
    adapter.observe({
      signal: controller.signal,
      async onTick(row) {
        await Promise.resolve();
        seen.push(row.tick);
        if (row.tick === 17) controller.abort();
      },
    }),
    { name: 'AbortError' },
  );
  assert.deepEqual(
    seen,
    Array.from({ length: 18 }, (_, tick) => tick),
  );
});

test('Solo final release uses the native terminal boundary and a mismatched entry is rejected', async () => {
  const released = structuredClone(recording);
  released.releaseAfter = true;
  const adapter = await createDemoTickAdapter({ modeId: 'solo', recording: released });
  let final;
  const observed = await adapter.observe({ onTick: (row) => (final = row) });
  assert.equal(final.tick, observed.terminalTick);
  assert.equal(final.stateIdentity, observed.terminalIdentity);
  await assert.rejects(
    createDemoTickAdapter({ modeId: 'solo', recording, entry: { campaign: { levels: [] } } }),
    /authored entry/,
  );
  await assert.rejects(createDemoTickAdapter({ modeId: 'versus', recording }), /Unknown/);
});
