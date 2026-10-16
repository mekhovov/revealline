import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { prepareRunningEnemyLevel, runningEnemyBaseLevel } from '../hunt/running-enemies.mjs';
import { prepareTeamRunningEnemies } from '../hunt/team-running-enemies.mjs';
import {
  updatePursuitHeading,
  validatePursuitGoals,
  pursuitPopulation,
} from '../hunt/pursuit-goals.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';
import { createCoop, startCoop, stepCoop } from '../coop/core.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { createTeamHuntRecorder, restoreTeamHuntAttempt } from '../coop/hunt-attempts.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { dataIdentity } from '../data-json.mjs';
import { combatView } from '../ui/combat-view.mjs';
const base = () =>
  JSON.parse(readFileSync(new URL('../content/campaign.json', import.meta.url))).levels[0];

test('varied goals get a new replay authority without upgrading Original recipes', () => {
  const source = base(),
    original = prepareRunningEnemyLevel(source),
    varied = prepareRunningEnemyLevel(source, { style: 'varied' });
  assert.deepEqual(prepareRunningEnemyLevel(source, { style: 'original' }), original);
  assert.equal(original.version, 'xonix-level.v10');
  assert.equal(varied.version, 'xonix-level.v12');
  assert.deepEqual(runningEnemyBaseLevel(varied), runningEnemyBaseLevel(original));
  assert.deepEqual(varied.runningEnemies.combatPatrols, original.runningEnemies.combatPatrols);
  assert.ok(
    varied.pursuit.actors.every(({ behavior }) => !['shield', 'brace', 'guard'].includes(behavior)),
  );
  const run = createRun(varied),
    recorder = createRecorder(varied);
  for (let i = 0; i < 61; i++) {
    const input = { direction: null };
    recordInput(recorder, input);
    stepRun(run, input, FIXED_DT);
  }
  const replay = exportReplay(recorder, run),
    proof = verifyReplay(replay);
  assert.equal(replay.version, 'xonix-replay.v14');
  assert.equal(proof.match, true);
  assert.equal(authoritativeCheckpoint(proof.state).algorithm, 'fnv1a64-state-v13');
  assert.equal(combatView(run).valid, true);
  const changed = structuredClone(replay);
  changed.level.pursuit.actors[0].waypoints.reverse();
  assert.notEqual(
    verifyReplay(changed).match,
    true,
    'Imported goal changes cannot retain the old proof.',
  );
});

test('goal motion waits through recovery, stops after a topology split and leaves ordinary survivor AI ownership', () => {
  const geometry = { width: 9, height: 7, cells: Array(63).fill(0) };
  const actor = {
    id: 'patrol',
    role: 'scout',
    x: 2.5,
    y: 3.5,
    vx: 0,
    vy: 0,
    radius: 0.25,
    alive: true,
  };
  const policy = {
    id: 'patrol',
    behavior: 'patroller',
    waypoints: [
      { x: 2.5, y: 3.5 },
      { x: 6.5, y: 3.5 },
    ],
  };
  validatePursuitGoals({ version: 'pursuit-goals.v1', actors: [policy] }, [actor], geometry);
  const args = {
    actor,
    policy,
    actors: [actor],
    players: [],
    geometry,
    speed: 2,
    clearance: () => 1,
  };
  updatePursuitHeading({ ...args, tick: 0 });
  updatePursuitHeading({ ...args, tick: 1 });
  assert.equal(actor.pursuit.phase, 'recovering');
  updatePursuitHeading({ ...args, tick: 5 });
  assert.equal(actor.vx, 0);
  updatePursuitHeading({ ...args, tick: 13 });
  assert.ok(actor.vx > 0);
  for (let y = 0; y < 7; y++) geometry.cells[y * 9 + 4] = 2;
  updatePursuitHeading({ ...args, tick: 14 });
  assert.equal(actor.pursuit.phase, 'blocked');
  assert.equal(actor.vx, 0);
  assert.equal(
    updatePursuitHeading({
      ...args,
      tick: 15,
      policy: { ...policy, behavior: 'pair', partnerId: 'removed' },
    }),
    false,
  );
});

test('Team varied restore replays its pinned phases and native stronghold objective', async () => {
  const source = COOP_STARTER_PACK.levels[1],
    tuning = resolveGameplayTuning('standard');
  const level = prepareTeamRunningEnemies(applyGameplayTuning(source, tuning), { style: 'varied' });
  const run = startCoop(createCoop(level, { seed: 17 }));
  const recorder = createTeamHuntRecorder({
    run,
    pack: COOP_STARTER_PACK,
    level: source,
    tuning,
    encounterLevel: source,
    encounterVariant: 'authored',
    runningEnemies: true,
    attemptId: 'varied-restore',
    gameplayId: dataIdentity({ ruleset: run.ruleset, level }),
  });
  const commands = [0, 1].map(() => ({ direction: null, boost: false, support: false }));
  for (let i = 0; i < 61; i++) {
    stepCoop(run, commands);
    recorder.append(commands);
  }
  const saved = recorder.snapshot();
  assert.equal(saved.format, 'revealline-team-hunt-attempt.v3');
  assert.equal(saved.runningEnemyStyle, 'varied');
  const restored = await restoreTeamHuntAttempt(saved, { pack: COOP_STARTER_PACK, level: source });
  assert.deepEqual(restored.run, run);
  assert.deepEqual(restored.run.level.goal, source.goal);
  assert.equal(pursuitPopulation(restored.run.level).length, level.pursuit.actors.length);
  const forged = structuredClone(saved);
  forged.runningEnemyStyle = 'original';
  await assert.rejects(restoreTeamHuntAttempt(forged, { pack: COOP_STARTER_PACK, level: source }));
});
