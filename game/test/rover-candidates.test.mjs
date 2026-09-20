import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createRoverCandidates,
  ROVER_ARCS,
  ROVER_REFERENCE_ADAPTATIONS,
  ROVER_FIRST_RETURNS,
} from '../content-design/rover-candidates.mjs';
import { createNeonCandidates } from '../content-design/neon-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { resolveContentJourney } from '../content-design/journey.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';
import { ROVER_ACTOR_CATALOG } from '../content-design/catalogs.mjs';

const source = createRoverCandidates();
const project = compileContentProject(source);
test('Rover introduces one explicit domain rule, then practices escape choices without a campaign speed reset', () => {
  assert.equal(source.actorCatalogId, ROVER_ACTOR_CATALOG.id);
  assert.equal(source.missions.length, 7);
  assert.equal(
    source.missions[0].design.difficulty.band,
    createNeonCandidates().missions.at(-2).design.difficulty.band,
  );
  assert.deepEqual(
    ROVER_ARCS.map((arc) => arc.missionIds.length),
    [3, 3],
  );
  assert.deepEqual(
    ROVER_ARCS.map((arc) => arc.introduces),
    ['reclaimed-roamer', null],
  );
  const geometries = new Set();
  let band = 5;
  for (const [index, mission] of source.missions.entries()) {
    assert.deepEqual(mission.design.introduces, index === 0 ? ['reclaimed-roamer'] : []);
    assert(mission.design.difficulty.band >= band);
    band = mission.design.difficulty.band;
    assert.deepEqual(mission.modes, ['solo', 'versus']);
    assert.equal(mission.timeLimitSeconds, 0);
    assert.equal(mission.presentation.backgroundAssetId, null);
    assert(mission.actors.some((actor) => actor.role === 'reclaimed-roamer'));
    assert(mission.actors.every((actor) => actor.tier === 'measured'));
    for (const role of new Set(mission.actors.map((actor) => actor.role)))
      assert(mission.design.combines.includes(role));
    geometries.add(project.maps.find((map) => map.source.id === mission.map.id).geometryIdentity);
    for (const difficulty of ['gentle', 'standard', 'expert'])
      for (const mode of mission.modes) {
        const manifest = resolveMission(project, mission.id, { difficulty, mode });
        assert.equal(manifest.level.rules.moveSpeed, 10);
        assert.equal(manifest.officialProgressEligible, false);
        assert(
          !manifest.diagnostics.some(
            (item) => item.severity === 'error' || /auto-fill/.test(item.code),
          ),
          mission.id,
        );
      }
  }
  assert.equal(geometries.size, 7);
  assert.equal(resolveContentJourney(project, { packIds: ['journey-rover'] }).missions.length, 6);
  assert.throws(() => resolveContentJourney(project, { mode: 'team' }), /no missions/);
});

test('all initial field regions retain real field keepers, never dormant roamers', () => {
  for (const mission of source.missions) {
    const run = createRun(resolveMission(project, mission.id).level, { seed: 1, classId: 'scout' });
    const snapshot = inspectCaptureSnapshot(run);
    assert.equal(snapshot.filledCells.length, 0, mission.id);
    assert(
      snapshot.components.every((component) => component.retained),
      mission.id,
    );
    const retainers = new Set(snapshot.components.flatMap((component) => component.enemyIds));
    for (const actor of mission.actors)
      assert.equal(
        retainers.has(actor.id),
        actor.role === 'field-keeper',
        `${mission.id}/${actor.id}`,
      );
    if (mission.id === 'sorting-yard') assert.equal(snapshot.components.length, 2);
  }
});

test('every Rover candidate has a no-loss first return and five seconds of initial decision space in all presets/controls', () => {
  for (const mission of source.missions)
    for (const difficulty of ['gentle', 'standard', 'expert'])
      for (const turnPolicy of ['immediate', 'grid-center']) {
        const level = resolveMission(project, mission.id, { difficulty }).level;
        const options = { seed: 1, classId: 'scout', turnPolicy };
        const idle = createRun(level, options);
        for (let tick = 0; tick < 600; tick++) stepRun(idle, { direction: null }, FIXED_DT);
        assert.equal(idle.classic.livesLost, 0, `${mission.id}: spawn decision space`);
        const run = createRun(level, options);
        const denominator = run.totalClaimable;
        for (let tick = 0; tick < 1200 && !run.claimedCount && run.status === 'running'; tick++) {
          stepRun(run, { direction: ROVER_FIRST_RETURNS[mission.id] }, FIXED_DT);
          assert.equal(run.classic.livesLost, 0, `${mission.id}/${difficulty}/${turnPolicy}`);
        }
        assert(run.claimedCount > 0, mission.id);
        assert.notEqual(run.status, 'won', 'A first return is not a complete campaign challenge');
        assert.equal(run.totalClaimable, denominator);
      }
});

test('the introduction demonstrates capture-triggered warning without requiring body contact', () => {
  for (const difficulty of ['gentle', 'standard', 'expert'])
    for (const turnPolicy of ['immediate', 'grid-center']) {
      const run = createRun(resolveMission(project, 'wake-the-yard', { difficulty }).level, {
        seed: 1,
        classId: 'scout',
        turnPolicy,
      });
      const sleeper = run.enemies.find((actor) => actor.id === 'sleeper');
      assert.equal(sleeper.classic.mode, 'dormant');
      for (const direction of ['down', 'left']) {
        const before = run.claimedCount;
        for (let tick = 0; tick < 1200 && run.claimedCount === before; tick++) {
          stepRun(run, { direction }, FIXED_DT);
          assert.equal(run.classic.livesLost, 0);
          assert.equal(run.status, 'running');
        }
        assert(run.claimedCount > before);
      }
      assert.equal(sleeper.classic.mode, 'warning');
      assert.equal(sleeper.classic.activationTick - run.classic.actorTick, 120);
      assert(Math.hypot(run.player.x - sleeper.x, run.player.y - sleeper.y) > 8);
    }
});

test('revised practice and combination maps expose a warned active roamer without requiring capture', () => {
  for (const id of ['stepped-return', 'broken-yard'])
    for (const difficulty of ['gentle', 'standard', 'expert'])
      for (const turnPolicy of ['immediate', 'grid-center']) {
        const manifest = resolveMission(project, id, { difficulty });
        assert.equal(source.missions.find((mission) => mission.id === id).revision, 'greybox-2');
        const run = createRun(manifest.level, { seed: 1, classId: 'scout', turnPolicy });
        const roamer = run.enemies.find((actor) => actor.id === 'sleeper');
        for (let tick = 0; tick < 121; tick++) stepRun(run, { direction: null }, FIXED_DT);
        assert.equal(roamer.classic.mode, 'active');
        assert.equal(run.claimedCount, 0);
        assert.equal(run.classic.livesLost, 0);
        assert(Math.hypot(run.player.x - roamer.x, run.player.y - roamer.y) > 8);
      }
});

test('all six assigned reference proposals have explicit original non-final dispositions', async () => {
  const ledger = JSON.parse(
    await readFile(new URL('../../docs/research/xposed-journey-ledger.json', import.meta.url)),
  );
  assert.deepEqual(
    ROVER_REFERENCE_ADAPTATIONS.map((row) => row.reference).sort(),
    ledger.references
      .filter((row) => row.proposal?.campaign === 'Rover Yard')
      .map((row) => row.designKey)
      .sort(),
  );
  for (const row of ROVER_REFERENCE_ADAPTATIONS) {
    assert.equal(row.final, false);
    assert.equal(row.decision, 'redesign');
    assert(source.missions.some((mission) => mission.id === row.missionId));
  }
});
