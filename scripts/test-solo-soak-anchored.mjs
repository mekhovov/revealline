import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRun, stepRun, FIXED_DT } from '../game/core/index.mjs';
import { createRecorder, recordInput, exportReplay } from '../game/replay.mjs';
import { createSceneClock } from '../game/ui/scene-clock.mjs';
import { inspectQualificationReplayPortability } from './solo-qualification-replay.mjs';
import { validateQualification } from './solo-qualification.mjs';

const directory = new URL('../docs/performance/fixtures/solo-remote-sustained/', import.meta.url);
const originals = {},
  proposed = {};
const oldHashes = {
  soak: 'c5a3c197b828c92a4e737a681153692aa02ab86b24cc62bafc9d070f3fa2b39b',
  retry: '2e44c12bbe09f3f9cb27b25ee61e1a07659a77ecc5e8898c9e635b657a74606c',
  next: '869679e7a89bbd1a329ea3efd319aa8a4ffeaa1495715642a1447ab7a36dda40',
};
for (const kind of Object.keys(oldHashes)) {
  const bytes = await readFile(new URL(`${kind}.qualification.fixture`, directory));
  originals[kind] = { bytes, value: JSON.parse(bytes) };
  proposed[kind] = JSON.parse(
    await readFile(new URL(`${kind}-first-return-anchored.qualification.fixture`, directory)),
  );
}
const routeOf = (fixture, kind) =>
  kind === 'next'
    ? fixture.actions.slice(2, 4)
    : fixture.actions.find((action) => action.type === 'repeat').actions.slice(0, 2);
const route = routeOf(proposed.soak, 'soak');
const definition = proposed.soak.expectedReplayDefinition;
const phaserPackageURL = import.meta.resolve('phaser/package.json');
const phaserPackage = JSON.parse(await readFile(new URL(phaserPackageURL)));
// Exercise the pinned library's actual smoothing implementation without starting
// a browser, RAF loop or Phaser Game. This is a synthetic legacy-clock stress.
const { default: TimeStep } = await import(new URL('src/core/TimeStep.js', phaserPackageURL));

test('held First Return proposals preserve every other mission, transition, limit and original recipe', () => {
  for (const kind of Object.keys(oldHashes)) {
    assert.equal(createHash('sha256').update(originals[kind].bytes).digest('hex'), oldHashes[kind]);
    const fixture = proposed[kind];
    assert.doesNotThrow(() => validateQualification(fixture));
    assert.deepEqual(routeOf(fixture, kind), route);
    assert.equal(fixture.evidenceStorage, kind === 'soak' ? 'snapshot-chunks-v1' : undefined);
    const restored = structuredClone(fixture);
    delete restored.evidenceStorage;
    restored.id = originals[kind].value.id;
    restored.coverage.pop();
    const actions =
      kind === 'next'
        ? restored.actions
        : restored.actions.find((action) => action.type === 'repeat').actions;
    actions.splice(kind === 'next' ? 2 : 0, 2, ...routeOf(originals[kind].value, kind));
    assert.deepEqual(restored, originals[kind].value);
  }
  assert.deepEqual(route, [
    { type: 'key', key: 'ArrowUp', ms: 1000, label: 'first-return-anchor-top' },
    { type: 'key', key: 'ArrowDown', ms: 8000, label: 'first-return-close-at-bottom' },
  ]);
  const soak = proposed.soak.actions.find((action) => action.type === 'repeat');
  assert.equal(soak.atLeastMs, 1800000);
  assert.equal(soak.count, 360);
  assert.equal(proposed.soak.timeoutMs, 2400000);
  assert.equal(proposed.retry.actions.find((action) => action.type === 'repeat').count, 20);
  assert.equal(
    proposed.next.actions.filter((action) => action.selector === '#next-button').length,
    10,
  );
  assert.equal(phaserPackage.version, '4.2.1');
});

const rates = [30, 40, 45, 60, 90, 120, 144];
const modes = ['scene', 'legacy-warm', 'legacy-cold'];
const cases = [];
for (const hz of rates)
  for (const mode of modes)
    for (const startup of [0, 1000, 2000])
      for (const upOffset of [-200, 0, 200])
        for (const downOffset of [-200, 0, 200])
          for (const gap of [0, 200])
            for (const phase of [0, 0.5])
              cases.push({ hz, mode, startup, upOffset, downOffset, gap, phase });
for (const mode of modes)
  for (const startup of [0, 200, 500, 1000, 1500, 2000])
    for (const hitch of ['anchor', 'cut-entry', 'cut-middle'])
      for (const cadence of ['alternating', 'changing'])
        cases.push({
          mode,
          startup,
          hz: 30,
          cadence,
          hitch,
          gap: 200,
          upOffset: 200,
          downOffset: -200,
        });
