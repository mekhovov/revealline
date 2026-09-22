import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createOutpostSpatialCandidates } from '../content-design/outpost-spatial-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';

const project = compileContentProject(createOutpostSpatialCandidates());
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/outpost-spatial-routes.json', import.meta.url)),
);

test('Outpost matrix includes all presets/controls, a west-first alternative and a delayed seed', () => {
  assert.equal(fixture.format, 'OutpostSpatialRoutesV1');
  assert.equal(fixture.rows.length, 8);
  assert(fixture.rows.every((row) => row.id === 'island-outpost'));
  for (const row of fixture.rows.filter((r) => r.variant === 'east-route')) {
    assert.equal(row.seed, 1);
    assert.equal(row.delaySeconds, 0);
  }
  assert.deepEqual(
    fixture.rows
      .filter((r) => r.variant === 'east-route')
      .map((r) => `${r.difficulty}/${r.turnPolicy}`)
      .sort(),
    [
      'expert/grid-center',
      'expert/immediate',
      'gentle/grid-center',
      'gentle/immediate',
      'standard/grid-center',
      'standard/immediate',
    ],
  );
  const west = fixture.rows.find((r) => r.variant === 'western-first');
  assert.deepEqual(
    [west.difficulty, west.turnPolicy, west.seed, west.delaySeconds],
    ['standard', 'immediate', 1, 0],
  );
  assert.deepEqual(west.segments[0], { direction: 'left', ticks: 222 });
  const delayed = fixture.rows.find((r) => r.variant === 'delayed-east-route');
  assert.deepEqual([delayed.difficulty, delayed.turnPolicy], ['standard', 'immediate']);
  assert.equal(delayed.seed, 2);
  assert.equal(delayed.delaySeconds, 1.5);
  assert.deepEqual(delayed.segments[0], { direction: null, ticks: 180 });
});

for (const row of fixture.rows)
  test(`Outpost clear/replay/two-side mastery/equal race: ${row.difficulty}/${row.turnPolicy}/${row.variant}`, () => {
    const manifest = resolveMission(project, row.id, { difficulty: row.difficulty });
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    const options = { seed: row.seed, classId: 'scout', turnPolicy: row.turnPolicy };
    const run = createRun(manifest.level, options),
      recorder = createRecorder(manifest.level, options);
    const duel = createDuel(manifest.level, options, {
      protocol: UNTIMED_DUEL_PROTOCOL,
      seconds: 0,
    });
    assert.notEqual(duel.runs[0].cells, duel.runs[1].cells);
    resumeDuel(duel);
    const closures = [],
      sides = new Set();
    let collections = 0;
    for (const { direction, ticks } of row.segments)
      for (let t = 0; t < ticks; t++) {
        assert.equal(run.status, 'running');
        if (direction === null) {
          assert.equal(run.player.speed, 0);
          assert.equal(run.player.cutting, false);
        }
        recordInput(recorder, { direction });
        stepRun(run, { direction }, FIXED_DT);
        stepDuel(duel, [{ direction }, { direction }]);
        assert.equal(run.classic.livesLost, 0);
        assert.equal(run.totalClaimable, 2355);
        collections += run.events.filter((e) => e.type === 'powerup.collected').length;
        if (run.events.some((e) => e.type === 'cut.closed'))
          closures.push([run.tick, run.coverage]);
        // Observe actual contact with the perimeter return boundary, not just linked cells.
        if (!run.player.cutting) {
          const epsilon = 1e-7;
          if (run.player.x <= 1 + epsilon) sides.add('west');
          if (run.player.x >= run.width - 1 - epsilon) sides.add('east');
          if (run.player.y <= 1 + epsilon) sides.add('north');
          if (run.player.y >= run.height - 1 - epsilon) sides.add('south');
        }
      }
    assert.equal(run.status, 'won');
    assert.equal(row.status, run.status);
    assert.equal(row.lives, run.lives);
    assert.equal(row.cuts, closures.length);
    assert.equal(run.tick, row.ticks);
    assert.equal(run.coverage, row.coverage);
    assert.deepEqual(closures, row.closures);
    assert.equal(collections, 0);
    assert(sides.size >= 2);
    assert(sides.has('west') && sides.has('east'));
    assert.equal(authoritativeCheckpoint(run).hash, row.checkpoint);
    assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
    assert.equal(duel.status, 'finished');
    assert.equal(duel.winner, null);
    assert(duel.runs.every((r) => r.status === 'won' && r.classic.livesLost === 0));
    assert.deepEqual(authoritativeCheckpoint(duel.runs[0]), authoritativeCheckpoint(duel.runs[1]));
  });
