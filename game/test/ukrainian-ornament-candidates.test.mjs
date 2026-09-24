import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createUkrainianOrnamentJourney,
  UKRAINIAN_ORNAMENT_MISSION_IDS,
  UKRAINIAN_ORNAMENT_REVISION,
} from '../content-design/ukrainian-ornament-candidates.mjs';
import { createSpatialChallengeJourney } from '../content-design/spatial-challenge-journey.mjs';
import { createWholeSortingCandidates } from '../content-design/whole-spatial-candidates.mjs';
import { createCulturalWorkshopCandidates } from '../content-design/cultural-workshop-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { freezeDesign } from '../content-design/catalogs.mjs';
import { createRun, stepRun, FIXED_DT, CELL } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';
import { inspectEffectiveGameplay } from '../content-design/pressure-candidates.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { GAMEPLAY_TUNING_VERSION } from '../gameplay-tuning.mjs';
import {
  prepareSpatialMission,
  assessSpatialRoute,
} from '../../scripts/lib/spatial-challenge-assessment.mjs';

const ids = new Set(UKRAINIAN_ORNAMENT_MISSION_IDS);
const source = createUkrainianOrnamentJourney();
const project = compileContentProject(source);
const base = compileContentProject(createSpatialChallengeJourney());
const routeFixture = JSON.parse(
  readFileSync(new URL('./fixtures/ukrainian-ornament-routes.json', import.meta.url), 'utf8'),
);
const presets = ['gentle', 'standard', 'expert'];
const controls = ['immediate', 'grid-center'];
const inspections = new Map();
const inspectionFor = (id, difficulty) => {
  const key = `${id}/${difficulty}`;
  if (!inspections.has(key))
    inspections.set(key, inspectEffectiveGameplay(source, id, { difficulty }));
  return inspections.get(key);
};
const mapFor = (content, mission) =>
  content.maps.find((map) => map.id === mission.map.id && map.revision === mission.map.revision);

test('the optional study names exactly three retained Ukrainian missions', () => {
  assert.deepEqual(UKRAINIAN_ORNAMENT_MISSION_IDS, [
    'cross-stitch-crossings',
    'rushnyk-bands',
    'pysanka-sections',
  ]);
  assert(Object.isFrozen(UKRAINIAN_ORNAMENT_MISSION_IDS));
  assert.equal(source.missions.length, 91);
  assert.equal(source.maps.length, 91);
});

for (const artwork of [false, true])
  test(`copy-on-write preserves the other 88 missions and all retained pictures: ${artwork}`, () => {
    const previous = createSpatialChallengeJourney({ artwork });
    const snapshot = structuredClone(previous);
    const next = createUkrainianOrnamentJourney({ artwork, source: freezeDesign(previous) });
    assert.deepEqual(previous, snapshot);
    assert.deepEqual(next.assets, previous.assets);
    for (const key of ['policyId', 'actorCatalogId', 'difficultyCatalogId'])
      assert.equal(next[key], previous[key]);
    for (const key of ['missions', 'campaigns', 'packs'])
      assert.deepEqual(
        next[key].map((item) => item.id),
        previous[key].map((item) => item.id),
      );
    for (const key of ['campaigns', 'packs'])
      assert.deepEqual(
        next[key].map((item) => ({ ...item, revision: null })),
        previous[key].map((item) => ({ ...item, revision: null })),
      );
    for (const mission of next.missions) {
      const old = previous.missions.find((candidate) => candidate.id === mission.id);
      assert.deepEqual(mission.presentation, old.presentation);
      assert.equal(mission.coverage, old.coverage);
      assert.equal(mission.timeLimitSeconds, old.timeLimitSeconds);
      assert.deepEqual(mission.modes, old.modes);
      assert.deepEqual(mission.bonuses, old.bonuses);
      if (ids.has(mission.id)) {
        assert.equal(mission.revision, UKRAINIAN_ORNAMENT_REVISION);
        assert.equal(mission.map.id, old.map.id);
        assert.equal(mission.map.revision, UKRAINIAN_ORNAMENT_REVISION);
        assert.notEqual(mission.revision, old.revision);
        assert.notDeepEqual(mapFor(next, mission), mapFor(previous, old));
      } else {
        assert.deepEqual(mission, old);
        assert.deepEqual(mapFor(next, mission), mapFor(previous, old));
      }
    }
    assert.deepEqual(next.missions.slice(0, 3), previous.missions.slice(0, 3));
    next.missions.find((mission) => ids.has(mission.id)).name = 'Local study edit';
    assert.deepEqual(createSpatialChallengeJourney({ artwork }), snapshot);
  });

