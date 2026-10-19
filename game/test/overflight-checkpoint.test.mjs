import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createOverflightRun,
  startOverflight,
  stepOverflight,
  pauseOverflight,
  resumeOverflight,
  chooseOverflightUpgrade,
  rerollOverflightUpgrades,
} from '../overflight/core.mjs';
import { createOverflightProject, compileOverflightProject } from '../overflight/project.mjs';
import {
  encodeOverflightCheckpoint,
  decodeOverflightCheckpoint,
} from '../overflight/checkpoint.mjs';
import { pilot, selectCard } from '../overflight/review-pilot.mjs';
import { assessmentDigest } from './helpers/survival-roundtrip.mjs';

// Package admission has its own production-fetch tests. These codec cases inject
// a declared package identity; these tokens do not certify a real release.
const packageIdentity = {
  manifestSha256: 'a'.repeat(64),
  runtimeSha256: 'b'.repeat(64),
  sourceRevision: 'c'.repeat(40),
};
const attemptId = '12345678-1234-4123-8123-123456789abc';
function setup(options = {}, settings = {}) {
  const project = createOverflightProject(options);
  const run = createOverflightRun(compileOverflightProject(project), settings);
  startOverflight(run);
  return { project, run };
}
function checkpoint(run, project) {
  pauseOverflight(run);
  const encoded = encodeOverflightCheckpoint({ run, project, packageIdentity, attemptId });
  const decoded = decodeOverflightCheckpoint(encoded, { packageIdentity });
  assert.equal(decoded.attemptId, attemptId);
  assert.equal(decoded.run.phase, 'paused');
  assert.deepEqual(decoded.run, run);
  assert.equal(assessmentDigest(decoded.run), assessmentDigest(run));
  assert.equal(decoded.run._grid.records, decoded.run.enemies);
  assert.notEqual(decoded.run.enemies, run.enemies);
  return { ...decoded, encoded };
}
function advance(run, ticks) {
  for (let i = 0; i < ticks && ['playing', 'upgrade'].includes(run.phase); i++) {
    if (run.phase === 'upgrade')
      chooseOverflightUpgrade(run, (selectCard(run, 'fan') ?? run.offers[0]).id);
    else stepOverflight(run, pilot(run));
  }
}
for (const options of [
  { legacy: true, seed: 7 },
  { rulesVersion: 2, seed: 42 },
  { rulesVersion: 3, seed: 7, world: 'field-crossing' },
  { rulesVersion: 4, seed: 7, world: 'freight-depot', difficulty: 'relaxed' },
]) {
  test(`production checkpoint preserves the complete paused state ${JSON.stringify(options)}`, () => {
    const { run, project } = setup(options, { airframes: 3 });
    advance(run, 600);
    const restored = checkpoint(run, project).run;
    resumeOverflight(run);
    resumeOverflight(restored);
    for (let i = 0; i < 90; i++) {
      const input = pilot(run),
        restoredInput = pilot(restored);
      assert.deepEqual(restoredInput, input);
      stepOverflight(run, input);
      stepOverflight(restored, restoredInput);
    }
    assert.equal(assessmentDigest(restored), assessmentDigest(run));
    assert.deepEqual(restored, run);
  });
}
test('pending offers and reroll history restore without redrafting', () => {
  const { run, project } = setup(
    { rulesVersion: 4, seed: 7, world: 'field-crossing', difficulty: 'relaxed' },
    { airframes: 3 },
  );
  while (run.phase === 'playing') stepOverflight(run, pilot(run));
  assert.equal(run.phase, 'upgrade');
  assert.equal(rerollOverflightUpgrades(run), true);
  const restored = checkpoint(run, project).run;
  resumeOverflight(run);
  resumeOverflight(restored);
  const id = run.offers[0].id;
  assert.equal(chooseOverflightUpgrade(run, id), true);
  assert.equal(chooseOverflightUpgrade(restored, id), true);
  assert.deepEqual(restored, run);
});

