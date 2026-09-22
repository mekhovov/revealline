import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTeamRoamerCandidates,
  TEAM_ROAMER_CANDIDATES,
  TEAM_ROAMER_FIRST_RETURNS,
} from '../content-design/team-roamer-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createTeamCampaignTestPack } from '../content-design/team-export.mjs';
import { resolveContentJourney } from '../content-design/journey.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { inspectContentPacing } from '../content-design/pacing.mjs';
import { readCoopPack } from '../coop/library.mjs';
import { createCoop, startCoop, stepCoop, SAFE, FIELD } from '../coop/core.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';
import { createTeamFoundationEvidence } from './helpers/team-foundation-goal.mjs';
import { inspectTeamRoamerGoal } from './helpers/team-roamer-goal.mjs';

const source = createTeamRoamerCandidates(),
  before = structuredClone(source),
  project = compileContentProject(source);
const command = (direction) => ({ direction, boost: false, support: false });
test('four Team capture-consequence layouts use one newly qualified role and consistent controls', () => {
  assert.equal(project.missions.length, 4);
  assert.equal(
    new Set(source.maps.map((map) => JSON.stringify([map.walls, map.foundations, map.terrain])))
      .size,
    4,
  );
  assert.deepEqual(
    source.missions.flatMap((mission) => mission.design.introduces),
    ['team-reclaimed-roamers'],
  );
  const pacing = inspectContentPacing(project, { mode: 'team' });
  assert.equal(pacing.timedFraction, 0);
  assert.deepEqual(
    pacing.rows.map((row) => row.rating.band),
    [5, 5, 6, 6],
  );
  assert.equal(pacing.diagnostics.length, 0);
  for (const layout of TEAM_ROAMER_CANDIDATES)
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const manifest = resolveMission(project, layout.id, { mode: 'team', difficulty });
      assert.equal(manifest.level.version, 'revealline-coop-level.v4');
      assert.deepEqual(manifest.level.rules, { moveSpeed: 10, boostMultiplier: 1 });
      assert.equal(manifest.background, null);
      assert.equal(manifest.officialProgressEligible, false);
      assert(!manifest.diagnostics.some((d) => d.severity === 'error'));
      const run = createCoop(manifest.level),
        preview = prepareContentPreview(project, layout.id, { mode: 'team', difficulty });
      assert.deepEqual([...run.cells], preview.geometry.cells);
      assert.equal(run.totalClaimable, run.cells.filter((cell) => cell === FIELD).length);
      const snapshot = inspectCaptureSnapshot(run);
      assert(
        snapshot.components.every((c) => c.retained),
        'No accidentally empty chamber or free remote fill.',
      );
      assert(
        snapshot.components.flatMap((c) => c.enemyIds).every((id) => id.startsWith('keeper-')),
      );
      assert(
        run.enemies
          .filter((e) => e.type === 'claimed-rover')
          .every((e) => e.rover.mode === 'dormant'),
      );
    }
  assert.deepEqual(source, before);
  const changed = createTeamRoamerCandidates();
  changed.maps[0].foundations[0].w++;
  assert.deepEqual(createTeamRoamerCandidates(), source);
});

test('changing-ground campaign preserves authored order and exact preset importer/Journey editions', () => {
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    const pack = createTeamCampaignTestPack(source, 'changing-common-ground', difficulty);
    assert.equal(pack.version, 'revealline-coop-pack.v4');
    assert.equal(pack.ruleset, 'revealline-coop.v6');
    assert.deepEqual(
      pack.levels.map((level) => level.id),
      TEAM_ROAMER_CANDIDATES.map((l) => l.id),
    );
    assert.deepEqual(readCoopPack(JSON.stringify(pack)), pack);
    assert.deepEqual(
      resolveContentJourney(source, { mode: 'team', difficulty }).campaigns[0].runtime.levels,
      pack.levels,
    );
  }
  for (const mode of ['solo', 'versus'])
    assert.throws(() => resolveContentJourney(source, { mode }), /no missions/);
});

test('all roamer layouts permit five seconds of spawn inspection and simultaneous safe first returns, including swapped seats', () => {
  for (const layout of TEAM_ROAMER_CANDIDATES)
    for (const difficulty of ['gentle', 'standard', 'expert'])
      for (const jointCuts of [true, false])
        for (const swapped of [false, true]) {
          const level = structuredClone(
            resolveMission(project, layout.id, { mode: 'team', difficulty }).level,
          );
          const directions = [...TEAM_ROAMER_FIRST_RETURNS[layout.id]];
          if (swapped) {
            level.spawns.reverse();
            directions.reverse();
          }
          const run = startCoop(createCoop(level, { jointCuts }));
          for (let tick = 0; tick < 600; tick++) {
            stepCoop(run, [command(null), command(null)]);
            assert(!run.events.some((e) => e.type === 'player.downed'));
          }
          assert.equal(run.coverage, 0);
          const closed = new Set();
          for (let tick = 0; tick < 650 && closed.size < 2 && run.status === 'running'; tick++) {
            stepCoop(
              run,
              directions.map((direction, seat) => command(closed.has(seat) ? null : direction)),
            );
            assert(
              !run.events.some((e) => e.type === 'player.downed'),
              `${layout.id}/${difficulty}`,
            );
            for (const event of run.events)
              if (event.type === 'cut.closed') closed.add(event.player);
          }
          assert.equal(closed.size, 2, `${layout.id}/${difficulty}`);
          assert.equal(run.status, 'running');
          assert(run.players.every((p) => !p.cutting && run.cells[p.cellIndex] === SAFE));
        }
});

test('optional roamer mastery never mistakes warning, single-player credit or a knockdown for success', () => {
  const run = createCoop(resolveMission(project, 'shared-lookout', { mode: 'team' }).level),
    evidence = createTeamFoundationEvidence();
  run.status = 'won';
  evidence.closed = new Set([0, 1]);
  const actor = run.enemies.find((enemy) => enemy.type === 'claimed-rover');
  actor.rover.mode = 'warning';
  assert.equal(inspectTeamRoamerGoal(run, evidence).achieved, false);
  actor.rover.mode = 'active';
  assert.equal(inspectTeamRoamerGoal(run, evidence).achieved, true);
  evidence.closed.delete(1);
  assert.equal(inspectTeamRoamerGoal(run, evidence).achieved, false);
  evidence.closed.add(1);
  evidence.downs = 1;
  assert.equal(inspectTeamRoamerGoal(run, evidence).achieved, false);
});