test('the supplied frozen source and historical factories are not rewritten', () => {
  const historical = [createCulturalWorkshopCandidates(), createWholeSortingCandidates()];
  const previous = createSpatialChallengeJourney();
  const untouched = previous.missions.find((mission) => mission.id === 'two-bays');
  untouched.design.lesson = 'Independent review text must survive the study wrapper.';
  const before = structuredClone(previous);
  const next = createUkrainianOrnamentJourney({ source: freezeDesign(previous) });
  assert.deepEqual(previous, before);
  assert.deepEqual(
    next.missions.find((mission) => mission.id === untouched.id),
    untouched,
  );
  assert.deepEqual(createCulturalWorkshopCandidates(), historical[0]);
  assert.deepEqual(createWholeSortingCandidates(), historical[1]);
});

test('each motif changes real geometry without creating remote empty fill or sealed departures', () => {
  const identities = new Set();
  for (const id of ids) {
    const mission = project.missions.find((candidate) => candidate.id === id);
    const old = base.missions.find((candidate) => candidate.id === id);
    const map = project.maps.find(
      (candidate) =>
        candidate.source.id === mission.map.id &&
        candidate.source.revision === mission.map.revision,
    );
    const oldMap = base.maps.find(
      (candidate) =>
        candidate.source.id === old.map.id && candidate.source.revision === old.map.revision,
    );
    identities.add(map.geometryIdentity);
    assert.notEqual(map.geometryIdentity, oldMap.geometryIdentity, id);
    assert(map.source.walls.length > 0, id);
    assert.notDeepEqual(map.source.walls, oldMap.source.walls, id);
    assert.notDeepEqual(map.source.foundations, oldMap.source.foundations, id);
    assert.equal(map.geometry.fieldComponents.length, 1, id);
    assert(
      map.geometry.safeComponents.every((component) => component.departures.length >= 4),
      id,
    );
    assert(map.geometry.foundationCount > 0, id);
    assert(map.geometry.eligibleCount > 1500, id);
    assert(!map.geometry.diagnostics.some((item) => item.code === 'remote-chamber'), id);
    for (const spawn of map.source.spawns)
      assert.equal(
        map.geometry.cells[Math.floor(spawn.y) * 72 + Math.floor(spawn.x)],
        CELL.SAFE,
        id,
      );
    for (const rectangle of map.source.walls)
      for (let y = rectangle.y; y < rectangle.y + rectangle.h; y++)
        for (let x = rectangle.x; x < rectangle.x + rectangle.w; x++) {
          const index = y * 72 + x;
          assert.equal(map.geometry.cells[index], CELL.WALL, id);
          assert.equal(map.geometry.permanent[index], 0, 'A motif wall is not return ground');
          assert.equal(map.geometry.eligible[index], 0, 'A motif wall earns no coverage');
        }
  }
  assert.equal(identities.size, 3);
});

