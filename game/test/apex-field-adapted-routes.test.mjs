import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createApexFieldCandidates } from '../content-design/apex-field-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { playApexFieldRoute } from './helpers/apex-field-route.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';

const fixture = JSON.parse(
  await readFile(new URL('./fixtures/apex-field-adapted-routes.json', import.meta.url)),
);
const original = JSON.parse(
  await readFile(new URL('./fixtures/apex-field-clear-routes.json', import.meta.url)),
);
const project = compileContentProject(createApexFieldCandidates());

test('six explicitly adapted logs retain the same editions and cover every preset/control without search-added waits', () => {
  assert.equal(fixture.format, 'ApexFieldAdaptedRoutesV1');
  assert.equal(fixture.revision, 'home-field-2');
  assert.equal(fixture.rows.length, 6);
  assert.deepEqual(
    fixture.rows
      .map((r) => `${r.id}/${r.difficulty}/${r.turnPolicy}/${r.seed}/${r.delaySeconds}`)
      .sort(),
    [
      ['gentle', 0.5],
      ['standard', 0.25],
      ['expert', 1],
    ]
      .flatMap(([difficulty, delay]) =>
        ['immediate', 'grid-center'].map(
          (control) => `home-signal/${difficulty}/${control}/2/${delay}`,
        ),
      )
      .sort(),
  );
  for (const row of fixture.rows) {
    assert.deepEqual(row.searchWaitTicks, [0]);
    assert.deepEqual(row.segments[0], { direction: null, ticks: row.delaySeconds * 120 });
    assert.deepEqual(row.segments[1], { direction: 'up', ticks: 102 });
    assert(row.segments.slice(1).every((segment) => segment.direction !== null));
    const before = original.rows.find(
      (r) => r.difficulty === row.difficulty && r.turnPolicy === row.turnPolicy,
    );
    assert.equal(
      row.simulationIdentity,
      before.simulationIdentity,
      'No balance change hidden in adapted evidence',
    );
    assert.equal(row.evidence.closures[0].tick, row.delaySeconds * 120 + 102);
    assert.equal(row.evidence.ticksAfterQuota, 0);
  }
  assert(
    fixture.rows
      .filter((r) => r.difficulty === 'standard')
      .every((r) => r.evidence.objectives[0][1] === 'south-relay'),
  );
  assert(fixture.rows.filter((r) => r.difficulty === 'expert').every((r) => r.evidence.mastery));
  assert(
    fixture.rows.some((r) => r.evidence.roverEvents.length === 0),
    'Retain completely bypassed roamer evidence',
  );
  assert.equal(original.delayedProbes.filter((p) => p.metrics.status === 'life-lost').length, 6);
});

for (const row of fixture.rows)
  test(`adapted seed2 no-wait clear/replay/race: ${row.difficulty}/${row.turnPolicy}`, () => {
    const manifest = resolveMission(project, row.id, { difficulty: row.difficulty });
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    const result = playApexFieldRoute(manifest, row, { race: true });
    assert.deepEqual(result, row.evidence);
    assert.equal(result.checkpoint, row.checkpoint);
    assert.deepEqual(result.collectedBonusIds, []);
  });

test('adapted inputs keep moving after launch rather than hiding waits against a wall', () => {
  for (const row of fixture.rows) {
    const run = createRun(resolveMission(project, row.id, { difficulty: row.difficulty }).level, {
      seed: row.seed,
      classId: 'scout',
      turnPolicy: row.turnPolicy,
    });
    let stationaryTicks = 0;
    for (const { direction, ticks } of row.segments)
      for (let tick = 0; tick < ticks; tick++) {
        const before = { x: run.player.x, y: run.player.y };
        stepRun(run, { direction }, FIXED_DT);
        if (
          run.tick > row.delaySeconds * 120 &&
          Math.hypot(run.player.x - before.x, run.player.y - before.y) < 1e-9
        )
          stationaryTicks++;
      }
    assert.equal(stationaryTicks, 0, `${row.difficulty}/${row.turnPolicy}`);
    assert.equal(run.status, 'won');
    assert.equal(run.classic.livesLost, 0);
  }
});
