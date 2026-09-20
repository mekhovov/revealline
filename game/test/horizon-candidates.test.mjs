import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createOpeningCandidates, OPENING_ARCS } from '../content-design/horizon-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';

test('opening greyboxes form three learning arcs without a campaign threat reset', () => {
  const source = createOpeningCandidates(),
    project = compileContentProject(source);
  assert.equal(project.missions.length, 10);
  let previousBand = 0,
    previousActors = 0;
  for (const mission of project.missions) {
    assert(mission.design.difficulty.band >= previousBand);
    assert(mission.actors.length >= previousActors);
    assert.equal(mission.timeLimitSeconds, 0);
    assert.equal(
      mission.presentation.backgroundAssetId,
      null,
      'No greybox pretends to have finished art',
    );
    const preview = prepareContentPreview(source, mission.id);
    assert(
      preview.capture.components.every((c) => c.retained),
      `${mission.id} has an unintended empty starting chamber`,
    );
    assert.equal(preview.manifest.officialProgressEligible, false);
    previousBand = mission.design.difficulty.band;
    previousActors = mission.actors.length;
  }
  assert.equal(new Set(project.missions.map((m) => m.design.routeDecision)).size, 10);
  assert.equal(project.packs[0].campaignIds.includes('horizon-remixes'), false);
  assert.deepEqual(project.missions.at(-1).design.introduces, []);
  for (const arc of OPENING_ARCS) {
    assert(arc.missionIds.length >= 3 && arc.missionIds.length <= 5);
    const introduced = arc.missionIds.flatMap(
      (id) => project.missions.find((m) => m.id === id).design.introduces,
    );
    assert.deepEqual(introduced, arc.introduces ? [arc.introduces] : []);
  }
});

test('all ten Standard candidates have replay-verifiable complete legal routes, not human pacing evidence', async () => {
  const fixture = JSON.parse(
    await readFile(new URL('./fixtures/horizon-greybox-routes.json', import.meta.url)),
  );
  const project = compileContentProject(createOpeningCandidates());
  assert.equal(fixture.rows.length, project.missions.length);
  assert.deepEqual(
    fixture.rows.map((row) => row[0]),
    project.missions.map((m) => m.id),
  );
  for (const [id, identity, checkpoint, segments] of fixture.rows) {
    const manifest = resolveMission(project, id);
    assert.equal(manifest.simulationIdentity, identity, `${id}: route requires renewed review`);
    const options = { seed: 1, classId: 'scout', turnPolicy: 'immediate' };
    const run = createRun(manifest.level, options),
      recorder = createRecorder(
        manifest.level,
        options,
        'greybox-feasibility-not-human-validation',
      );
    for (const [direction, ticks] of segments) {
      assert(Number.isSafeInteger(ticks) && ticks > 0 && ticks <= 1000);
      for (let tick = 0; tick < ticks; tick++) {
        assert.equal(run.status, 'running', `${id}: route outlived the run`);
        recordInput(recorder, { direction });
        stepRun(run, { direction }, FIXED_DT);
        assert.equal(run.lives, 3, `${id}: route lost a life`);
      }
    }
    assert.equal(run.status, 'won', id);
    assert(run.coverage >= manifest.level.goal.coverage);
    assert.equal(authoritativeCheckpoint(run).hash, checkpoint, id);
    const verified = verifyReplay(exportReplay(recorder, run));
    assert.equal(verified.match, true, `${id}: replay mismatched`);
    assert.equal(verified.state.status, 'won');
  }
});

test('each greybox has a deterministic legal first return; this is not a full-clear or duration claim', () => {
  const project = compileContentProject(createOpeningCandidates());
  const departures = {
    'first-return': 'down',
    'choose-your-share': 'down',
    'two-keepers': 'down',
    'nearby-shore': 'down',
    'island-outpost': 'left',
    'stepping-stones': 'down',
    'two-bays': 'left',
    'courtyard-return': 'left',
    'long-way-home': 'left',
    'horizon-remix': 'left',
  };
  for (const mission of project.missions) {
    const manifest = resolveMission(project, mission.id);
    const run = createRun(manifest.level, { seed: 1 });
    const lives = run.lives;
    for (let tick = 0; tick < 600 && run.claimedCount === 0; tick++)
      stepRun(run, { direction: departures[mission.id] }, FIXED_DT);
    assert(run.claimedCount > 0, `${mission.id}: first return did not close`);
    assert.equal(run.lives, lives, `${mission.id}: opening route contact`);
    assert.equal(run.player.speed, 0);
    assert.equal(run.score, run.classic.uniqueClaimedCount * 10);
  }
});

test('the five remaining preset/control combinations have independent complete replay-verified routes', async () => {
  const fixture = JSON.parse(
    await readFile(new URL('./fixtures/horizon-preset-routes.json', import.meta.url)),
  );
  const project = compileContentProject(createOpeningCandidates());
  const expected = [
    'gentle/immediate',
    'gentle/grid-center',
    'standard/grid-center',
    'expert/immediate',
    'expert/grid-center',
  ];
  assert.deepEqual(
    fixture.sets.map((set) => `${set.difficulty}/${set.turnPolicy}`),
    expected,
  );
  for (const { difficulty, turnPolicy, rows } of fixture.sets) {
    assert.deepEqual(
      rows.map((row) => row[0]),
      project.missions.map((mission) => mission.id),
    );
    for (const [id, identity, checkpoint, segments] of rows) {
      const label = `${difficulty}/${turnPolicy}/${id}`;
      const manifest = resolveMission(project, id, { difficulty });
      assert.equal(manifest.simulationIdentity, identity, `${label}: renew route evidence`);
      const options = { seed: 1, classId: 'scout', turnPolicy };
      const run = createRun(manifest.level, options);
      const recorder = createRecorder(
        manifest.level,
        options,
        'greybox-feasibility-not-human-validation',
      );
      for (const [direction, ticks] of segments) {
        assert(Number.isSafeInteger(ticks) && ticks > 0 && ticks <= 1000);
        for (let tick = 0; tick < ticks; tick++) {
          assert.equal(run.status, 'running', `${label}: route outlived the run`);
          recordInput(recorder, { direction });
          stepRun(run, { direction }, FIXED_DT);
          assert.equal(run.lives, manifest.level.rules.lives, `${label}: lost a life`);
        }
      }
      assert.equal(run.status, 'won', label);
      assert(run.coverage >= manifest.level.goal.coverage, label);
      assert.equal(authoritativeCheckpoint(run).hash, checkpoint, label);
      const verified = verifyReplay(exportReplay(recorder, run));
      assert.equal(verified.match, true, `${label}: replay mismatched`);
      assert.equal(verified.state.status, 'won', label);
    }
  }
});

test('the first natural enclosure completes the lesson without fractional quota cleanup in every preset and control policy', () => {
  const project = compileContentProject(createOpeningCandidates());
  for (const difficulty of ['gentle', 'standard', 'expert'])
    for (const turnPolicy of ['immediate', 'grid-center']) {
      const manifest = resolveMission(project, 'first-return', { difficulty });
      const run = createRun(manifest.level, { seed: 1, turnPolicy });
      for (let tick = 0; tick < 600 && run.claimedCount === 0; tick++)
        stepRun(run, { direction: 'down' }, FIXED_DT);
      assert.equal(run.status, 'won', `${difficulty}/${turnPolicy}`);
      assert.equal(run.lives, manifest.level.rules.lives);
      assert.equal(
        run.coverage,
        816 / 2380,
        'Victory presentation must not rewrite earned coverage',
      );
    }
});