test('the staggered motifs require different axes, earned gap connections and distinct return approaches', () => {
  const at = (id, x, y) => {
    const run = createRun(prepareSpatialMission(project, id).level, { seed: 1 });
    return run.cells[y * run.width + x];
  };
  for (const [x, y] of [
    [16, 16],
    [28, 16],
    [49, 14],
    [49, 26],
  ])
    assert.equal(at('cross-stitch-crossings', x, y), CELL.FIELD);
  assert.equal(at('cross-stitch-crossings', 22, 8), CELL.WALL);
  assert.equal(at('cross-stitch-crossings', 57, 20), CELL.WALL);
  assert.equal(at('cross-stitch-crossings', 35, 9), CELL.SAFE);
  assert.equal(at('cross-stitch-crossings', 35, 16), CELL.FIELD, 'The middle return is offset');
  for (let y = 10; y < 14; y++)
    assert.equal(at('rushnyk-bands', 27, y), CELL.FIELD, 'No foundation bridges the upper gap');
  for (let y = 22; y < 27; y++)
    assert.equal(at('rushnyk-bands', 44, y), CELL.FIELD, 'No foundation bridges the lower gap');
  assert.equal(at('rushnyk-bands', 27, 24), CELL.WALL, 'A repeat of the upper gap axis is blocked');
  assert.equal(at('rushnyk-bands', 27, 8), CELL.SAFE);
  assert.equal(at('rushnyk-bands', 44, 28), CELL.SAFE);
  assert.equal(at('pysanka-sections', 48, 16), CELL.FIELD, 'The side opening remains traversable');
  assert.equal(at('pysanka-sections', 48, 13), CELL.WALL);
  assert.equal(at('pysanka-sections', 51, 21), CELL.WALL);
  assert.equal(at('pysanka-sections', 28, 7), CELL.FIELD, 'The northern shoulder stays open');
  assert.equal(at('pysanka-sections', 10, 20), CELL.SAFE);
  assert.equal(at('pysanka-sections', 60, 16), CELL.SAFE);
});

for (const difficulty of presets)
  for (const turnPolicy of controls)
    test(`current shared gameplay preserves rules, actual actors and retained field: ${difficulty}/${turnPolicy}`, () => {
      for (const id of ids) {
        const solo = resolveMission(project, id, { difficulty });
        const versus = resolveMission(project, id, { difficulty, mode: 'versus' });
        const previous = resolveMission(base, id, { difficulty });
        assert.deepEqual(solo.level, versus.level, id);
        assert.deepEqual(solo.level.rules, previous.level.rules, id);
        assert.deepEqual(solo.level.goal, previous.level.goal, id);
        assert.notEqual(solo.simulationIdentity, previous.simulationIdentity, id);
        const prepared = prepareSpatialMission(project, id, { difficulty });
        const inspection = inspectionFor(id, difficulty);
        const run = createRun(prepared.level, { seed: 1, turnPolicy });
        const peer = createRun(prepared.level, { seed: 1, turnPolicy });
        assert.equal(prepared.gameplayTuning.version, GAMEPLAY_TUNING_VERSION);
        assert.equal(prepared.gameplayTuning.adminOverride, false);
        assert(Math.abs(run.level.rules.moveSpeed - 8.84) < 1e-9);
        assert.equal(run.lives, { gentle: 5, standard: 3, expert: 2 }[difficulty]);
        assert.equal(inspection.population.actualEnemies, run.enemies.length, id);
        const expectedActors = {
          'cross-stitch-crossings': difficulty === 'expert' ? 5 : 3,
          'rushnyk-bands': difficulty === 'expert' ? 6 : 4,
          'pysanka-sections': difficulty === 'expert' ? 4 : 3,
        };
        assert.equal(run.enemies.length, expectedActors[id], id);
        assert.deepEqual(
          inspection.actors.map((actor) => actor.runtime),
          prepared.level.enemies,
          id,
        );
        assert.equal(inspectCaptureSnapshot(run).filledCells.length, 0, id);
        assert(
          inspectCaptureSnapshot(run).components.every((component) => component.retained),
          id,
        );
        assert.equal(run.coverage, 0);
        for (const enemy of run.enemies)
          if (enemy.type === 'bouncer') {
            assert.equal(
              run.cells[Math.floor(enemy.y) * run.width + Math.floor(enemy.x)],
              CELL.FIELD,
              id,
            );
            assert(
              Math.abs(
                Math.hypot(enemy.vx, enemy.vy) -
                  { gentle: 8.2875, standard: 11.05, expert: 13.26 }[difficulty],
              ) < 1e-8,
            );
          }
        // A bounded fresh-spawn observation, not a human balance or ten-second safety claim.
        for (let tick = 0; tick < 60; tick++) {
          stepRun(run, { direction: null }, FIXED_DT);
          stepRun(peer, { direction: null }, FIXED_DT);
        }
        assert.equal(run.classic.livesLost, 0, id);
        assert.deepEqual(authoritativeCheckpoint(run), authoritativeCheckpoint(peer), id);
      }
    });