test('all V4 worlds retain late-run movement, terrain, rewards and inactive pool state', () => {
  for (const world of [
    'field-crossing',
    'freight-depot',
    'relay-ruins',
    'river-port',
    'chalk-quarry',
    'orchard-strongpoint',
  ]) {
    const { run, project } = setup(
      { rulesVersion: 4, world, seed: 7, difficulty: 'relaxed' },
      { airframes: 3, characterId: 'carrier', flightTraits: true },
    );
    advance(run, 12000);
    assert.ok(['playing', 'upgrade'].includes(run.phase), `${world}: ${run.phase}`);
    const restored = checkpoint(run, project).run;
    resumeOverflight(run);
    resumeOverflight(restored);
    advance(run, 90);
    advance(restored, 90);
    assert.equal(assessmentDigest(restored), assessmentDigest(run), world);
  }
});

test('a legal completed flight can round-trip only for durable result recovery', () => {
  const { run, project } = setup(
    { rulesVersion: 4, world: 'field-crossing', seed: 7, difficulty: 'relaxed' },
    { airframes: 3 },
  );
  advance(run, 24000);
  assert.equal(run.phase, 'won');
  const text = encodeOverflightCheckpoint({ run, project, packageIdentity, attemptId });
  assert.throws(() => decodeOverflightCheckpoint(text, { packageIdentity }), /cannot resume/);
  const result = decodeOverflightCheckpoint(text, { packageIdentity, terminal: true });
  assert.equal(assessmentDigest(result.run), assessmentDigest(run));
});

test('untrusted checkpoint rejection does not mutate the active run', () => {
  const { run, project } = setup();
  advance(run, 60);
  const { encoded } = checkpoint(run, project);
  const digest = assessmentDigest(run);
  const value = JSON.parse(encoded);
  const mutate = (change) => {
    const source = structuredClone(value);
    change(source);
    assert.throws(() => decodeOverflightCheckpoint(source, { packageIdentity }));
    assert.equal(assessmentDigest(run), digest);
  };
  mutate((v) => {
    v.format = 'OverflightCheckpointV2';
  });
  mutate((v) => {
    v.packageIdentity.manifestSha256 = 'd'.repeat(64);
  });
  mutate((v) => {
    v.settings.airframes = 2;
  });
  mutate((v) => {
    v.project.seed++;
  });
  mutate((v) => {
    v.graph.nodes[0][1].push(['surprise', 1]);
  });
  mutate((v) => {
    v.graph.nodes[0][1].push(['__proto__', ['r', 0]]);
  });
  mutate((v) => {
    v.graph.nodes[0][1].find(([key]) => key === 'time')[1] = 123;
  });
  mutate((v) => {
    v.graph.nodes.find(([type]) => type === 'player')[1].find(([key]) => key === 'hull')[1] = null;
  });
  mutate((v) => {
    v.graph.nodes.find(([type]) => type === 'int32')[1][0] = 999999;
  });
  mutate((v) => {
    v.graph.nodes.push([
      'point',
      [
        ['x', 0],
        ['y', 0],
      ],
    ]);
  });
  mutate((v) => {
    v.graph.nodes.find(([type]) => type === 'enemies')[1][1] = v.graph.nodes.find(
      ([type]) => type === 'enemies',
    )[1][0];
  });
});

test('writer refuses mismatched handling settings instead of silently rebinding the active craft', () => {
  const { run, project } = setup(
    { rulesVersion: 4, world: 'field-crossing', seed: 7 },
    { characterId: 'interceptor', flightTraits: true, airframes: 3 },
  );
  pauseOverflight(run);
  const before = assessmentDigest(run);
  assert.throws(
    () =>
      encodeOverflightCheckpoint({
        run,
        project,
        packageIdentity,
        attemptId,
        settings: {
          seed: run.seed,
          airframes: 3,
          slowResume: run.slowResume,
          characterId: 'interceptor',
          flightTraits: false,
          authored: false,
        },
      }),
    /handling settings differ/,
  );
  assert.equal(assessmentDigest(run), before);
});
