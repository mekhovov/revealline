import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSignalCandidates,
  SIGNAL_ARCS,
  SIGNAL_FIRST_RETURNS,
} from '../content-design/signal-candidates.mjs';
import { createBorderCandidates } from '../content-design/border-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { resolveContentJourney } from '../content-design/journey.mjs';
import { ACTOR_CATALOG } from '../content-design/catalogs.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';

function opening(manifest, turnPolicy) {
  const run = createRun(manifest.level, { seed: 1, classId: 'scout', turnPolicy });
  for (let tick = 0; tick < 1000 && !run.claimedCount; tick++) {
    stepRun(run, { direction: SIGNAL_FIRST_RETURNS[manifest.missionId] }, FIXED_DT);
    assert.equal(run.lives, manifest.level.rules.lives, `${manifest.missionId}: opening life loss`);
  }
  assert(run.claimedCount > 0, `${manifest.missionId}: no legal first closure`);
  assert.equal(run.player.speed, 0);
  assert(run.classic.powerups.every((pickup) => pickup.collectedTick === null));
  return run;
}

test('Signal Gardens continues band three with two focused material arcs and an optional known-rule Remix', () => {
  const source = createSignalCandidates(),
    project = compileContentProject(source);
  assert.equal(project.missions.length, 7);
  assert.equal(
    project.missions[0].design.difficulty.band,
    createBorderCandidates().missions.find((mission) => mission.id === 'return-pocket').design
      .difficulty.band,
  );
  for (const arc of SIGNAL_ARCS) {
    assert.equal(arc.missionIds.length, 3);
    assert.deepEqual(
      arc.missionIds.flatMap(
        (id) => project.missions.find((mission) => mission.id === id).design.introduces,
      ),
      [arc.introduces],
    );
    assert(
      project.missions
        .find((mission) => mission.id === arc.missionIds[1])
        .design.practices.includes(arc.introduces),
    );
  }
  assert.deepEqual(project.missions.at(-1).design.introduces, []);
  assert.equal(resolveContentJourney(source, { packIds: ['journey-signal'] }).missions.length, 6);
  assert.equal(resolveContentJourney(source, { packIds: ['signal-remixes'] }).missions.length, 1);
  assert.equal(new Set(project.missions.map((mission) => mission.design.routeDecision)).size, 7);
  let band = 3;
  for (const mission of project.missions) {
    assert(mission.design.difficulty.band >= band);
    band = mission.design.difficulty.band;
    assert.equal(mission.timeLimitSeconds, 0);
    assert.equal(mission.presentation.backgroundAssetId, null);
    assert.equal(mission.design.difficulty.timePressure, 0);
    assert(mission.actors.every((actor) => actor.tier === 'measured'));
    assert.equal(
      mission.actors.filter((actor) => ACTOR_CATALOG.roles[actor.role].retainsField).length,
      2,
    );
    assert(new Set(mission.actors.map((actor) => actor.role)).size <= 3);
    const preview = prepareContentPreview(source, mission.id);
    assert(
      preview.capture.components.every((component) => component.retained),
      `${mission.id}: unintended initial auto-fill`,
    );
    assert(!preview.manifest.diagnostics.some((row) => row.severity === 'error'), mission.id);
    assert.equal(preview.manifest.officialProgressEligible, false);
  }
  for (const id of SIGNAL_ARCS[0].missionIds)
    assert(
      project.maps
        .find((map) => map.source.id === `${id}-map`)
        .source.terrain.every((area) => area.kind === 'slow'),
    );
  for (const id of SIGNAL_ARCS[1].missionIds.slice(0, 2))
    assert(
      project.maps
        .find((map) => map.source.id === `${id}-map`)
        .source.terrain.every((area) => area.kind === 'lethal'),
    );
});

test('all 42 preset/control openings close with unchanged handling, no life loss and no forced pickup', () => {
  const project = compileContentProject(createSignalCandidates());
  for (const difficulty of ['gentle', 'standard', 'expert'])
    for (const turnPolicy of ['immediate', 'grid-center'])
      for (const mission of project.missions) {
        const manifest = resolveMission(project, mission.id, { difficulty });
        assert.deepEqual(
          resolveMission(project, mission.id, { difficulty, mode: 'versus' }).level,
          manifest.level,
        );
        assert.equal(opening(manifest, turnPolicy).rules.moveSpeed, 10);
      }
});

test('all 42 openings remain identical when every optional bonus is removed', () => {
  const source = createSignalCandidates(),
    without = structuredClone(source);
  for (const mission of without.missions) mission.bonuses = [];
  const projects = [source, without].map(compileContentProject);
  for (const difficulty of ['gentle', 'standard', 'expert'])
    for (const turnPolicy of ['immediate', 'grid-center'])
      for (const mission of source.missions) {
        const [authored, omitted] = projects.map((project) =>
          opening(resolveMission(project, mission.id, { difficulty }), turnPolicy),
        );
        assert.equal(authored.tick, omitted.tick, mission.id);
        assert.equal(authored.lives, omitted.lives, mission.id);
        assert.deepEqual(authored.cells, omitted.cells, mission.id);
        assert.deepEqual(authored.enemies, omitted.enemies, mission.id);
      }
});

test('the first material lesson actually crosses slow ground, while the lethal introduction has a clear return', () => {
  const source = createSignalCandidates(),
    clear = structuredClone(source);
  clear.maps[0].terrain = [];
  const projects = [source, clear].map(compileContentProject);
  for (const difficulty of ['gentle', 'standard', 'expert'])
    for (const turnPolicy of ['immediate', 'grid-center']) {
      const [slow, normal] = projects.map((project) =>
        opening(resolveMission(project, 'soft-crossing', { difficulty }), turnPolicy),
      );
      assert.equal(slow.tick - normal.tick, 60, 'Five cells at half speed add half a second.');
      assert.equal(slow.claimedCount, normal.claimedCount);
      const intro = opening(
        resolveMission(projects[0], 'cool-the-crossing', { difficulty }),
        turnPolicy,
      );
      assert.equal(intro.classic.livesLost, 0);
    }
});
