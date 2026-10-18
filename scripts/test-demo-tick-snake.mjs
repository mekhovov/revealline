import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createAdapter } from './demo-tick-adapters/snake.mjs';
import {
  captureDemoTickTrace,
  compareDemoTickTrace,
  demoTickSHA256,
  DEMO_TICK_LIMIT,
} from './demo-tick-trace.mjs';
import { CLASSIC_SNAKE_LEVELS } from '../game/snake/classic-catalogue.mjs';
import { prepareClassicSnakeLevel } from '../game/snake/classic-setup.mjs';
import { exportClassicSnakeReplay } from '../game/snake/classic-core.mjs';
import { restoreClassicSnakeMatch } from '../game/snake/classic-match.mjs';

const load = async (id = 'classic-snake-open-loop') =>
  JSON.parse(await readFile(new URL(`../game/demo-data/snake/${id}.replay.json`, import.meta.url)));
const yieldTask = async () => {};
const runtime = { engine: 'node', version: process.version, implementation: 'native-snake-match' };

for (const id of [
  'classic-snake-open-loop',
  'classic-pursuit-oval-intercept',
  'classic-living-refuge-bays',
  'classic-field-signal-check',
  'classic-operation-first-dispatch',
  'classic-operation-pressure-elbow',
]) {
  test(`Snake exact observations match every native replay checkpoint: ${id}`, async () => {
    const recording = await load(id);
    const entry = CLASSIC_SNAKE_LEVELS.find((row) => row.id === id);
    const oracle = [];
    const observe = (run) =>
      oracle.push({ tick: run.tick, stateIdentity: exportClassicSnakeReplay(run).checkpoint });
    restoreClassicSnakeMatch(recording.recording, {
      level: prepareClassicSnakeLevel(entry),
      onStart: (match) => observe(match.runs[0]),
      onStep: ({ run }) => observe(run),
    });
    const adapter = await createAdapter({ recording });
    const rows = [];
    let pending = false;
    const actual = await adapter.observe({
      yieldTask,
      async onTick(row) {
        assert.equal(pending, false, 'one awaited observer owns each native event');
        pending = true;
        await Promise.resolve();
        rows.push(row);
        pending = false;
      },
    });
    assert.deepEqual(rows, oracle);
    assert.equal(rows.length, actual.terminalTick + 1);
    assert.deepEqual(actual, await adapter.verify({ yieldTask }));
    assert.equal(actual.terminalIdentity, recording.recording.replays[0].checkpoint);
  });
}

test('Snake reference capture and exact comparison use canonical recording identity', async () => {
  const recording = await load();
  const adapter = await createAdapter({ recording });
  const reference = await captureDemoTickTrace(adapter, { runtime, yieldTask });
  const reordered = Object.fromEntries(Object.entries(recording).reverse());
  const candidate = await createAdapter({ recording: reordered });
  assert.equal(candidate.binding.recordingIdentity, await demoTickSHA256(recording));
  assert.deepEqual(candidate.binding, adapter.binding);
  const result = await compareDemoTickTrace(candidate, reference, { runtime, yieldTask });
  assert.equal(result.match, true);
  assert.equal(result.firstDivergentTick, null);
  assert.equal(result.lastMatchingTick, recording.recording.replays[0].steps);
  assert.equal(result.nativeVerification.passed, true);
});

test('Snake observation supports diagnostics without granting failed replay admission', async () => {
  const recording = await load();
  recording.diagnostics[0].checkpoint = '0000000000000000';
  const adapter = await createAdapter({ recording });
  await assert.rejects(adapter.verify({ yieldTask }), /first mismatching checkpoint/);
  await assert.rejects(captureDemoTickTrace(adapter, { runtime, yieldTask }), {
    name: 'ReplayVerificationError',
  });
  let count = 0;
  const observed = await adapter.observe({ onTick: () => count++, yieldTask });
  assert.equal(count, observed.terminalTick + 1);
  assert.equal(observed.terminalIdentity, recording.recording.replays[0].checkpoint);
});

test('Snake diagnostics reject changed content, unsupported variants and rejected native inputs', async () => {
  const recording = await load();
  const entry = structuredClone(CLASSIC_SNAKE_LEVELS.find((row) => row.id === recording.levelId));
  entry.level.goal++;
  const changed = await createAdapter({ recording, entry });
  assert.notEqual(changed.binding.contentIdentity, recording.levelIdentity);
  await assert.rejects(changed.verify({ yieldTask }));
  await assert.rejects(createAdapter({ recording, variantId: 'custom' }), /standard/);
  const badInput = structuredClone(recording);
  badInput.recording.turns[0].direction = 'left';
  const adapter = await createAdapter({ recording: badInput });
  await assert.rejects(adapter.verify({ yieldTask }), /rejected/);
  await assert.rejects(adapter.observe({ onTick() {}, yieldTask }), /rejected native input/);
});

test('Snake diagnostic cancellation stops before the next native event or callback', async () => {
  const adapter = await createAdapter({ recording: await load() });
  const cancelled = new AbortController();
  cancelled.abort();
  await assert.rejects(adapter.verify({ signal: cancelled.signal, yieldTask }), {
    name: 'AbortError',
  });
  await assert.rejects(
    adapter.observe({ signal: cancelled.signal, yieldTask, onTick: () => assert.fail() }),
    { name: 'AbortError' },
  );
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
});

test('Snake observation cap permits extra native ticks beyond the recorded terminal declaration', async () => {
  const recording = await load();
  const expected = recording.recording.replays[0].steps;
  recording.recording.replays[0].steps--;
  const entry = CLASSIC_SNAKE_LEVELS.find((row) => row.id === recording.levelId);
  const adapter = await createAdapter({ recording, entry: { entry } });
  assert.equal(adapter.maxTicks, DEMO_TICK_LIMIT);
  await assert.rejects(adapter.verify({ yieldTask }));
  const ticks = [];
  const actual = await adapter.observe({ onTick: ({ tick }) => ticks.push(tick), yieldTask });
  assert.equal(actual.terminalTick, expected);
  assert.equal(ticks.at(-1), expected);
  assert.equal(ticks.length, expected + 1);
});
