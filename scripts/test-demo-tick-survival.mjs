import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createAdapter } from './demo-tick-adapters/survival.mjs';
import { captureDemoTickTrace, demoTickSHA256 } from './demo-tick-trace.mjs';
import { survivalDemoInventory } from '../game/demo-modes/survival-catalog.mjs';
import { SURVIVAL_DEMO_MAX_TICKS } from '../game/demo-modes/survival-replay.mjs';

const recording = JSON.parse(
  await readFile(
    new URL(
      '../game/demo-data/survival/field-crossing-broken-crossroads.replay.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const entry = survivalDemoInventory().find((item) => item.levelId === recording.levelId);
const noWait = async () => {};

test('Survival exact trace independently verifies and observes every native tick, upgrade and reroll', async () => {
  const input = structuredClone(recording);
  const adapter = await createAdapter({ recording: input });
  assert.deepEqual(adapter.binding, {
    modeId: 'survival',
    levelId: entry.levelId,
    variantId: 'standard',
    contentIdentity: recording.contentIdentity,
    simulationIdentity: recording.simulationIdentity,
    recordingIdentity: await demoTickSHA256(recording),
  });
  assert.equal(adapter.maxTicks, SURVIVAL_DEMO_MAX_TICKS);
  assert.ok(recording.choices.length > 0);
  assert.ok(recording.choices.some((choice) => choice[2] > 0));
  input.inputs[0][1] = -input.inputs[0][1];
  input.choices[0][1] = 'caller-mutation';
  const { trace, receipt } = await captureDemoTickTrace(adapter, {
    runtime: { engine: 'node', version: process.version, implementation: 'native-survival-test' },
    yieldTask: noWait,
  });
  assert.equal(trace.hashes.length, recording.ticks + 1);
  for (const [tick, identity] of recording.checkpoints) assert.equal(trace.hashes[tick], identity);
  assert.deepEqual(trace.verification, {
    terminalTick: recording.ticks,
    terminalIdentity: recording.finalState,
    outcome: recording.outcome,
  });
  assert.equal(trace.hashes.at(-1), recording.finalState);
  assert.match(receipt.traceSha256, /^[a-f0-9]{64}$/);
});

test('a rejected five-second checkpoint still emits the actual advanced boundary tick', async () => {
  const damaged = structuredClone(recording);
  damaged.checkpoints[0][1] = '0000000000000000';
  const adapter = await createAdapter({ recording: damaged, entry });
  await assert.rejects(adapter.verify({ yieldTask: noWait }), { tick: 300 });
  const seen = [];
  await assert.rejects(
    adapter.observe({ onTick: async (row) => seen.push(row), yieldTask: noWait }),
    { code: 'demo-content-mismatch', tick: 300 },
  );
  assert.deepEqual(
    seen.map((row) => row.tick),
    Array.from({ length: 301 }, (_, tick) => tick),
  );
  assert.equal(seen.at(-1).stateIdentity, recording.checkpoints[0][1]);
});

test('a rejected upgrade does not fabricate a tick after its failed action', async () => {
  const damaged = structuredClone(recording);
  damaged.choices[0][1] = 'missing-native-card';
  const adapter = await createAdapter({ recording: damaged });
  const seen = [];
  await assert.rejects(
    adapter.observe({ onTick: (row) => seen.push(row.tick), yieldTask: noWait }),
    { code: 'demo-content-mismatch', tick: recording.choices[0][0] },
  );
  assert.equal(seen.at(-1), recording.choices[0][0]);
  assert.equal(seen.length, recording.choices[0][0] + 1);
});

test('the observer is awaited and cancellation retires observation before another native tick', async () => {
  const adapter = await createAdapter({ recording });
  const controller = new AbortController();
  const reason = new DOMException('Stop diagnosis', 'AbortError');
  let release,
    calls = 0;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const pending = adapter.observe({
    signal: controller.signal,
    yieldTask: noWait,
    async onTick(row) {
      calls++;
      assert.equal(row.tick, 0);
      await gate;
    },
  });
  await Promise.resolve();
  assert.equal(calls, 1);
  controller.abort(reason);
  release();
  await assert.rejects(pending, (error) => error === reason);
  assert.equal(calls, 1);
  await assert.rejects(adapter.verify({ signal: controller.signal }), (error) => error === reason);
});

test('a comparator failure at a checkpoint boundary remains the exact observer failure', async () => {
  const damaged = structuredClone(recording);
  damaged.checkpoints[0][1] = '0000000000000000';
  const adapter = await createAdapter({ recording: damaged });
  const mismatch = new Error('Exact comparator found tick 300');
  await assert.rejects(
    adapter.observe({
      yieldTask: noWait,
      onTick({ tick }) {
        if (tick === 300) throw mismatch;
      },
    }),
    (error) => error === mismatch,
  );
});

test('tick diagnosis rejects stale content, unknown missions and nonstandard variants', async () => {
  assert.equal((await createAdapter({ recording })).maxTicks, SURVIVAL_DEMO_MAX_TICKS);
  await assert.rejects(
    createAdapter({ recording: { ...recording, contentIdentity: 'stale' } }),
    /identity or shape/,
  );
  await assert.rejects(
    createAdapter({ recording: { ...recording, simulationIdentity: 'stale' } }),
    /identity or shape/,
  );
  await assert.rejects(
    createAdapter({ recording: { ...recording, levelId: 'unregistered' } }),
    /authored standard mission/,
  );
  await assert.rejects(
    createAdapter({ recording, variantId: 'custom' }),
    /authored standard mission/,
  );
});
