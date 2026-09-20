import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBorderCandidates,
  BORDER_ARCS,
  BORDER_FIRST_RETURNS,
} from '../content-design/border-candidates.mjs';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { resolveContentJourney } from '../content-design/journey.mjs';
import { ACTOR_CATALOG } from '../content-design/catalogs.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';

test('Border greyboxes extend the opening band through two one-rule arcs and an optional known-rule Remix', () => {
  const source = createBorderCandidates(),
    project = compileContentProject(source);
  const opening = compileContentProject(createOpeningCandidates());
  assert.equal(project.missions.length, 7);
  assert.equal(
    project.missions[0].design.difficulty.band,
    opening.missions.find((m) => m.id === 'long-way-home').design.difficulty.band,
  );
  assert.equal(new Set(project.missions.map((m) => m.design.routeDecision)).size, 7);
  for (const arc of BORDER_ARCS) {
    assert(arc.missionIds.length >= 3 && arc.missionIds.length <= 5);
    assert.deepEqual(
      arc.missionIds.flatMap((id) => project.missions.find((m) => m.id === id).design.introduces),
      [arc.introduces],
    );
  }
  assert.deepEqual(project.missions.at(-1).design.introduces, []);
  assert.equal(resolveContentJourney(source, { packIds: ['journey-border'] }).missions.length, 6);
  assert.equal(resolveContentJourney(source, { packIds: ['border-remixes'] }).missions.length, 1);
  assert.deepEqual(
    [...new Set(project.missions.flatMap((m) => m.bonuses.map((b) => b.kind)))].sort(),
    ['enemy-freeze', 'enemy-slow', 'extra-life', 'player-speed'],
  );
  let band = 2;
  for (const mission of project.missions) {
    assert(mission.design.difficulty.band >= band);
    band = mission.design.difficulty.band;
    assert.equal(mission.timeLimitSeconds, 0);
    assert.equal(mission.presentation.backgroundAssetId, null);
    assert.equal(
      mission.actors.filter((actor) => ACTOR_CATALOG.roles[actor.role].retainsField).length,
      2,
    );
    assert(mission.actors.every((actor) => actor.tier === 'measured'));
    const preview = prepareContentPreview(source, mission.id);
    assert(
      preview.capture.components.every((component) => component.retained),
      `${mission.id}: unoccupied initial chamber`,
    );
    assert(!preview.manifest.diagnostics.some((item) => item.severity === 'error'), mission.id);
    assert.equal(preview.manifest.officialProgressEligible, false);
  }
});

test('all 42 preset/control openings close legally without losing life or collecting a required bonus', () => {
  const project = compileContentProject(createBorderCandidates());
  for (const difficulty of ['gentle', 'standard', 'expert'])
    for (const turnPolicy of ['immediate', 'grid-center'])
      for (const mission of project.missions) {
        const manifest = resolveMission(project, mission.id, { difficulty });
        const run = createRun(manifest.level, { seed: 1, classId: 'scout', turnPolicy });
        const lives = run.lives,
          label = `${mission.id}/${difficulty}/${turnPolicy}`;
        for (let tick = 0; tick < 1000 && run.claimedCount === 0; tick++) {
          stepRun(run, { direction: BORDER_FIRST_RETURNS[mission.id] }, FIXED_DT);
          assert.equal(run.lives, lives, `${label}: lost life before first closure`);
        }
        assert(run.claimedCount > 0, `${label}: no first closure`);
        assert.equal(run.player.speed, 0, `${label}: stop on capture`);
        assert.equal(run.rules.moveSpeed, 10);
        assert(
          run.classic.powerups.every((pickup) => pickup.collectedTick === null),
          `${label}: forced opening pickup`,
        );
      }
});

test('bonuses can be omitted without invalidating any opening or changing its uncollected first closure', () => {
  const source = createBorderCandidates(),
    withoutBonuses = structuredClone(source);
  for (const mission of withoutBonuses.missions) mission.bonuses = [];
  const projects = [source, withoutBonuses].map(compileContentProject);
  for (const mission of source.missions) {
    const runs = projects.map((project) =>
      createRun(resolveMission(project, mission.id).level, { seed: 1 }),
    );
    for (const run of runs)
      for (let tick = 0; tick < 1000 && run.claimedCount === 0; tick++)
        stepRun(run, { direction: BORDER_FIRST_RETURNS[mission.id] }, FIXED_DT);
    assert.equal(runs[0].claimedCount, runs[1].claimedCount, mission.id);
    assert.equal(runs[0].tick, runs[1].tick, mission.id);
    assert.equal(runs[0].lives, runs[1].lives, mission.id);
  }
});