for (let seed = 1; seed <= 100; seed++) {
  let state = seed;
  const next = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0);
  cases.push({
    seed,
    hz: rates[next() % rates.length],
    mode: modes[next() % modes.length],
    startup: next() % 2001,
    upOffset: (next() % 401) - 200,
    downOffset: (next() % 401) - 200,
    gap: next() % 201,
    phase: (next() % 1001) / 1000,
    cadence: next() % 2 ? 'changing' : 'alternating',
    hitch: ['anchor', 'cut-entry', 'cut-middle'][next() % 3],
  });
}
for (const hz of rates)
  for (const mode of modes)
    for (const startup of [0, 2000])
      cases.push({
        hz,
        mode,
        startup,
        firstCallbackDelay: 200,
        upOffset: -200,
        downOffset: -200,
        gap: 200,
      });

function simulate(variant, commands = route, verify = true) {
  const options = { ...definition.options, seed: 1 };
  const run = createRun(definition.level, options);
  const recorder = createRecorder(definition.level, options);
  const clock = createSceneClock();
  const smoothing = new TimeStep(null, { target: 60 });
  smoothing.deltaHistory = Array(smoothing.deltaSmoothingMax).fill(smoothing._target);
  smoothing._coolDown = variant.mode === 'legacy-cold' ? 120 : 0;
  const firstEnd = variant.startup + commands[0].ms + variant.upOffset;
  const secondStart = firstEnd + variant.gap;
  const end = secondStart + commands[1].ms + variant.downOffset;
  const events = [
    [variant.startup, commands[0].key.slice(5).toLowerCase()],
    [firstEnd, null],
    [secondStart, commands[1].key.slice(5).toLowerCase()],
    [end, null],
  ];
  const hitchAt =
    variant.hitch === 'anchor'
      ? variant.startup + 400
      : variant.hitch === 'cut-entry'
        ? secondStart
        : secondStart + 2000;
  let stamp = (variant.firstCallbackDelay ?? 0) + ((variant.phase ?? 0) * 1000) / variant.hz,
    previous = 0,
    debt = 0,
    cursor = 0,
    frame = 0,
    direction = null,
    hitched = false,
    sawAnchor = false,
    closures = 0,
    maximumTrail = 0;
  while (stamp <= end + 100 && !['won', 'lost'].includes(run.status)) {
    while (cursor < events.length && events[cursor][0] <= stamp + 1e-7)
      direction = events[cursor++][1];
    const sample = clock.sample(stamp, true);
    assert.equal(
      sample.interrupted,
      false,
      'Declared callback gaps must stay below the interruption boundary',
    );
    const elapsed =
      variant.mode === 'scene'
        ? sample.elapsedSeconds
        : smoothing.smoothDelta(stamp - previous) / 1000;
    debt += elapsed;
    while (debt + 1e-9 >= FIXED_DT && !['won', 'lost'].includes(run.status)) {
      const command = { direction };
      recordInput(recorder, command);
      stepRun(run, command, FIXED_DT);
      maximumTrail = Math.max(maximumTrail, run.trail.length);
      closures += run.events.filter((event) => event.type === 'cut.closed').length;
      debt -= FIXED_DT;
    }
    if (commands === route && stamp >= firstEnd && !sawAnchor) {
      // If both key edges fall before this callback, it may already submit the
      // first downward ticks. The invariant is the unchanged departure column.
      assert.equal(run.player.x, definition.level.spawn.x);
      sawAnchor = true;
    }
    previous = stamp;
    const hz =
      variant.cadence === 'alternating'
        ? frame % 2
          ? 144
          : 30
        : variant.cadence === 'changing'
          ? rates[Math.floor(frame / 20) % rates.length]
          : variant.hz;
    let delta = 1000 / hz;
    if (variant.hitch && !hitched && stamp + delta >= hitchAt) {
      delta += 200;
      hitched = true;
    }
    stamp += delta;
    frame++;
  }
  if (!verify) return { run, closures, maximumTrail };
  const label = JSON.stringify(variant);
  assert.equal(run.status, 'won', label);
  assert.equal(run.lives, 3, label);
  assert.equal(run.player.x, definition.level.spawn.x, label);
  assert.equal(Math.floor(run.player.y), definition.level.height - 1, label);
  assert.equal(closures, 1, label);
  assert.equal(maximumTrail, 34, label);
  assert.equal(run.claimedCount, 816, label);
  const result = inspectQualificationReplayPortability(
    exportReplay(recorder, run),
    { closures: 1, maximumTrailCells: 34, maximumClaimedCells: 816 },
    definition,
  );
  assert.equal(result.match, true, label);
  assert.equal(result.status, 'pass', label);
  return result;
}

test('all declared callback, startup and ±200ms variations win through a strict unchanged model replay', () => {
  assert.equal(cases.length, 2518);
  for (const variant of cases) simulate(variant);
});

test('the model retains an original undertravel failure instead of treating neutral waiting as closure', () => {
  const original = routeOf(originals.soak.value, 'soak');
  const observed = simulate(
    {
      hz: 30,
      mode: 'legacy-cold',
      startup: 0,
      upOffset: 0,
      downOffset: 0,
      gap: 0,
    },
    original,
    false,
  );
  assert.equal(observed.run.status, 'running');
  assert.equal(observed.closures, 0);
  assert(observed.maximumTrail >= 20 && observed.maximumTrail < 35);
});
