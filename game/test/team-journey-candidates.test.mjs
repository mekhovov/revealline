import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTeamJourneyCandidates,
  createTeamFoundationPracticeCandidates,
  TEAM_FOUNDATION_CANDIDATES,
  TEAM_JOURNEY_LEARNING_ARCS,
} from '../content-design/team-journey-candidates.mjs';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';
import { createTeamSignalCandidates } from '../content-design/team-signal-candidates.mjs';
import { createTeamMaterialPracticeCandidates } from '../content-design/team-material-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { resolveContentJourney } from '../content-design/journey.mjs';
import { createContentExecutionCatalog } from '../content-design/execution.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { readCoopPack } from '../coop/library.mjs';
import { createCoop, startCoop, stepCoop, FIXED_DT } from '../coop/core.mjs';
import { inspectContentPacing } from '../content-design/pacing.mjs';

const source = createTeamJourneyCandidates();
const project = compileContentProject(source);

test('Team review remains a separate independent candidate sequence, not a Solo conversion', () => {
  assert.equal(source.missions.length, 8);
  assert.equal(source.maps.length, 8);
  assert.equal(source.packs.length, 4);
  assert.equal(source.assets.length, 0);
  assert.deepEqual(
    source.missions.map((m) => m.id),
    [
      'twin-landings',
      'stepping-exchange',
      'divided-workshop',
      'switchback-partners',
      'shared-detour',
      'crossed-gardens',
      'split-orchards',
      'weaver-crossing',
    ],
  );
  const draft = createTeamJourneyCandidates();
  draft.maps[0].foundations[0].w++;
  draft.missions[1].coverage = 0.8;
  assert.deepEqual(createTeamJourneyCandidates(), source);
  for (const mode of ['solo', 'versus'])
    assert.throws(() => resolveContentJourney(project, { mode }), /no missions/);
  assert(Object.isFrozen(TEAM_FOUNDATION_CANDIDATES[0].foundations[0]));
  const report = inspectContentPacing(project, { mode: 'team' });
  assert.equal(report.rows.length, 8);
  assert.equal(report.timedFraction, 0);
  assert(
    !report.diagnostics.some((d) =>
      ['challenge-band-regression', 'challenge-band-jump'].includes(d.code),
    ),
  );
});

test('composing Team chapters preserves every existing preset manifest and execution identity', () => {
  const catalog = createContentExecutionCatalog(project, { mode: 'team' });
  for (const create of [
    createTeamOpeningCandidates,
    createTeamFoundationPracticeCandidates,
    createTeamSignalCandidates,
    createTeamMaterialPracticeCandidates,
  ]) {
    const standalone = compileContentProject(create());
    const original = createContentExecutionCatalog(standalone, { mode: 'team' });
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      for (const mission of standalone.missions) {
        const combined = resolveMission(project, mission.id, { mode: 'team', difficulty });
        assert.deepEqual(
          combined,
          resolveMission(standalone, mission.id, { mode: 'team', difficulty }),
        );
        assert.equal(combined.officialProgressEligible, false);
        assert.equal(combined.background, null);
        assert(!combined.diagnostics.some((d) => d.severity === 'error'));
      }
      for (const pack of standalone.packs)
        for (const campaignId of pack.campaignIds) {
          const a = catalog.select(pack.id, campaignId, difficulty);
          const b = original.select(pack.id, campaignId, difficulty);
          assert.equal(a.executionKey, b.executionKey);
          assert.equal(a.baseCampaignKey, b.baseCampaignKey);
          assert.deepEqual(a.campaign, b.campaign);
        }
    }
  }
});

test('Team learning arcs practice one rule in four missions without resetting the declared bands', () => {
  assert.deepEqual(
    TEAM_JOURNEY_LEARNING_ARCS.flatMap((arc) => arc.missionIds),
    source.missions.map((m) => m.id),
  );
  for (const arc of TEAM_JOURNEY_LEARNING_ARCS) {
    assert.equal(arc.missionIds.length, 4);
    const rules = new Set(
      arc.missionIds.flatMap((id) => source.missions.find((m) => m.id === id).design.introduces),
    );
    assert.equal(rules.size, 1);
  }
});

test('three complementary layouts share exact Studio, export and Team runtime geometry', () => {
  const signatures = new Set();
  for (const layout of TEAM_FOUNDATION_CANDIDATES) {
    const mission = project.missions.find((m) => m.id === layout.id);
    signatures.add(JSON.stringify([layout.foundations, layout.walls]));
    assert.deepEqual(mission.design.introduces, []);
    assert.equal(
      mission.actors.every((a) => a.tier === 'measured'),
      true,
    );
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const preview = prepareContentPreview(project, layout.id, { mode: 'team', difficulty });
      const pack = createTeamTestPack(source, layout.id, difficulty);
      assert.deepEqual(pack.levels, [preview.manifest.level]);
      assert.deepEqual(readCoopPack(JSON.stringify(pack)), pack);
      const run = createCoop(pack.levels[0]);
      assert.equal(run.totalClaimable, run.cells.filter((cell) => cell === 0).length);
      assert.equal(run.rules.moveSpeed, 10);
      assert.equal(run.rules.boostMultiplier, 1);
      assert.deepEqual([...run.cells], preview.geometry.cells);
    }
  }
  assert.equal(signatures.size, 3);
});

test('every new Team spawn offers five seconds without unavoidable pressure, at every preset', () => {
  const neutral = [
    { direction: null, support: false, boost: false },
    { direction: null, support: false, boost: false },
  ];
  for (const layout of TEAM_FOUNDATION_CANDIDATES)
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const level = resolveMission(project, layout.id, { mode: 'team', difficulty }).level;
      const run = startCoop(createCoop(level));
      const before = run.players.map(({ x, y }) => [x, y]);
      for (let tick = 0; tick < 5 / FIXED_DT; tick++) {
        stepCoop(run, neutral);
        assert(!run.events.some((e) => e.type === 'player.downed'));
      }
      assert.equal(run.status, 'running');
      assert.equal(run.coverage, 0);
      assert.deepEqual(
        run.players.map(({ x, y }) => [x, y]),
        before,
      );
    }
});

test('divided workshop has two independently retained chambers and neither half alone meets the quota', () => {
  const preview = prepareContentPreview(project, 'divided-workshop', { mode: 'team' });
  assert.equal(preview.capture.components.length, 2);
  for (const component of preview.capture.components) {
    assert.equal(component.retained, true);
    assert.equal(component.enemyIds.length, 1);
  }
  const run = createCoop(preview.manifest.level);
  for (const side of [0, 1]) {
    const count = [...run.cells].filter(
      (cell, index) => cell === 0 && (side ? index % 72 > 36 : index % 72 < 35),
    ).length;
    assert(count / run.totalClaimable < run.level.goal.coverage);
  }
});
