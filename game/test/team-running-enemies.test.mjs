import test from 'node:test';
import assert from 'node:assert/strict';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { createCoop, startCoop, stepCoop, validateCoopLevel } from '../coop/core.mjs';
import { createTeamHuntRecorder, restoreTeamHuntAttempt } from '../coop/hunt-attempts.mjs';
import { createInstalledTeamAttemptSnapshot } from '../creator/team-installed.mjs';
import {
  prepareTeamRunningEnemies,
  teamRunningEnemyBaseLevel,
} from '../hunt/team-running-enemies.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { dataIdentity } from '../data-json.mjs';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { createTeamJourneyCandidates } from '../content-design/team-journey-candidates.mjs';
import { createTeamJourneyProgress } from '../content-design/team-progress.mjs';
import { applyJourneyEvent, emptyJourneyProfile } from '../journey/profile.mjs';
import { teamPictureArenaLevel } from '../coop/picture-source.mjs';

test('Team running enemies retain historical stronghold objectives and recovery rules', () => {
  for (const source of COOP_STARTER_PACK.levels) {
    const level = prepareTeamRunningEnemies(source);
    const before = createCoop(source),
      after = createCoop(level);
    assert.deepEqual(teamRunningEnemyBaseLevel(level), source);
    assert.deepEqual(after.cells, before.cells);
    assert.deepEqual(after.level.goal, before.level.goal);
    assert.deepEqual(after.strongholds, before.strongholds);
    assert.deepEqual(after.team, before.team);
    assert.equal(after.hunt.kills, 0);
    assert.equal(level.hunt.mode, 'bonus');
    assert.equal(level.hunt.quota, 0);
  }
});

test('new Team edition supplements its valid maximum base and preserves disabled patrols', () => {
  const source = structuredClone(COOP_STARTER_PACK.levels[0]);
  Object.assign(source, {
    version: 'revealline-coop-level.v8',
    journeyDifficulty: 'standard',
    terrain: [],
  });
  delete source.encounter;
  delete source.strongholds;
  source.enemies = Array.from({ length: 16 }, (_, i) => ({
    id: `keeper-${i}`,
    type: 'drifter',
    x: 4.5 + i * 4,
    y: 10.5,
    vx: 1,
    vy: 0,
    radius: 0.25,
  }));
  source.combatPatrols = {
    version: 'combat-patrols.v1',
    enabled: true,
    actors: Array.from({ length: 24 }, (_, i) => ({
      id: `scout-${i}`,
      role: 'scout',
      x: 3.5 + i * 2,
      y: 20.5,
      headingX: 1,
      headingY: 0,
      speed: 1,
      turnTicks: 120,
    })),
  };
  assert.equal(validateCoopLevel(source).valid, true);
  const level = prepareTeamRunningEnemies(source);
  assert.equal(level.enemies.length + level.combatPatrols.actors.length, 46);
  assert.deepEqual(teamRunningEnemyBaseLevel(level), source);
  const forged = structuredClone(level);
  forged.combatPatrols.actors[0].speed += 1;
  assert.equal(validateCoopLevel(forged).valid, false);
  source.combatPatrols.enabled = false;
  const disabled = prepareTeamRunningEnemies(source);
  assert.equal(disabled.combatPatrols.actors.length, 6);
  assert.deepEqual(teamRunningEnemyBaseLevel(disabled), source);
});

test('new Team save formats pin running enemies while exact replay restores its decisions', async () => {
  const source = COOP_STARTER_PACK.levels[1],
    tuning = resolveGameplayTuning('standard');
  const level = prepareTeamRunningEnemies(applyGameplayTuning(source, tuning));
  const run = startCoop(createCoop(level, { seed: 17 }));
  const gameplayId = dataIdentity({ ruleset: run.ruleset, level });
  const recorder = createTeamHuntRecorder({
    run,
    pack: COOP_STARTER_PACK,
    level: source,
    tuning,
    encounterLevel: source,
    encounterVariant: 'authored',
    runningEnemies: true,
    attemptId: 'running-inspection',
    gameplayId,
  });
  const commands = [0, 1].map(() => ({ direction: null, boost: false, support: false }));
  for (let i = 0; i < 61; i++) {
    stepCoop(run, commands);
    recorder.append(commands);
  }
  const saved = recorder.snapshot();
  assert.equal(saved.format, 'revealline-team-hunt-attempt.v2');
  const restored = await restoreTeamHuntAttempt(saved, { pack: COOP_STARTER_PACK, level: source });
  assert.deepEqual(restored.run, run);
  const installed = createInstalledTeamAttemptSnapshot({
    editionId: 'a'.repeat(64),
    attemptId: saved.attemptId,
    gameplayId,
    presetId: 'full',
    run,
    tuning,
    segments: saved.segments,
    encounterVariant: 'authored',
    encounterLevelIdentity: dataIdentity(source),
    runningEnemies: true,
  });
  assert.equal(installed.format, 'revealline-installed-team-attempt.v4');
  assert.equal(installed.runningEnemies, 'running-enemies.v1');
  const changed = structuredClone(saved);
  changed.runningEnemies = 'running-enemies.v2';
  await assert.rejects(
    restoreTeamHuntAttempt(changed, { pack: COOP_STARTER_PACK, level: source }),
    /Unsupported/,
  );
});

