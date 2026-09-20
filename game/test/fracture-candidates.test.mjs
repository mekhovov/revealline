import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createFractureCandidates,
  FRACTURE_ARCS,
  FRACTURE_FIRST_RETURNS,
  FRACTURE_REFERENCE_ADAPTATIONS,
} from '../content-design/fracture-candidates.mjs';
import { createRoverCandidates } from '../content-design/rover-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { resolveContentJourney } from '../content-design/journey.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';
import { FRACTURE_ACTOR_CATALOG } from '../content-design/catalogs.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';

const source = createFractureCandidates(),
  project = compileContentProject(source);

test('the rejected central-anchor route preserves real quota-cleanup evidence before the revision', async () => {
  const rejected = JSON.parse(
    await readFile(new URL('./fixtures/fracture-rejected-cleanup-r1.json', import.meta.url)),
  );
  const row = rejected.rows[0],
    old = createFractureCandidates();
  const mission = old.missions.find((m) => m.id === row.id);
  mission.revision = 'greybox-1';
  mission.map.revision = 'greybox-1';
  old.maps.find((map) => map.id === mission.map.id).revision = 'greybox-1';
  for (const objective of mission.objectives) objective.y = 18.5;
  const manifest = resolveMission(compileContentProject(old), row.id);
  assert.equal(manifest.simulationIdentity, row.simulationIdentity);
  const options = { seed: 1, classId: 'scout', turnPolicy: row.turnPolicy };
  const run = createRun(manifest.level, options),
    recorder = createRecorder(manifest.level, options);
  let cleanupTick = null;
  for (const segment of row.segments)
    for (let tick = 0; tick < segment.ticks; tick++) {
      const input = { direction: segment.direction };
      recordInput(recorder, input);
      stepRun(run, input, FIXED_DT);
      if (run.coverage >= mission.coverage && run.objectives.every((o) => !o.captured))
        cleanupTick ??= run.tick;
    }
  assert.equal(run.status, 'won');
  assert.equal(run.classic.livesLost, 0);
  assert.equal(cleanupTick, 3450);
  assert(run.tick - cleanupTick > 900);
  assert.equal(authoritativeCheckpoint(run).hash, row.checkpoint);
  assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
  assert.notEqual(resolveMission(project, row.id).simulationIdentity, row.simulationIdentity);
});

test('Fractured Grid separates erosion and anchor lessons while retaining the preceding challenge band', () => {
  assert.equal(source.actorCatalogId, FRACTURE_ACTOR_CATALOG.id);
  assert.equal(source.missions.length, 7);
  assert.equal(
    source.missions[0].design.difficulty.band,
    createRoverCandidates().missions.at(-2).design.difficulty.band,
  );
  assert.deepEqual(
    FRACTURE_ARCS.map((arc) => arc.missionIds.length),
    [3, 3],
  );
  assert.deepEqual(
    FRACTURE_ARCS.map((arc) => arc.introduces),
    ['territory-erosion', 'captured-anchor-protection'],
  );
  let band = 6;
  const geometries = new Set();
  for (const [index, mission] of source.missions.entries()) {
    assert.deepEqual(
      mission.design.introduces,
      index === 0 ? ['territory-erosion'] : index === 3 ? ['captured-anchor-protection'] : [],
    );
    assert(mission.design.difficulty.band >= band);
    band = mission.design.difficulty.band;
    assert.deepEqual(mission.modes, ['solo', 'versus']);
    assert.equal(mission.timeLimitSeconds, 0);
    assert.equal(mission.presentation.backgroundAssetId, null);
    assert(mission.actors.some((actor) => actor.role === 'territory-eroder'));
    assert(mission.actors.every((actor) => actor.tier === 'measured'));
    assert(new Set(mission.actors.map((actor) => actor.role)).size <= 3);
    assert.equal(mission.objectives.length > 0, index >= 3);
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
  assert.equal(
    resolveContentJourney(project, { packIds: ['journey-fracture'] }).missions.length,
    6,
  );
  assert.throws(() => resolveContentJourney(project, { mode: 'team' }), /no missions/);
});

test('every initial region has a real field-retaining actor and divided districts stay separate', () => {
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
        ['field-keeper', 'territory-eroder'].includes(actor.role),
        `${mission.id}/${actor.id}`,
      );
    if (mission.id === 'two-districts') assert.equal(snapshot.components.length, 2);
  }
});

test('all candidates allow five seconds to choose and a no-loss first return in every preset/control pair', () => {
  for (const mission of source.missions)
    for (const difficulty of ['gentle', 'standard', 'expert'])
      for (const turnPolicy of ['immediate', 'grid-center']) {
        const level = resolveMission(project, mission.id, { difficulty }).level;
        const options = { seed: 1, classId: 'scout', turnPolicy };
        const idle = createRun(level, options);
        for (let tick = 0; tick < 600; tick++) stepRun(idle, { direction: null }, FIXED_DT);
        assert.equal(idle.classic.livesLost, 0, `${mission.id}/${difficulty}: decision space`);
        const run = createRun(level, options),
          denominator = run.totalClaimable;
        for (let tick = 0; tick < 1200 && !run.claimedCount && run.status === 'running'; tick++) {
          stepRun(run, { direction: FRACTURE_FIRST_RETURNS[mission.id] }, FIXED_DT);
          assert.equal(
            run.classic.livesLost,
            0,
            `${mission.id}/${difficulty}/${turnPolicy}: departure`,
          );
        }
        assert(run.claimedCount > 0, mission.id);
        assert.notEqual(
          run.status,
          'won',
          'A first return must not finish the campaign challenge.',
        );
        assert.equal(run.totalClaimable, denominator);
      }
});

test('five assigned reference motifs have original, explicitly non-final adaptation proposals', async () => {
  const ledger = JSON.parse(
    await readFile(new URL('../../docs/research/xposed-journey-ledger.json', import.meta.url)),
  );
  assert.deepEqual(
    FRACTURE_REFERENCE_ADAPTATIONS.map((row) => row.reference).sort(),
    ledger.references
      .filter((row) => row.proposal?.campaign === 'Fractured Grid')
      .map((row) => row.designKey)
      .sort(),
  );
  for (const row of FRACTURE_REFERENCE_ADAPTATIONS) {
    assert.equal(row.final, false);
    assert.equal(row.decision, 'redesign');
    assert(source.missions.some((mission) => mission.id === row.missionId));
  }
});
