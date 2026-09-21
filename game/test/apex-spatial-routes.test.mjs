import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createApexSpatialCandidates } from '../content-design/apex-spatial-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { playApexSpatialRoute } from './helpers/apex-spatial-route.mjs';
import { assessPressureRoute } from '../../scripts/lib/pressure-route-assessment.mjs';

const fixture = JSON.parse(
  await readFile(new URL('./fixtures/apex-spatial-clear-routes.json', import.meta.url)),
);
const controls = JSON.parse(
  await readFile(new URL('./fixtures/apex-open-baffle-controls.json', import.meta.url)),
);
const rejected = JSON.parse(
  await readFile(new URL('./fixtures/apex-rejected-baffles.json', import.meta.url)),
);
const project = compileContentProject(createApexSpatialCandidates());

test('eleven legal routes cover all presets/controls, distinct returns, dock traversal, delays and the retained isolation control', () => {
  assert.equal(fixture.format, 'ApexSpatialFeasibilityV1');
  assert.equal(fixture.rows.length, 11);
  const presetControls = ['gentle', 'standard', 'expert'].flatMap((difficulty) =>
    ['immediate', 'grid-center'].map((control) => `${difficulty}/${control}/1`),
  );
  assert.deepEqual(
    fixture.rows
      .map((row) => `${row.route}/${row.difficulty}/${row.turnPolicy}/${row.seed}`)
      .sort(),
    [
      ...presetControls.map((key) => `ordinary/${key}`),
      'upper-return/standard/immediate/1',
      'dock-out-and-back/standard/immediate/1',
      'delayed-lower-return/standard/immediate/2',
      'delayed-upper-return/standard/immediate/2',
      'isolated-control/gentle/grid-center/1',
    ].sort(),
  );
  for (const [route, ticks] of [
    ['delayed-lower-return', 120],
    ['delayed-upper-return', 30],
  ])
    assert.deepEqual(fixture.rows.find((row) => row.route === route).segments[0], {
      direction: null,
      ticks,
    });
  assert.deepEqual(
    controls.rows.map((row) => `${row.difficulty}/${row.turnPolicy}/${row.seed}`).sort(),
    presetControls.sort(),
  );
  assert.deepEqual(
    fixture.delayedProbes
      .map((row) => `${row.route}/${row.turnPolicy}/${row.seed}/${row.delay}`)
      .sort(),
    [
      'ordinary/immediate',
      'ordinary/grid-center',
      'upper-return/immediate',
      'dock-out-and-back/immediate',
    ]
      .flatMap((key) => [30, 60, 120].map((delay) => `${key}/2/${delay}`))
      .sort(),
  );
  const base = fixture.rows.filter((row) => row.route === 'ordinary');
  assert.equal(base.length, 6);
  for (const difficulty of ['gentle', 'standard', 'expert'])
    for (const turnPolicy of ['immediate', 'grid-center'])
      assert(base.some((row) => row.difficulty === difficulty && row.turnPolicy === turnPolicy));
  const dock = fixture.rows.find((row) => row.route === 'dock-out-and-back');
  assert.deepEqual(
    dock.evidence.dockCrossings.map(({ tick, action }) => [tick, action]),
    [
      [715, 'enter'],
      [859, 'exit'],
      [870, 'enter'],
      [1015, 'exit'],
    ],
  );
  const [enterEast, exitWest, enterWest, exitEast] = dock.evidence.dockCrossings;
  assert(enterEast.fromX >= 32 && enterEast.toX < 32);
  assert(exitWest.fromX >= 20 && exitWest.toX < 20);
  assert(enterWest.fromX < 20 && enterWest.toX >= 20);
  assert(exitEast.fromX < 32 && exitEast.toX >= 32);
  assert(exitEast.tick < dock.evidence.stages[0].tick);
  assert(
    dock.evidence.goal.used.some(
      ([id, tick]) => id === 'home-dock' && tick < dock.evidence.stages[0].tick,
    ),
  );
  assert.equal(fixture.rows.filter((row) => row.seed === 2).length, 2);
  assert.equal(fixture.delayedProbes.length, 12);
  assert.equal(fixture.delayedProbes.filter((row) => row.metrics.status === 'life-lost').length, 4);
});

