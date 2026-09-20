import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createPhaseCandidates,
  PHASE_ARCS,
  PHASE_FIRST_RETURNS,
  PHASE_REFERENCE_ADAPTATIONS,
} from '../content-design/phase-candidates.mjs';
import { createFractureCandidates } from '../content-design/fracture-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { resolveContentJourney } from '../content-design/journey.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplay } from '../replay.mjs';

const source = createPhaseCandidates(),
  project = compileContentProject(source);

test('Phaseworks retains the prior challenge band with one new rule and a practice-only second arc', () => {
  assert.equal(source.actorCatalogId, 'journey-actors-v4');
  assert.equal(
    source.missions[0].design.difficulty.band,
    createFractureCandidates().missions.at(-2).design.difficulty.band,
  );
  assert.deepEqual(
    PHASE_ARCS.map((arc) => arc.missionIds.length),
    [3, 3],
  );
  assert.deepEqual(
    PHASE_ARCS.map((arc) => arc.introduces),
    ['selective-trail-impact', null],
  );
  let band = 7;
  const geometry = new Set();
  for (const [index, mission] of source.missions.entries()) {
    assert.deepEqual(mission.design.introduces, index ? [] : ['selective-trail-impact']);
    assert(mission.design.difficulty.band >= band);
    band = mission.design.difficulty.band;
    assert.equal(mission.timeLimitSeconds, 0);
    assert.equal(mission.objectives.length, 0);
    assert.equal(mission.presentation.backgroundAssetId, null);
    assert(mission.actors.some((a) => a.role === 'impact-carrier'));
    assert(mission.actors.every((a) => a.tier === 'measured'));
    assert(new Set(mission.actors.map((a) => a.role)).size <= 3);
    geometry.add(project.maps.find((map) => map.source.id === mission.map.id).geometryIdentity);
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const solo = resolveMission(project, mission.id, { difficulty });
      assert.deepEqual(
        resolveMission(project, mission.id, { difficulty, mode: 'versus' }).level,
        solo.level,
      );
      assert.equal(solo.level.rules.moveSpeed, 10);
      assert.equal(solo.level.classic.lineImpact.speed, 24);
      assert.deepEqual(
        solo.level.classic.lineImpact.actorIds,
        mission.actors
          .filter((a) => a.role === 'impact-carrier')
          .map((a) => a.id)
          .sort(),
      );
      assert(!solo.officialProgressEligible);
      assert(
        !solo.diagnostics.some((d) => d.severity === 'error' || /auto-fill/.test(d.code)),
        mission.id,
      );
    }
  }
  assert.equal(geometry.size, 7);
  assert.equal(resolveContentJourney(project, { packIds: ['journey-phase'] }).missions.length, 6);
  assert.throws(() => resolveContentJourney(project, { mode: 'team' }), /no missions/);
});

test('all initial regions retain real carrier/keeper anchors, never patrols or dormant roamers', () => {
  for (const mission of source.missions) {
    const run = createRun(resolveMission(project, mission.id).level);
    const snapshot = inspectCaptureSnapshot(run);
    assert.equal(snapshot.filledCells.length, 0, mission.id);
    assert(
      snapshot.components.every((c) => c.retained),
      mission.id,
    );
    const anchors = new Set(snapshot.components.flatMap((c) => c.enemyIds));
    for (const actor of mission.actors)
      assert.equal(
        anchors.has(actor.id),
        ['field-keeper', 'impact-carrier'].includes(actor.role),
        `${mission.id}/${actor.id}`,
      );
    if (mission.id === 'dogleg-transfer') assert.equal(snapshot.components.length, 2);
  }
});

for (const difficulty of ['gentle', 'standard', 'expert'])
  for (const turnPolicy of ['immediate', 'grid-center'])
    test(`${difficulty}/${turnPolicy}: every candidate allows decision space and a legal replayable first return`, () => {
      for (const mission of source.missions) {
        const level = resolveMission(project, mission.id, { difficulty }).level;
        const options = { seed: 1, classId: 'scout', turnPolicy };
        const idle = createRun(level, options);
        for (let tick = 0; tick < 600; tick++) stepRun(idle, { direction: null }, FIXED_DT);
        assert.equal(idle.classic.livesLost, 0, `${mission.id}: decision space`);
        const run = createRun(level, options),
          recorder = createRecorder(level, options);
        const denominator = run.totalClaimable;
        let impactTick = null,
          clearedAtClosure = false;
        for (let tick = 0; tick < 1200 && !run.claimedCount && run.status === 'running'; tick++) {
          const input = { direction: PHASE_FIRST_RETURNS[mission.id] };
          recordInput(recorder, input);
          stepRun(run, input, FIXED_DT);
          if (run.classic.lineImpact.fronts.length) impactTick ??= run.tick;
          if (run.events.some((event) => event.type === 'cut.closed'))
            clearedAtClosure = run.events.some(
              (event) => event.type === 'lineImpact.cleared' && event.reason === 'capture',
            );
          assert.equal(run.classic.livesLost, 0, `${mission.id}: departure`);
        }
        assert(run.claimedCount > 0, mission.id);
        assert.notEqual(
          run.status,
          'won',
          'The first return does not trivialize a campaign mission.',
        );
        assert.equal(run.totalClaimable, denominator);
        if (mission.id === 'return-in-reserve') {
          assert(
            impactTick !== null && run.tick - impactTick >= 29,
            'The first return must visibly demonstrate the travelling front in every preset.',
          );
          assert(clearedAtClosure, 'The actual closure clears the travelling front.');
          assert.equal(run.classic.lineImpact.fronts.length, 0);
        }
        assert.equal(verifyReplay(exportReplay(recorder, run)).match, true, mission.id);
      }
    });

test('Studio uses the exact all-preset compiler and does not reinterpret the four assigned references', async () => {
  const ledger = JSON.parse(
    await readFile(new URL('../../docs/research/xposed-journey-ledger.json', import.meta.url)),
  );
  assert.deepEqual(
    PHASE_REFERENCE_ADAPTATIONS.map((r) => r.reference).sort(),
    ledger.references
      .filter((r) => r.proposal?.campaign === 'Phaseworks')
      .map((r) => r.designKey)
      .sort(),
  );
  assert(PHASE_REFERENCE_ADAPTATIONS.every((r) => r.decision === 'redesign' && r.final === false));
  const before = JSON.stringify(source);
  for (const mission of source.missions)
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const preview = prepareContentPreview(source, mission.id, { difficulty });
      assert.deepEqual(preview.manifest, resolveMission(project, mission.id, { difficulty }));
      assert.equal(preview.capture.filledCells.length, 0);
    }
  assert.equal(JSON.stringify(source), before);
});
