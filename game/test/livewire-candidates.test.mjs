import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createLivewireCandidates,
  LIVEWIRE_ARCS,
  LIVEWIRE_FIRST_RETURNS,
  LIVEWIRE_REFERENCE_ADAPTATIONS,
} from '../content-design/livewire-candidates.mjs';
import { createPhaseCandidates } from '../content-design/phase-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { resolveContentJourney } from '../content-design/journey.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplay } from '../replay.mjs';
import { missionBriefing } from '../mission-brief.mjs';

const source = createLivewireCandidates(),
  project = compileContentProject(source);

test('Livewire advances spatial decisions without shortening warnings or resetting the challenge band', () => {
  assert.equal(source.actorCatalogId, 'journey-actors-v5');
  assert.equal(
    source.missions[0].design.difficulty.band,
    createPhaseCandidates().missions.at(-2).design.difficulty.band,
  );
  assert.deepEqual(
    LIVEWIRE_ARCS.map((a) => a.missionIds.length),
    [3, 3],
  );
  assert.deepEqual(
    LIVEWIRE_ARCS.map((a) => a.introduces),
    ['locked-lane-attacks', null],
  );
  const geometry = new Set();
  let band = 8;
  for (const [index, mission] of source.missions.entries()) {
    assert.deepEqual(mission.design.introduces, index ? [] : ['locked-lane-attacks']);
    assert(mission.design.difficulty.band >= band);
    band = mission.design.difficulty.band;
    assert.equal(mission.timeLimitSeconds, 0);
    assert.equal(mission.objectives.length, 0);
    assert.equal(mission.bonuses.length, 0);
    assert.equal(mission.presentation.backgroundAssetId, null);
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
      const emitters = solo.level.enemies.filter((a) => a.type === 'lane-boss');
      assert(emitters.length > 0);
      for (const actor of emitters) {
        assert.equal(actor.warningSeconds, 1.5);
        assert.equal(actor.activeSeconds, 0.7);
        assert.equal(actor.period, 6);
      }
      assert(!solo.officialProgressEligible);
      assert(
        !solo.diagnostics.some((d) => d.severity === 'error' || /auto-fill/.test(d.code)),
        mission.id,
      );
      const card = missionBriefing(solo.level);
      assert.match(card.copy, /Lanes lock, warn, then fire/);
      assert(card.copy.length <= 240, `${mission.id}: ${card.copy.length}`);
    }
  }
  assert.equal(geometry.size, 7);
  assert.equal(
    resolveContentJourney(project, { packIds: ['journey-livewire'] }).missions.length,
    6,
  );
  assert.throws(() => resolveContentJourney(project, { mode: 'team' }), /no missions/);
});

test('each initial region has a real field-retaining anchor, including stationary emitters', () => {
  for (const mission of source.missions) {
    const capture = inspectCaptureSnapshot(createRun(resolveMission(project, mission.id).level));
    assert.equal(capture.filledCells.length, 0, mission.id);
    assert(
      capture.components.every((c) => c.retained),
      mission.id,
    );
    const anchors = new Set(capture.components.flatMap((c) => c.enemyIds));
    for (const actor of mission.actors)
      assert.equal(
        anchors.has(actor.id),
        ['lane-emitter', 'field-keeper', 'territory-eroder', 'impact-carrier'].includes(actor.role),
        `${mission.id}/${actor.id}`,
      );
  }
});

for (const difficulty of ['gentle', 'standard', 'expert'])
  for (const turnPolicy of ['immediate', 'grid-center'])
    test(`${difficulty}/${turnPolicy}: five seconds of decision space and a legal non-trivial first return`, () => {
      for (const mission of source.missions) {
        const level = resolveMission(project, mission.id, { difficulty }).level;
        const options = { seed: 1, classId: 'scout', turnPolicy };
        const idle = createRun(level, options);
        for (let tick = 0; tick < 600; tick++) stepRun(idle, { direction: null }, FIXED_DT);
        assert.equal(idle.classic.livesLost, 0, `${mission.id}: decision space`);
        const run = createRun(level, options),
          recorder = createRecorder(level, options);
        const denominator = run.totalClaimable;
        let warningTick = null;
        for (let tick = 0; tick < 1200 && !run.claimedCount && run.status === 'running'; tick++) {
          const input = { direction: LIVEWIRE_FIRST_RETURNS[mission.id] };
          recordInput(recorder, input);
          stepRun(run, input, FIXED_DT);
          if (run.events.some((e) => e.type === 'boss.warning')) warningTick ??= run.tick;
          assert.equal(run.classic.livesLost, 0, `${mission.id}: departure at ${run.tick}`);
        }
        assert(run.claimedCount > 0, mission.id);
        assert.notEqual(run.status, 'won', `${mission.id}: trivial first-cut clear`);
        assert.equal(run.totalClaimable, denominator);
        if (mission.id === 'read-the-lock') {
          assert(
            warningTick !== null && run.tick - warningTick >= 60,
            'First cut visibly receives a lock before closing.',
          );
          assert(run.enemies.some((a) => a.type === 'lane-boss' && a.bossPhase === 'warning'));
        }
        assert.equal(verifyReplay(exportReplay(recorder, run)).match, true, mission.id);
      }
    });

test('all three assigned references remain non-final proposals and Studio previews use exact compiled levels', async () => {
  const ledger = JSON.parse(
    await readFile(new URL('../../docs/research/xposed-journey-ledger.json', import.meta.url)),
  );
  assert.deepEqual(
    LIVEWIRE_REFERENCE_ADAPTATIONS.map((r) => r.reference).sort(),
    ledger.references
      .filter((r) => r.proposal?.campaign === 'Livewire Foundry')
      .map((r) => r.designKey)
      .sort(),
  );
  assert(LIVEWIRE_REFERENCE_ADAPTATIONS.every((r) => r.decision === 'redesign' && !r.final));
  for (const mission of source.missions) {
    const preview = prepareContentPreview(source, mission.id);
    assert.deepEqual(preview.manifest.level, resolveMission(project, mission.id).level);
    assert.equal(preview.scenario, null);
    assert(preview.capture.components.every((c) => c.retained));
  }
});