for (const difficulty of presets)
  for (const turnPolicy of controls)
    test(`the starting wall is inspectable without starting or closing a cut: ${difficulty}/${turnPolicy}`, () => {
      const contacts = {
        'cross-stitch-crossings': { direction: 'right', wall: [16, 15] },
        'rushnyk-bands': { direction: 'down', wall: [14, 12] },
        'pysanka-sections': { direction: 'up', wall: [35, 6] },
      };
      for (const [id, { direction, wall }] of Object.entries(contacts)) {
        const prepared = prepareSpatialMission(project, id, { difficulty });
        const run = createRun(prepared.level, { seed: 1, turnPolicy });
        assert.equal(run.cells[wall[1] * run.width + wall[0]], CELL.WALL, id);
        let closed = 0;
        let started = 0;
        for (let tick = 0; tick < 60; tick++) {
          stepRun(run, { direction }, FIXED_DT);
          closed += run.events.filter((event) => event.type === 'cut.closed').length;
          started += run.events.filter((event) => event.type === 'cut.started').length;
        }
        assert.equal(run.classic.livesLost, 0, id);
        assert.equal(run.coverage, 0, id);
        assert.equal(started, 0, id);
        assert.equal(closed, 0, id);
        assert.equal(run.player.cutting, false, id);
        assert.equal(run.trail.length, 0, id);
        assert.equal(
          run.cells[Math.floor(run.player.y) * run.width + Math.floor(run.player.x)],
          CELL.SAFE,
          id,
        );
        if (direction === 'right') assert(run.player.x < wall[0] && run.player.x > wall[0] - 1);
        if (direction === 'down') assert(run.player.y < wall[1] && run.player.y > wall[1] - 1);
        if (direction === 'up') assert(run.player.y > wall[1] + 1 && run.player.y < wall[1] + 2);
      }
    });

function verifySample(prepared, row, sample) {
  const segments = sample.segments.map(([direction, ticks]) => ({ direction, ticks }));
  const result = assessSpatialRoute(prepared, {
    seed: sample.seed,
    turnPolicy: row.turnPolicy,
    segments,
  });
  for (const key of ['status', 'ticks', 'cuts', 'losses', 'failureCause', 'coverage', 'checkpoint'])
    assert.equal(result[key], sample[key], key);
  assert.equal(result.replayVerified, true);
  const run = createRun(prepared.level, {
    seed: sample.seed,
    turnPolicy: row.turnPolicy,
    classId: 'scout',
  });
  const field = new Set();
  for (const { direction, ticks } of segments)
    for (let tick = 0; tick < ticks; tick++) {
      assert.equal(run.classic.livesLost, 0, 'Each sample ends at its first loss');
      stepRun(run, { direction }, FIXED_DT);
      for (const cell of run.trail) field.add(cell.index);
    }
  const xs = [...field].map((index) => index % run.width);
  const ys = [...field].map((index) => Math.floor(index / run.width));
  assert.deepEqual([run.player.x, run.player.y], sample.returnPosition);
  assert.deepEqual(
    xs.length ? [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] : null,
    sample.fieldBounds,
  );
  assert.equal(sample.closed, result.cuts > 0);
}

