// Pure scheduling/core controls. No browser, native pixels, or timing verdict.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRun, stepRun, FIXED_DT, releaseInputs } from '../game/core/index.mjs';
import {
  createRecorder,
  recordInput,
  recordRelease,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../game/replay.mjs';
import { createSceneClock } from '../game/ui/scene-clock.mjs';
import { validateQualification } from './solo-qualification.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root));
const directory = 'docs/performance/fixtures/solo-remote-timing/';
const original = JSON.parse(await read(directory + 'sentry.qualification.fixture'));
const proposed = JSON.parse(await read(directory + 'sentry-wall-anchor.qualification.fixture'));
const originalReplayBytes = await read(directory + 'sentry-original-native-failure.replay.fixture');
const originalReplay = JSON.parse(originalReplayBytes);
const route = proposed.actions.filter((action) => action.type === 'key');
const definition = proposed.expectedReplayDefinition;
const { default: TimeStep } = await import(
  new URL('src/core/TimeStep.js', import.meta.resolve('phaser/package.json'))
);

test('held Sentry route preserves mission, mechanics gates and every non-key action', async () => {
  validateQualification(proposed);
  const expected = structuredClone(original);
  expected.id = 'sentry-wall-anchor-capture-projectile-v3';
  expected.actions.splice(
    8,
    11,
    { type: 'key', key: 'ArrowRight', ms: 1700 },
    { type: 'key', key: 'ArrowUp', ms: 4500 },
    { type: 'key', key: 'ArrowRight', ms: 1000 },
    { type: 'key', key: 'ArrowDown', ms: 5000 },
  );
  assert.deepEqual(proposed, expected);
  assert.deepEqual(proposed.replayRequirements, { closures: 1, shots: 1, projectileTicks: 1 });
  assert.equal(definition.level.id, 'sentry-detour');
  assert.deepEqual(definition.options, { classId: 'scout', turnPolicy: 'grid-center' });
  assert.equal(proposed.timeoutMs, 240000);
  assert.equal(
    route.reduce((total, a) => total + a.ms, 0),
    12200,
  );
  assert.equal(
    original.actions.filter((a) => a.type === 'key').reduce((n, a) => n + a.ms, 0),
    22000,
  );
  for (const [path, expectedHash] of [
    [
      directory + 'sentry.qualification.fixture',
      '86cc1eea19e1d229dae865b368a94238de900ad83be5d9a4ee469b2e4dc3c0fd',
    ],
    [
      directory + 'sentry-detour.xonix.fixture',
      'caad15d6f4770bc5e48935db1655e2892cfb5bd9093a72d0d7795125e8d2d3fa',
    ],
    [
      'docs/performance/solo-final-timing-sentry-v2-plan.json',
      'dda7bf1a91fc981eb44b4eabf228059316069781f49b800c5001bb3d40d80e8a',
    ],
    [
      '.github/workflows/solo-remote-final-timing-sentry-v2-temporary.yml',
      '7eafb28768c05c81aba2dc7529ce778df171f14adcd847d7c77dcd8349e63b8f',
    ],
  ])
    assert.equal(
      createHash('sha256')
        .update(await read(path))
        .digest('hex'),
      expectedHash,
      path,
    );
  const phaser = JSON.parse(await readFile(new URL(import.meta.resolve('phaser/package.json'))));
  assert.equal(phaser.version, '4.2.1', 'The historical smoothing control is explicitly pinned');
});

test('retained native failure strictly replays capture closures that consume the following Up gestures', () => {
  assert.equal(originalReplayBytes.length, 9773);
  assert.equal(
    createHash('sha256').update(originalReplayBytes).digest('hex'),
    '82f11ed77a2f322811da59e6d55ff60c6081fc1aa21819e8d033a9d5673cda10',
  );
  assert.equal(verifyReplay(originalReplay).match, true);
  const run = createRun(originalReplay.level, originalReplay.options),
    closures = [];
  let shots = 0,
    projectileTicks = 0;
  for (const [index, segment] of originalReplay.segments.entries()) {
    if (segment.releaseBefore) releaseInputs(run);
    for (let tick = 0; tick < segment.ticks; tick++) {
      stepRun(run, segment.input, FIXED_DT);
      if (run.classic.combatPatrols.projectiles.length) projectileTicks++;
      for (const event of run.events) {
        if (event.type === 'combat.fired') shots++;
        if (event.type === 'capture.stopped')
          closures.push({ tick: run.tick, index, direction: segment.input.direction });
      }
    }
  }
  if (originalReplay.releaseAfter) releaseInputs(run);
  assert.equal(authoritativeCheckpoint(run).hash, 'a925e43d27d5058b');
  assert.deepEqual(closures, [
    { tick: 246, index: 2, direction: 'up' },
    { tick: 1417, index: 9, direction: 'up' },
  ]);
  assert.deepEqual(
    originalReplay.segments
      .filter((_, i) => [2, 3, 9, 10].includes(i))
      .map((s) => [s.input.direction, s.ticks]),
    [
      ['up', 1],
      [null, 21],
      ['up', 2],
      [null, 426],
    ],
  );
  assert.equal(shots, 0);
  assert.equal(projectileTicks, 0);
});

// Apply native key transitions at callbacks, then use the real scene clock and
// fixed simulation. Capture/respawn clears held input as the app does; the test
// never silently represses a key to continue the intended route after capture.
function simulate({
  mode = 'scene',
  hz = 60,
  start = 0,
  offsets = [0, 0, 0, 0],
  gap = 0,
  changing = false,
  replay = false,
  log = false,
} = {}) {
  const run = createRun(definition.level, { ...definition.options, seed: 1 });
  const recorder = replay
    ? createRecorder(definition.level, { ...definition.options, seed: 1 })
    : null;
  const clock = createSceneClock();
  const smooth = new TimeStep(null, { target: 60 });
  smooth.deltaHistory = Array(smooth.deltaSmoothingMax).fill(smooth._target);
  smooth._coolDown = mode === 'legacy-cold' ? 120 : 0;
  let time = start;
  const transitions = [];
  for (const [index, action] of route.entries()) {
    transitions.push([time, action.key.slice(5).toLowerCase()]);
    time += action.ms + offsets[index];
    transitions.push([time, null]);
    time += gap;
  }
  const end = time + 50;
  let stamp = 0,
    previous = 0,
    debt = 0,
    cursor = 0,
    held = null,
    frames = 0;
  const actual = {
    locks: 0,
    shots: 0,
    closures: 0,
    projectileTicks: 0,
    captureDuringHold: [],
    replay: null,
  };
  while (stamp <= end && !['won', 'lost'].includes(run.status)) {
    while (cursor < transitions.length && transitions[cursor][0] <= stamp + 1e-7)
      held = transitions[cursor++][1];
    const sample = clock.sample(stamp, true);
    assert.equal(sample.interrupted, false);
    debt += mode === 'scene' ? sample.elapsedSeconds : smooth.smoothDelta(stamp - previous) / 1000;
    while (debt + 1e-9 >= FIXED_DT && !['won', 'lost'].includes(run.status)) {
      if (recorder) recordInput(recorder, { direction: held });
      stepRun(run, { direction: held }, FIXED_DT);
      debt -= FIXED_DT;
      if (run.classic.combatPatrols.projectiles.length) actual.projectileTicks++;
      for (const event of run.events) {
        if (event.type === 'combat.locked') actual.locks++;
        if (event.type === 'combat.fired') actual.shots++;
        if (event.type === 'cut.closed') actual.closures++;
        if (log && event.type === 'capture.stopped')
          actual.captureDuringHold.push({ direction: held, tick: run.tick });
      }
      if (
        run.status === 'respawning' ||
        run.events.some((event) => event.type === 'capture.stopped')
      )
        held = null;
    }
    previous = stamp;
    frames++;
    stamp += 1000 / (changing ? [30, 40, 45, 60, 90, 120, 144][Math.floor(frames / 30) % 7] : hz);
  }
  assert.equal(run.status, 'running');
  assert.equal(run.lives, 3);
  if (recorder) {
    releaseInputs(run);
    recordRelease(recorder);
    const recording = exportReplay(recorder, run),
      verified = verifyReplay(recording);
    assert.equal(verified.match, true);
    assert.equal(recording.checkpoint.hash, authoritativeCheckpoint(run).hash);
    assert.deepEqual(recording.level, originalReplay.level);
    actual.replay = { ticks: recording.ticks, hash: recording.checkpoint.hash };
  }
  return actual;
}
function requireMechanics(actual) {
  assert.equal(actual.locks, 1);
  assert.equal(actual.shots, 1);
  assert.equal(actual.closures, 2);
  assert(actual.projectileTicks >= 1);
}

test('new route closes within its long holds and strictly reproduces the earned replay', () => {
  const actual = simulate({ replay: true, log: true });
  requireMechanics(actual);
  assert.deepEqual(actual.captureDuringHold, [
    { direction: 'up', tick: 388 },
    { direction: 'down', tick: 1162 },
  ]);
  assert.equal(actual.replay.hash, '6addda0baf109993');
});

test('independent ±200ms hold corners preserve sentry exposure across native and historical clocks', () => {
  let total = 0,
    strict = 0;
  for (const mode of ['scene', 'legacy-cold', 'legacy-warm'])
    for (const hz of mode === 'scene' ? [30, 40, 45, 60, 90, 120, 144] : [30, 144])
      for (const start of [0, 200])
        for (const a of [-200, 0, 200])
          for (const b of [-200, 0, 200])
            for (const c of [-200, 0, 200])
              for (const d of [-200, 0, 200]) {
                const replay = total % 113 === 0;
                const actual = simulate({
                  mode,
                  hz,
                  start,
                  offsets: [a, b, c, d],
                  gap: 200,
                  replay,
                });
                requireMechanics(actual);
                if (actual.replay) strict++;
                total++;
              }
  assert.equal(total, 1782);
  assert.equal(strict, 16);
});

test('changing cadence and independently delayed key transitions preserve the same mechanics', () => {
  let seed = 1;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  for (let index = 0; index < 90; index++)
    requireMechanics(
      simulate({
        mode: ['scene', 'legacy-cold', 'legacy-warm'][index % 3],
        hz: [30, 40, 45, 60, 90, 120, 144][index % 7],
        changing: true,
        start: random() * 200,
        gap: random() * 200,
        offsets: route.map(() => Math.floor(random() * 401) - 200),
        replay: index % 30 === 0,
      }),
    );
});
