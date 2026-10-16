import test from 'node:test';
import assert from 'node:assert/strict';
import { createOverflightProject, compileOverflightProject } from '../overflight/project.mjs';
import { createOverflightRun, startOverflight, stepOverflight } from '../overflight/core.mjs';
import {
  createOverflightHuntProject,
  compileOverflightHuntProject,
} from '../overflight/raid-project.mjs';
import {
  createOverflightHuntRun,
  startOverflightHunt,
  stepOverflightHunt,
} from '../overflight/raid-core.mjs';
import { overflightHuntRecordContext } from '../overflight/raid-records.mjs';
import { overflightFlightProfile } from '../overflight/flight-profile.mjs';

for (const [name, project, compile, create, start, step] of [
  [
    'Survivor',
    createOverflightProject,
    compileOverflightProject,
    createOverflightRun,
    startOverflight,
    stepOverflight,
  ],
  [
    'Raid',
    createOverflightHuntProject,
    compileOverflightHuntProject,
    createOverflightHuntRun,
    startOverflightHunt,
    stepOverflightHunt,
  ],
])
  test(`${name}: optional handling trades movement for hull; classic and fixtures keep baseline`, () => {
    const compiled = compile(project());
    const runs = ['interceptor', 'scout', 'carrier'].map((characterId) =>
      create(compiled, { characterId, flightTraits: true }),
    );
    for (const run of runs) {
      start(run);
      for (let i = 0; i < 20; i++) step(run, { x: 1 });
    }
    assert.deepEqual(
      runs.map((r) => r.player.maxHull),
      [80, 100, 120],
    );
    assert.ok(runs[0].player.vx > runs[1].player.vx && runs[1].player.vx > runs[2].player.vx);
    assert.equal(create(compiled, { characterId: 'interceptor' }).flight.id, 'balanced');
    assert.equal(
      create(compiled, {
        characterId: 'interceptor',
        flightTraits: true,
        fixture: name === 'Raid' ? 'raid-reference' : 'reference',
      }).flight.id,
      'balanced',
    );
  });
test('Raid handling profiles cannot share existing classic records', () => {
  const compiled = compileOverflightHuntProject(createOverflightHuntProject());
  const contexts = ['scout', 'interceptor', 'carrier'].map((characterId) =>
    overflightHuntRecordContext(
      createOverflightHuntRun(compiled, { characterId, flightTraits: true }),
    ),
  );
  assert.equal(contexts[0].project, compiled.projectIdentity);
  assert.equal(new Set(contexts.map((c) => c.project)).size, 3);
  assert.equal(overflightFlightProfile('unknown', true).id, 'balanced');
});
