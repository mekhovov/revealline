import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpeningCandidates, OPENING_ARCS } from '../content-design/horizon-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';

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
