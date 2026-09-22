import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTeamMaterialPracticeCandidates,
  TEAM_MATERIAL_CANDIDATES,
  TEAM_MATERIAL_FIRST_RETURNS,
} from '../content-design/team-material-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { createTeamCampaignTestPack } from '../content-design/team-export.mjs';
import { resolveContentJourney } from '../content-design/journey.mjs';
import { inspectContentPacing } from '../content-design/pacing.mjs';
import { createCoop, startCoop, stepCoop, SAFE, FIELD } from '../coop/core.mjs';
import { readCoopPack } from '../coop/library.mjs';
import {
  createTeamFoundationEvidence,
  observeTeamFoundationGoal,
} from './helpers/team-foundation-goal.mjs';
import { inspectTeamMaterialGoal } from './helpers/team-material-goal.mjs';

const source = createTeamMaterialPracticeCandidates(),
  before = structuredClone(source);
const project = compileContentProject(source);
const command = (direction) => ({ direction, boost: false, support: false });

test('three distinct Team material decisions use the existing explicit terrain contract, not new player physics', () => {
  assert.equal(project.missions.length, 3);
  const signatures = new Set();
  for (const layout of TEAM_MATERIAL_CANDIDATES) {
    signatures.add(JSON.stringify([layout.foundations, layout.walls, layout.terrain]));
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const manifest = resolveMission(project, layout.id, { mode: 'team', difficulty });
      assert.equal(manifest.level.version, 'revealline-coop-level.v3');
      assert.equal(manifest.level.rules.moveSpeed, 10);
      assert.equal(manifest.level.rules.boostMultiplier, 1);
      assert.deepEqual(manifest.design.introduces, []);
      assert.equal(manifest.background, null);
      assert.equal(manifest.officialProgressEligible, false);
      assert(!manifest.diagnostics.some((d) => d.severity === 'error'));
      assert.equal(
        manifest.level.enemies.every((actor) => actor.type === 'drifter'),
        true,
      );
      const preview = prepareContentPreview(project, layout.id, { mode: 'team', difficulty });
      const run = createCoop(manifest.level);
      assert.deepEqual([...run.cells], preview.geometry.cells);
      assert.equal(run.totalClaimable, run.cells.filter((cell) => cell === FIELD).length);
    }
  }
  assert.equal(signatures.size, 3);
  assert.deepEqual(source, before);
  const independent = createTeamMaterialPracticeCandidates();
  independent.maps[0].terrain[0].w++;
  assert.deepEqual(createTeamMaterialPracticeCandidates(), source);
  for (const mode of ['solo', 'versus'])
    assert.throws(() => resolveContentJourney(source, { mode }), /no missions/);
});

test('Team material campaign export and advisory pacing share authored order and preset identity', () => {
  const report = inspectContentPacing(source, { mode: 'team' });
  assert.deepEqual(
    report.rows.map((row) => row.rating.band),
    [4, 4, 5],
  );
  assert.equal(report.timedFraction, 0);
  assert.equal(report.diagnostics.length, 0);
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    const pack = createTeamCampaignTestPack(source, 'shared-material-routes', difficulty);
    assert.equal(pack.version, 'revealline-coop-pack.v3');
    assert.equal(pack.ruleset, 'revealline-coop.v5');
    assert.deepEqual(readCoopPack(JSON.stringify(pack)), pack);
    assert.deepEqual(
      pack.levels.map((l) => l.id),
      TEAM_MATERIAL_CANDIDATES.map((l) => l.id),
    );
    assert(pack.levels.every((l) => l.journeyDifficulty === difficulty));
  }
});

test('material layouts have safe spawn inspection and no-loss simultaneous first returns at all presets', () => {
  for (const layout of TEAM_MATERIAL_CANDIDATES)
    for (const difficulty of ['gentle', 'standard', 'expert'])
      for (const jointCuts of [true, false]) {
        const level = resolveMission(project, layout.id, { mode: 'team', difficulty }).level;
        const idle = startCoop(createCoop(level, { jointCuts }));
        for (let t = 0; t < 600; t++) {
          stepCoop(idle, [command(null), command(null)]);
          assert(!idle.events.some((e) => e.type === 'player.downed'));
        }
        assert.equal(idle.coverage, 0);
        const run = startCoop(createCoop(level, { jointCuts })),
          closed = new Set();
        for (let t = 0; t < 650 && closed.size < 2 && run.status === 'running'; t++) {
          stepCoop(
            run,
            TEAM_MATERIAL_FIRST_RETURNS[layout.id].map((direction, seat) =>
              command(closed.has(seat) ? null : direction),
            ),
          );
          assert(!run.events.some((e) => e.type === 'player.downed'));
          for (const e of run.events) if (e.type === 'cut.closed') closed.add(e.player);
        }
        assert.deepEqual([...closed].sort(), [0, 1]);
        assert.equal(run.status, 'running');
        assert(run.coverage > 0 && run.coverage < level.goal.coverage);
        assert(run.players.every((p) => !p.cutting && run.cells[p.cellIndex] === SAFE));
      }
});

test('material goal observer does not infer neutralization from a threshold or incomplete patch', () => {
  const level = resolveMission(project, 'crossed-gardens', { mode: 'team' }).level;
  const run = startCoop(createCoop(level)),
    evidence = createTeamFoundationEvidence();
  observeTeamFoundationGoal(run, evidence);
  const snapshot = structuredClone(run);
  const goal = inspectTeamMaterialGoal(run, evidence);
  assert.equal(goal.achieved, false);
  assert.deepEqual(goal.neutralized, []);
  assert.deepEqual(run, snapshot);
  assert.throws(
    () => inspectTeamMaterialGoal({ ...run, level: { ...run.level, id: 'unknown' } }, evidence),
    /Unknown/,
  );
});