for (const row of routeFixture.rows)
  test(`legal ornament route evidence: ${row.missionId}/${row.difficulty}/${row.turnPolicy}/${row.approach}`, () => {
    const prepared = prepareSpatialMission(project, row.missionId, { difficulty: row.difficulty });
    assert.equal(prepared.simulationIdentity, row.simulationIdentity);
    assert.equal(prepared.authoredSimulationIdentity, row.authoredSimulationIdentity);
    assert.equal(prepared.gameplayTuning.version, row.gameplayTuningVersion);
    assert.equal(prepared.gameplayTuning.adminOverride, false);
    for (const sample of row.attempts) verifySample(prepared, row, sample);
    if (row.selectedAttempt !== null) {
      const selected = row.attempts[row.selectedAttempt];
      assert.equal(selected.closed, true);
      assert.equal(selected.losses, 0);
      assert.equal(selected.cuts, 1);
      const [x, y] = selected.returnPosition;
      if (row.missionId === 'cross-stitch-crossings') {
        assert(x >= 34 && x < 39);
        assert.equal(y, row.approach === 'mouth' ? 12 : 8);
      } else if (row.missionId === 'rushnyk-bands') {
        assert.equal(x, row.approach === 'inner' ? 26 : 42);
        assert(row.approach === 'inner' ? y >= 8 && y < 10 : y >= 27 && y < 31);
      } else if (row.approach === 'side') {
        assert.equal(x, 59);
        assert(y >= 14 && y < 19);
      } else {
        assert(x >= 8 && x < 13);
        assert.equal(y, 19);
      }
    } else {
      assert.equal(row.qualification, 'sampled-prefix-failed');
      assert(row.attempts.every((sample) => sample.losses > 0 || !sample.closed));
    }
    if (row.continuation) {
      const proof = row.continuation;
      const result = assessSpatialRoute(prepared, {
        seed: row.attempts[row.selectedAttempt].seed,
        turnPolicy: row.turnPolicy,
        segments: proof.segments.map(([direction, ticks]) => ({ direction, ticks })),
      });
      for (const key of [
        'status',
        'ticks',
        'cuts',
        'losses',
        'failureCause',
        'coverage',
        'coverageGoal',
        'checkpoint',
        'levelIdentity',
        'ruleset',
      ])
        assert.equal(result[key], proof[key], key);
      assert.equal(result.replayVerified, true);
      assert.deepEqual(
        result.closures.map((closure) => [closure.tick, closure.coverage]),
        proof.closureCoverage,
      );
      assert.equal(row.qualification === 'full-clear-qualified', result.status === 'no-loss-clear');
      assert.equal(
        proof.search.simulatedTicks,
        proof.search.simulationTickBudget,
        'Search stopped on its recorded budget, not an impossibility result',
      );
      assert(proof.cuts < proof.search.maxCuts);
    }
  });

test('bounded route coverage retains failed samples and does not relabel partial routes as clears', () => {
  assert.equal(routeFixture.rows.length, 36);
  for (const id of ids)
    for (const difficulty of presets)
      for (const turnPolicy of controls) {
        const rows = routeFixture.rows.filter(
          (row) =>
            row.missionId === id && row.difficulty === difficulty && row.turnPolicy === turnPolicy,
        );
        assert.equal(rows.length, 2);
        assert.equal(new Set(rows.map((row) => row.approach)).size, 2);
        assert.notDeepEqual(rows[0].attempts[0].segments, rows[1].attempts[0].segments);
      }
  const rows = routeFixture.rows;
  assert.deepEqual(routeFixture.outcomes, {
    configurations: rows.length,
    safeOpeningConfigurations: rows.filter((row) => row.selectedAttempt !== null).length,
    failedOpeningConfigurations: rows.filter((row) => row.selectedAttempt === null).length,
    sampledAttempts: rows.reduce((total, row) => total + row.attempts.length, 0),
    sampledLifeLosses: rows.reduce(
      (total, row) => total + row.attempts.filter((sample) => sample.losses > 0).length,
      0,
    ),
    continuations: rows.filter((row) => row.continuation).length,
    fullClears: rows.filter((row) => row.continuation?.status === 'no-loss-clear').length,
  });
  assert.equal(routeFixture.outcomes.safeOpeningConfigurations, 28);
  assert.equal(routeFixture.outcomes.sampledLifeLosses, 88);
  assert.equal(
    routeFixture.outcomes.fullClears,
    0,
    'This bounded fixture is not full-clear qualification',
  );
});
