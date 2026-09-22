import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIFFICULTY_CATALOG,
  PRESSURE_DIFFICULTY_CATALOG,
  LIVEWIRE_ACTOR_CATALOG,
  SENTINEL_RECIPE,
  journeyDifficultyCatalog,
  journeyPreset,
  journeyLaneTiming,
  journeySentinelTiming,
  compileActor,
} from '../content-design/catalogs.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createWholeJourneyCandidates } from '../content-design/whole-journey-candidates.mjs';
import { createTeamJourneyCandidates } from '../content-design/team-journey-candidates.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { createContentExecutionCatalog } from '../content-design/execution.mjs';
import {
  withPressureDifficulty,
  inspectPressureDifficulty,
} from '../content-design/pressure-candidates.mjs';
import { createRun, stepRun, FIXED_DT, CLASSES } from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';
import { campaignKey } from '../library.mjs';
import { sentinelProjectFixture } from './helpers/sentinel-project.mjs';

const v2 = PRESSURE_DIFFICULTY_CATALOG.id;
const presets = ['gentle', 'standard', 'expert'];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('difficulty catalogs are immutable explicit editions, not an implicit legacy upgrade', () => {
  assert.equal(journeyDifficultyCatalog(), DIFFICULTY_CATALOG);
  assert.equal(journeyDifficultyCatalog(v2), PRESSURE_DIFFICULTY_CATALOG);
  assert.equal(journeyPreset().enemySpeedFactor, 1);
  assert.equal(journeyPreset('standard', v2).enemySpeedFactor, 1.4);
  assert(Object.isFrozen(PRESSURE_DIFFICULTY_CATALOG.presets.standard));
  for (const bad of ['unknown', null, {}, 'toString'])
    assert.throws(() => journeyDifficultyCatalog(bad), /registered difficulty/);
  assert.throws(() => journeyPreset('unknown', v2), /Unsupported Journey difficulty/);
  for (const bad of [undefined, 'unknown', null]) {
    const source = createStarterProject();
    source.difficultyCatalogId = bad;
    assert.throws(() => compileContentProject(source));
  }
});

test('v2 scales movement and rest only; fixed-tick lane cycles preserve tells and active duration', () => {
  for (const difficulty of presets) {
    const preset = journeyPreset(difficulty, v2);
    for (const timing of Object.values(LIVEWIRE_ACTOR_CATALOG.roles['lane-emitter'].timings)) {
      assert.deepEqual(journeyLaneTiming(timing, difficulty), timing);
      const next = journeyLaneTiming(timing, difficulty, v2);
      assert.equal(next.warningSeconds, timing.warningSeconds);
      assert.equal(next.activeSeconds, timing.activeSeconds);
      const expectedRest = Math.round(((timing.period - 2.2) * preset.attackRestFactor) / FIXED_DT);
      near(next.period, (264 + expectedRest) * FIXED_DT);
      assert(next.period > next.warningSeconds + next.activeSeconds);
    }
    const sentinel = journeySentinelTiming(difficulty, v2);
    assert.deepEqual(journeySentinelTiming(difficulty), SENTINEL_RECIPE.definition);
    assert.equal(sentinel.shielded.restTicks, Math.round(396 * preset.attackRestFactor));
    assert.deepEqual(sentinel.exposed, SENTINEL_RECIPE.definition.exposed);
    assert.equal(sentinel.initialDelayTicks, 240);
    assert.equal(sentinel.transitionTicks, 180);
  }
});

for (const [label, make] of [
  ['83 Solo/Versus missions', createWholeJourneyCandidates],
  ['12 Team missions', createTeamJourneyCandidates],
])
  test(`${label}: pressure projection is owned, repeatable, compiler-wide and identity-separated`, () => {
    const source = make();
    const before = structuredClone(source);
    const old = compileContentProject(source);
    const candidate = withPressureDifficulty(source);
    const next = compileContentProject(candidate);
    assert.deepEqual(source, before);
    assert.deepEqual(withPressureDifficulty(source), candidate);
    assert.deepEqual(withPressureDifficulty(candidate), candidate);
    assert.deepEqual(candidate.maps, source.maps);
    assert.deepEqual(candidate.assets, source.assets);
    assert.notEqual(candidate.revision, source.revision);
    assert.equal(next.difficulty.id, v2);
    let checks = 0;
    for (const mission of old.missions)
      for (const difficulty of presets)
        for (const mode of mission.modes) {
          const a = resolveMission(old, mission.id, { mode, difficulty });
          const b = resolveMission(next, mission.id, { mode, difficulty });
          assert.notEqual(a.simulationIdentity, b.simulationIdentity, mission.id + difficulty);
          assert.equal(b.level.rules.moveSpeed, a.level.rules.moveSpeed);
          assert.equal(b.level.goal.coverage, a.level.goal.coverage);
          assert.equal(b.officialProgressEligible, false);
          const factor =
            journeyPreset(difficulty, v2).enemySpeedFactor /
            journeyPreset(difficulty).enemySpeedFactor;
          for (let i = 0; i < a.level.enemies.length; i++) {
            const prev = a.level.enemies[i],
              actor = b.level.enemies[i];
            if (prev.vx !== undefined) {
              near(actor.vx, prev.vx * factor);
              near(actor.vy, prev.vy * factor);
            } else if (prev.speed !== undefined) near(actor.speed, prev.speed * factor);
          }
          if (mode === 'versus')
            assert.deepEqual(b.level, resolveMission(next, mission.id, { difficulty }).level);
          checks++;
        }
    assert.equal(checks, label.startsWith('83') ? 498 : 36);
    assert.deepEqual(compileContentProject(source).source, old.source);
    candidate.missions[0].name = 'independent draft';
    assert.notEqual(next.missions[0].name, candidate.missions[0].name);
  });

