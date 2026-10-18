import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createAdapter } from './demo-tick-adapters/sim.mjs';
import { captureDemoTickTrace, compareDemoTickTrace } from './demo-tick-trace.mjs';
import { simDemoInventory } from '../optional-practice/civilian-fpv/demo-inventory.mjs';
import { decodeSimDemoPayload } from '../optional-practice/civilian-fpv/demo-payload.mjs';
import { createFlight } from '../optional-practice/civilian-fpv/model.mjs';
import {
  createWorldFlight,
  initWorldRuntime,
  worldStateIdentity,
} from '../optional-practice/civilian-fpv/world-model.mjs';
import { dataIdentity } from '../game/data-json.mjs';

const index = JSON.parse(
  await readFile(
    new URL('../optional-practice/civilian-fpv/demo-data/index.json', import.meta.url),
  ),
).entries;
const inventory = simDemoInventory();
const yieldTask = async () => {};
const runtime = { engine: 'node', version: process.version, implementation: 'native-sim-replay' };
const load = async (row) =>
  JSON.parse(
    await readFile(
      new URL(`../optional-practice/civilian-fpv/demo-data/${row.file}`, import.meta.url),
    ),
  );
const shortest = (model, mode) =>
  index
    .filter((row) => row.proof.model === model && row.variantId === mode)
    .sort((a, b) => a.frames - b.frames)[0];

for (const model of [
  'civilian-quad-fixed.v1',
  'civilian-world-fixed.v2',
  'civilian-world-hunt.v1',
  'civilian-world-pursuit.v1',
  'civilian-world-pursuit.v2',
]) {
  for (const mode of ['self-level', 'acro']) {
    test(`SIM emits each native tick for ${model} / ${mode}`, async () => {
      const row = shortest(model, mode);
      const recording = await load(row);
      const adapter = await createAdapter({ recording });
      const entry = inventory.find(
        (item) => item.levelId === row.levelId && item.variantId === mode,
      ).entry;
      const proof = decodeSimDemoPayload(recording);
      if (!entry.legacy) await initWorldRuntime();
      const flight = (entry.legacy ? createFlight : createWorldFlight)({
        course: entry.course,
        mode,
        response: proof.response,
      });
      const stateIdentity = (state) =>
        entry.legacy ? dataIdentity(state) : worldStateIdentity(state);
      const oracle = [];
      try {
        flight.arm();
        oracle.push(stateIdentity(flight.snapshot()));
        for (const frame of proof.frames)
          oracle.push(
            stateIdentity(
              flight.step(
                Object.fromEntries(
                  frame.map((value, axis) => [
                    ['roll', 'pitch', 'yaw', 'throttle', 'actions'][axis],
                    value,
                  ]),
                ),
                { quantized: true },
              ),
            ),
          );
      } finally {
        flight.dispose?.();
      }
      const observed = [];
      let pending = false;
      const terminal = await adapter.observe({
        yieldTask,
        async onTick(event) {
          assert.equal(pending, false, 'native tick observation must be awaited');
          pending = true;
          await Promise.resolve();
          assert.equal(event.tick, observed.length);
          observed.push(event.stateIdentity);
          pending = false;
        },
      });
      assert.deepEqual(observed, oracle);
      assert.equal(observed.length, row.frames + 1);
      assert.deepEqual(terminal, await adapter.verify({ yieldTask }));
      assert.equal(terminal.terminalIdentity, observed.at(-1));
    });
  }
}

test('SIM capture and comparison pin the full recording, authored course and flight mode', async () => {
  const row = shortest('civilian-world-fixed.v2', 'self-level');
  const recording = await load(row);
  const adapter = await createAdapter({ recording });
  const reference = await captureDemoTickTrace(adapter, { runtime, yieldTask });
  const result = await compareDemoTickTrace(adapter, reference, { runtime, yieldTask });
  assert.equal(result.match, true);
  assert.equal(result.nativeVerification.passed, true);
  assert.equal(result.lastMatchingTick, row.frames);
  assert.equal(result.firstDivergentTick, null);
  await assert.rejects(createAdapter({ recording, variantId: 'acro' }), /flight mode/);
  const entry = structuredClone(
    inventory.find((item) => item.levelId === row.levelId && item.variantId === row.variantId)
      .entry,
  );
  entry.course.id = 'different-authored-course';
  await assert.rejects(createAdapter({ recording, entry }), /exact authored course/);
  const different = structuredClone(recording);
  different.checkpoints[0].stateIdentity = '0000000000000000';
  const candidate = await createAdapter({ recording: different });
  assert.notEqual(candidate.binding.recordingIdentity, adapter.binding.recordingIdentity);
  await assert.rejects(compareDemoTickTrace(candidate, reference), /different recording/);
});

test('SIM failed native verification cannot create a trusted reference but stays observable', async () => {
  const recording = await load(shortest('civilian-world-fixed.v2', 'self-level'));
  recording.proof.finalStateIdentity = '0000000000000000';
  const adapter = await createAdapter({ recording });
  await assert.rejects(adapter.verify({ yieldTask }), { code: 'demo-content-mismatch' });
  await assert.rejects(captureDemoTickTrace(adapter, { runtime, yieldTask }), {
    code: 'demo-content-mismatch',
  });
  let count = 0;
  const observed = await adapter.observe({
    yieldTask,
    onTick() {
      count++;
    },
  });
  assert.equal(observed.outcome, 'complete');
  assert.equal(count, observed.terminalTick + 1);
  assert.notEqual(observed.terminalIdentity, recording.proof.finalStateIdentity);
});

test('SIM abort and observer failure release their physics world before a fresh successful replay', async () => {
  const adapter = await createAdapter({
    recording: await load(shortest('civilian-world-fixed.v2', 'self-level')),
  });
  const controller = new AbortController();
  const ticks = [];
  await assert.rejects(
    adapter.observe({
      signal: controller.signal,
      yieldTask,
      async onTick({ tick }) {
        ticks.push(tick);
        await Promise.resolve();
        if (tick === 5) controller.abort();
      },
    }),
    { name: 'AbortError' },
  );
  assert.deepEqual(ticks, [0, 1, 2, 3, 4, 5]);
  await assert.rejects(
    adapter.observe({
      yieldTask,
      onTick() {
        throw new Error('consumer stopped');
      },
    }),
    /consumer stopped/,
  );
  const packet = await captureDemoTickTrace(adapter, { runtime, yieldTask });
  assert.equal(packet.trace.hashes.length, packet.trace.verification.terminalTick + 1);
});
