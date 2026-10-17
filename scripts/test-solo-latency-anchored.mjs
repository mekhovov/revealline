import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRun, stepRun, FIXED_DT } from '../game/core/index.mjs';
import { createRecorder, recordInput, exportReplay } from '../game/replay.mjs';
import { inspectQualificationReplayPortability } from './solo-qualification-replay.mjs';
import { validateQualification } from './solo-qualification.mjs';

const directory = new URL('../docs/performance/fixtures/', import.meta.url);
const originalBytes = await readFile(
  new URL('solo-remote-timing/long-rail.qualification.fixture', directory),
);
const previousBytes = await readFile(
  new URL('solo-latency-supplement/long-rail.qualification.fixture', directory),
);
const original = JSON.parse(originalBytes);
const previous = JSON.parse(previousBytes);
const fixture = JSON.parse(
  await readFile(
    new URL('solo-latency-supplement/long-rail-anchored.qualification.fixture', directory),
  ),
);
const timed = fixture.actions.filter(
  (action) => action.type === 'key' || (action.type === 'wait' && action.ms),
);

test('anchored route retains mission, requirements and earlier failed recipes unchanged', () => {
  assert.equal(
    createHash('sha256').update(originalBytes).digest('hex'),
    'b9afaecaadcbd0f657dd8064b9f7932c0c7ec12d6433f7d2b76f60de7ef19528',
  );
  assert.equal(
    createHash('sha256').update(previousBytes).digest('hex'),
    '6815653eadf5a4e05435be5e87bc933ba5e17b7d10fb51032988c274dd651802',
  );
  assert.doesNotThrow(() => validateQualification(fixture));
  assert.deepEqual(fixture.expectedReplayDefinition, original.expectedReplayDefinition);
  assert.deepEqual(fixture.replayRequirements, previous.replayRequirements);
  assert.deepEqual(fixture.actions.slice(0, 8), original.actions.slice(0, 8));
  assert.deepEqual(fixture.actions.slice(-5), original.actions.slice(-5));
  assert.equal(fixture.timeoutMs, 240000);
  assert.equal(timed.length, 29);
  assert.equal(timed.filter((action) => /^anchored-steering-\d+$/.test(action.label)).length, 22);
  assert.equal(
    timed.reduce((sum, action) => sum + action.ms, 0),
    27200,
  );
  assert(timed.every((action) => action.ms >= 200));
  assert(
    timed.every(
      (action) => action.type !== 'key' || /^Arrow(Up|Right|Down|Left)$/.test(action.key),
    ),
  );
});

// Finite sensitivity evidence, not browser evidence or a universal scheduler
// tolerance. Unlike the earlier model, this varies every route/setup hold,
// initial neutral admission, neutral inter-action gaps, and combined jitter.
const variants = [{ name: 'nominal', offset: () => 0, gap: () => 0 }];
for (const value of [-12, -6, -3, 3, 6, 12]) {
  variants.push(
    { name: `all holds ${value} ticks`, offset: () => value, gap: () => 0 },
    {
      name: `alternating holds ${value} ticks`,
      offset: (index) => (index % 2 ? value : -value),
      gap: () => 0,
    },
  );
  for (let target = 0; target < timed.length; target++)
    variants.push({
      name: `hold ${target} ${value} ticks`,
      offset: (index) => (index === target ? value : 0),
      gap: () => 0,
    });
}
for (const gap of [1, 3, 6, 12, 24])
  variants.push({ name: `every gap ${gap} ticks`, offset: () => 0, gap: () => gap });
for (let admission = -120; admission <= 120; admission += 12)
  variants.push({
    name: `admission ${admission} ticks`,
    offset: (index) => (index === 0 ? admission : 0),
    gap: () => 0,
  });
for (let seed = 1; seed <= 100; seed++) {
  let state = seed;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
  const offsets = timed.map(() => (next() % 25) - 12);
  const gaps = timed.map(() => next() % 13);
  variants.push({
    name: `combined jitter seed ${seed}`,
    offset: (index) => offsets[index],
    gap: (index) => gaps[index],
  });
}

test('all 313 declared timing variations retain three lives, meaningful steering and strict model replay', () => {
  assert.equal(variants.length, 313);
  for (const variant of variants) {
    const definition = fixture.expectedReplayDefinition;
    const options = { ...definition.options, seed: 1 };
    const run = createRun(definition.level, options);
    const recorder = createRecorder(definition.level, options);
    const advance = (direction, ticks) => {
      for (let tick = 0; tick < ticks; tick++) {
        assert.equal(run.status, 'running', variant.name);
        assert.equal(run.lives, 3, variant.name);
        recordInput(recorder, { direction });
        stepRun(run, { direction }, FIXED_DT);
      }
    };
    for (let index = 0; index < timed.length; index++) {
      const action = timed[index];
      const direction = action.type === 'key' ? action.key.slice(5).toLowerCase() : null;
      advance(direction, Math.round((action.ms * 120) / 1000) + variant.offset(index));
      if (action.label === 'anchored-anchor-top') assert.equal(run.player.y, 0.5, variant.name);
      if (action.label === 'anchored-anchor-right') assert.equal(run.player.x, 71.5, variant.name);
      if (action.label === 'anchored-anchor-bottom') assert.equal(run.player.y, 35.5, variant.name);
      if (action.label.startsWith('anchored-steering-')) {
        assert.equal(run.trail.length, 0, variant.name);
        assert.equal(run.player.cutting, false, variant.name);
      }
      advance(null, variant.gap(index));
    }
    assert.equal(run.status, 'running', variant.name);
    assert.equal(run.lives, 3, variant.name);
    const verified = inspectQualificationReplayPortability(
      exportReplay(recorder, run),
      fixture.replayRequirements,
      definition,
    );
    assert.equal(verified.match, true, variant.name);
    assert.equal(verified.status, 'pass', variant.name);
    assert(
      verified.checks.every((check) => check.pass),
      variant.name,
    );
    assert(verified.features.directionChangesWithMovement >= 20, variant.name);
  }
});