for (const row of fixture.rows)
  test(`Home contested return: ${row.difficulty}/${row.turnPolicy}/${row.route}`, () => {
    const manifest = resolveMission(project, row.id, { difficulty: row.difficulty });
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    const actual = playApexSpatialRoute(manifest, row, { race: true });
    assert.deepEqual(actual, row.evidence);
    assert.equal(actual.goal.achieved, true);
    assert.deepEqual(actual.collectedBonusIds, []);
    if (row.route === 'isolated-control') {
      assert.equal(actual.release.cause, 'isolated');
      assert.equal(actual.release.cutCells, 0);
    } else {
      assert.equal(actual.release.cause, 'cut-release');
      assert(actual.release.cutCells >= manifest.level.encounter.minReleaseCutCells);
    }
    const warning = actual.roverEvents.find((event) => event[1] === 'rover.warning');
    const activation = actual.roverEvents.find((event) => event[1] === 'rover.activated');
    assert.equal(activation[0] - warning[0], 120);
    assert(
      actual.cutStarts.some(
        (start) => start > activation[0] && actual.closures.some(([end]) => end > start),
      ),
    );
    assert(actual.stages[0].fieldCells > manifest.level.encounter.minReleaseCutCells);
  });

for (const probe of fixture.delayedProbes)
  test(`retain exact delayed outcome: ${probe.route}/${probe.turnPolicy}/delay${probe.delay}`, () => {
    const row = fixture.rows.find(
      (item) =>
        item.difficulty === 'standard' &&
        item.seed === 1 &&
        item.route === probe.route &&
        item.turnPolicy === probe.turnPolicy,
    );
    const metrics = assessPressureRoute(
      resolveMission(project, row.id, { difficulty: 'standard' }).level,
      {
        segments: row.segments.map(({ direction, ticks }) => [direction, ticks]),
        seed: probe.seed,
        turnPolicy: probe.turnPolicy,
        initialDelayTicks: probe.delay,
      },
    );
    assert.deepEqual(metrics, probe.metrics);
  });

test('discarded baffle pen still reproduces its short clears; it is not silently relabelled improved', () => {
  const draft = compileContentProject(rejected.source);
  assert.equal(rejected.rows.length, 2);
  for (const row of rejected.rows) {
    const manifest = resolveMission(draft, row.id, { difficulty: row.difficulty });
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    const result = playApexSpatialRoute(manifest, row);
    assert.equal(result.checkpoint, row.checkpoint);
    assert(result.seconds < 21);
    assert(result.stages[0].fieldCells <= 33);
  }
});

for (const row of controls.rows)
  test(`causal placement control: ${row.difficulty}/${row.turnPolicy}`, () => {
    const before = compileContentProject(controls.source);
    const manifest = resolveMission(before, row.id, { difficulty: row.difficulty });
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    assert.equal(playApexSpatialRoute(manifest, row).checkpoint, row.checkpoint);
    const next = resolveMission(project, row.id, { difficulty: row.difficulty });
    const expected = structuredClone(manifest.level);
    Object.assign(
      expected.enemies.find((enemy) => enemy.id === 'roamer'),
      { x: 42.5, y: 22.5 },
    );
    assert.deepEqual(
      next.level,
      expected,
      'placement is the only runtime change from the open-baffle control',
    );
    const run = createRun(next.level, { seed: 1, classId: 'scout', turnPolicy: row.turnPolicy });
    const events = [];
    outer: for (const segment of row.segments)
      for (let tick = 0; tick < segment.ticks; tick++) {
        stepRun(run, { direction: segment.direction }, FIXED_DT);
        for (const event of run.events)
          if (['rover.warning', 'rover.activated', 'player.failed'].includes(event.type))
            events.push({ ...event });
        if (run.classic.livesLost || run.status !== 'running') break outer;
      }
    if (row.turnPolicy === 'immediate') {
      assert.equal(run.classic.livesLost, 1);
      const failure = events.find((event) => event.type === 'player.failed');
      assert.equal(failure.cause, 'enemy-player');
      assert.equal(failure.actorId, 'roamer');
      const warning = events.find((event) => event.type === 'rover.warning');
      const activation = events.find((event) => event.type === 'rover.activated');
      assert.equal(activation.tick - warning.tick, 120);
      assert(run.tick > activation.tick);
      assert.equal(run.enemies.find((enemy) => enemy.id === 'roamer').classic.mode, 'active');
    } else assert.equal(run.status, 'won', 'alternative shape remains available');
  });