test('imported supplemental runners cannot shadow inherited stronghold identities', () => {
  const source = COOP_STARTER_PACK.levels[1],
    level = structuredClone(prepareTeamRunningEnemies(source)),
    shadow = source.strongholds[0].id,
    added = level.runningEnemies.actorIds[0];
  level.combatPatrols.actors.find((actor) => actor.id === added).id = shadow;
  level.runningEnemies.actorIds[0] = shadow;
  level.hunt.targets[0].id = shadow;
  assert.equal(validateCoopLevel(level).valid, false);
});

test('Team pictures retain only the exactly rederived base of the running-enemy arena', () => {
  const sourceLevel = COOP_STARTER_PACK.levels[0],
    tuned = applyGameplayTuning(sourceLevel, resolveGameplayTuning('standard')),
    runtimeLevel = prepareTeamRunningEnemies(tuned),
    run = startCoop(createCoop(runtimeLevel));
  assert.deepEqual(teamPictureArenaLevel(run, { runtimeLevel, sourceLevel }), tuned);
  stepCoop(
    run,
    [0, 1].map(() => ({ direction: null, boost: false, support: false })),
  );
  assert.deepEqual(teamPictureArenaLevel(run, { runtimeLevel, sourceLevel }), tuned);
  const different = structuredClone(sourceLevel);
  different.goal.coverage -= 0.01;
  assert.throws(
    () => teamPictureArenaLevel(run, { runtimeLevel, sourceLevel: different }),
    /exact recipe/,
  );
  assert.throws(() => teamPictureArenaLevel(run, { sourceLevel }), /exact prepared arena/);
});

test('global Bonus binds ordinary Team progression through fresh and verified Continue ownership', async () => {
  const source = createTeamJourneyCandidates(),
    journey = createCandidateTeamHost(source, { corePackIds: source.packs.map((pack) => pack.id) }),
    row = journey.row(journey.catalog.missions[0]),
    tuning = resolveGameplayTuning('standard'),
    base = applyGameplayTuning(row.level, tuning),
    level = prepareTeamRunningEnemies(base),
    run = startCoop(createCoop(level, { seed: 17 })),
    gameplayId = dataIdentity({ ruleset: run.ruleset, level });
  let saved = emptyJourneyProfile();
  const backend = {
    read: async () => structuredClone(saved),
    commit: async (events) => {
      saved = events.reduce(applyJourneyEvent, saved);
      return structuredClone(saved);
    },
  };
  const progress = createTeamJourneyProgress(journey, { backend });
  await progress.load();
  assert.equal(progress.started(row, run, { gameplayId, attemptId: 'running-fresh' }), true);
  const recorder = createTeamHuntRecorder({
    run,
    pack: row.pack,
    level: row.level,
    tuning,
    encounterLevel: row.level,
    encounterVariant: 'authored',
    runningEnemies: true,
    attemptId: 'running-continued',
    gameplayId,
  });
  const commands = [0, 1].map(() => ({ direction: null, boost: false, support: false }));
  for (let tick = 0; tick < 5; tick++) {
    stepCoop(run, commands);
    recorder.append(commands);
  }
  const restored = await restoreTeamHuntAttempt(recorder.snapshot(), row),
    continued = createTeamJourneyProgress(journey, { backend });
  await continued.load();
  assert.equal(continued.resumed(row, structuredClone(restored.run), { gameplayId }), false);
  assert.equal(continued.resumed(row, restored.run, { gameplayId }), true);
  // Isolate the progress owner's terminal lifecycle; the core win itself is
  // outside this binding regression and is not asserted by this assignment.
  restored.run.status = 'won';
  assert.equal(continued.complete(restored.run), true);
  assert.equal(continued.complete(restored.run), false);
  await continued.retry();
  assert.deepEqual((await backend.read()).clears.team[row.mission.id], {
    runId: 'running-continued',
    gameplayId: dataIdentity({ ruleset: row.pack.ruleset, level: base }),
    difficulty: 'standard',
  });
  progress.dispose();
  continued.dispose();
});