test('read-only audit includes every effective speed/cadence and labels absent balance evidence', () => {
  const source = withPressureDifficulty(createWholeJourneyCandidates());
  const report = inspectPressureDifficulty(source);
  assert.equal(report.missionCount, 83);
  assert.equal(report.rows.length, 498);
  assert.equal(new Set(report.rows.map((row) => row.missionId)).size, 83);
  assert(report.rows.every((row) => row.validation === 'compiled-candidate-not-balance-qualified'));
  assert(report.rows.every((row) => row.difficultyCatalogId === v2));
  assert(report.pending.includes('native-readability-and-human-balance'));
  assert(Object.isFrozen(report.rows[0].actors));
  const team = inspectPressureDifficulty(withPressureDifficulty(createTeamJourneyCandidates()));
  assert.equal(team.rows.length, 36);
  assert(team.rows.every((row) => row.mode === 'team'));
});

test('execution catalog resolves v2 at the shared boundary and cannot load old execution keys', () => {
  const source = createStarterProject();
  const old = createContentExecutionCatalog(source);
  const next = createContentExecutionCatalog(withPressureDifficulty(source));
  for (const entry of next.entries) {
    assert.equal(entry.manifests[0].level.rules.lives, journeyPreset(entry.difficulty, v2).lives);
    const prev = old.select(entry.sourcePackId, entry.campaignId, entry.difficulty);
    assert.notEqual(entry.executionKey, prev.executionKey);
    assert.equal(next.find(entry.sourcePackId, entry.campaignId, prev.executionKey), null);
    assert.equal(next.journey(entry.difficulty).difficulty, entry.difficulty);
  }
});

test('compiled v2 lane and Sentinel encounters run with deterministic public replays', () => {
  const emitter = createStarterProject();
  emitter.actorCatalogId = LIVEWIRE_ACTOR_CATALOG.id;
  emitter.missions[0].actors.push({
    id: 'emitter',
    role: 'lane-emitter',
    tier: 'measured',
    x: 45.5,
    y: 15.5,
    axis: 'horizontal',
  });
  for (const source of [emitter, sentinelProjectFixture()]) {
    const project = compileContentProject(withPressureDifficulty(source));
    for (const difficulty of presets) {
      const { level } = resolveMission(project, 'nearby-shore', { difficulty });
      const run = createRun(level, { seed: 2 });
      const recorder = createRecorder(level, { seed: 2 });
      for (let i = 0; i < 120 * 12; i++) {
        const input = { direction: null };
        recordInput(recorder, input);
        stepRun(run, input, FIXED_DT);
      }
      assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
      assert.equal(run.classic.livesLost, 0);
      if (level.encounter) assert.equal(level.encounter.exposed.openTicks, 480);
      else assert.equal(level.enemies[1].warningSeconds, 1.5);
    }
  }
});

test('standalone actor compilation defaults to v1 and explicit v2 rejects unknown editions', () => {
  const actor = createStarterProject().missions[0].actors[0];
  near(Math.hypot(compileActor(actor).vx, compileActor(actor).vy), 2.4);
  const next = compileActor(actor, 'expert', undefined, v2);
  near(Math.hypot(next.vx, next.vy), 4.2);
  assert.throws(
    () => compileActor(actor, 'standard', undefined, 'missing'),
    /registered difficulty/,
  );
});

test('pressure encounter saves restore exact future cadence and cannot impersonate v1', async () => {
  const source = sentinelProjectFixture();
  const prior = compileContentProject(source);
  const next = compileContentProject(withPressureDifficulty(source));
  for (const difficulty of presets) {
    const { level } = resolveMission(next, 'nearby-shore', { difficulty });
    const campaign = {
      version: 'xonix-campaign.v1',
      id: 'pressure-restore',
      revision: '1',
      levels: [level],
      classRecipes: CLASSES,
    };
    const key = campaignKey(campaign);
    const options = { seed: 1, classId: 'scout', turnPolicy: 'immediate' };
    const run = createRun(level, options),
      recorder = createRecorder(level, options);
    const advance = (state, recording, count) => {
      for (let i = 0; i < count; i++) {
        recordInput(recording, { direction: null });
        stepRun(state, { direction: null }, FIXED_DT);
      }
    };
    advance(run, recorder, 250);
    const saved = suspendSession({
      run,
      recorder,
      campaignKey: key,
      themeId: 'fpv',
      bodyId: 'quad',
      runId: `pressure-${difficulty}`,
      continuation: { direction: null },
    });
    const restored = await restoreSession(saved, { campaign, campaignKey: key });
    assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(run));
    advance(run, recorder, 1200);
    advance(restored.run, restored.recorder, 1200);
    assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(run));
    const oldCampaign = {
      ...campaign,
      levels: [resolveMission(prior, 'nearby-shore', { difficulty }).level],
    };
    await assert.rejects(restoreSession(saved, { campaign: oldCampaign, campaignKey: key }));
  }
});
