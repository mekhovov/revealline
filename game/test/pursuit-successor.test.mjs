import { createPursuitPilotCandidates } from '../content-design/pursuit-pilot-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { selectedMissionPursuitSource } from '../studio/pursuit-editor.mjs';
import { eliminateCombatPatrol, updateCombatPatrols } from '../core/combat-patrols.mjs';
import { eliminateCoopCombat, updateCoopCombat, coopCombatView } from '../coop/combat-patrols.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { updatePursuitHeading, validatePursuitGoals } from '../hunt/pursuit-goals.mjs';
import { prepareRunningEnemyLevel } from '../hunt/running-enemies.mjs';
import { prepareTeamRunningEnemies } from '../hunt/team-running-enemies.mjs';
import { createRun, stepRun, FIXED_DT, validateLevel } from '../core/index.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplay } from '../replay.mjs';
import { matchReplayInstalledRules } from '../replay-installed-rules.mjs';
import { combatView } from '../ui/combat-view.mjs';
import { createCoop, startCoop, stepCoop } from '../coop/core.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { createTeamHuntRecorder, restoreTeamHuntAttempt } from '../coop/hunt-attempts.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { dataIdentity } from '../data-json.mjs';

const version = 'pursuit-goals.v2';
function fixture(behavior, waypoints = []) {
  const geometry = { width: 13, height: 11, cells: Array(143).fill(0) };
  const actor = {
    id: 'a',
    role: 'scout',
    x: 4.5,
    y: 4.5,
    vx: 0,
    vy: 2,
    radius: 0.3,
    alive: true,
    nextTurnTick: 60,
  };
  return {
    version,
    actor,
    policy: { id: actor.id, behavior, waypoints },
    actors: [actor],
    geometry,
    players: [{ x: 3.5, y: 4.5 }],
    speed: 2,
    clearance: () => 1,
  };
}
const update = (args, tick) => updatePursuitHeading({ ...args, tick });

test('ordinary Sprinter warns for 0.8 seconds, commits for 0.4, then recovers for 1.6 without exceeding two cells', () => {
  const args = fixture('sprinter');
  args.speed = 10;
  update(args, 0);
  assert.equal(args.actor.pursuit.phase, 'warning');
  assert.equal(args.actor.pursuit.nextHeading, 'right');
  assert.equal(
    args.actor.pursuit.heading,
    'down',
    'Warning shows intent without changing the active face.',
  );
  update(args, 95);
  assert.equal(args.actor.vx, 0);
  for (let tick = 96; tick < 144; tick++) {
    update(args, tick);
    assert.equal(args.actor.pursuit.phase, 'burst');
    args.actor.x += args.actor.vx / 120;
    args.actor.y += args.actor.vy / 120;
  }
  assert.ok(Math.abs(args.actor.x - 6.5) < 1e-9);
  update(args, 144);
  assert.equal(args.actor.pursuit.phase, 'recovering');
  update(args, 335);
  assert.equal(args.actor.vx, 0);
  update(args, 336);
  assert.equal(args.actor.pursuit.phase, 'warning');
});

test('Sprinter detection respects traversable distance and surviving bursts wait when blocked', () => {
  const args = fixture('sprinter');
  for (let y = 0; y < args.geometry.height; y++)
    args.geometry.cells[y * args.geometry.width + 3] = 2;
  args.players = [{ x: 2.5, y: 4.5 }];
  update(args, 0);
  assert.equal(args.actor.pursuit.phase, 'idle');
  args.geometry.cells[4 * args.geometry.width + 3] = 0;
  update(args, 1);
  assert.equal(args.actor.pursuit.phase, 'warning');
  args.clearance = () => 0;
  update(args, 97);
  assert.equal(args.actor.pursuit.phase, 'burst');
  assert.equal(args.actor.vx, 0);
  assert.equal(args.actor.vy, 0);
});

test('Refuge commits across player movement, while topology invalidation announces a reachable replacement', () => {
  const args = fixture('refuge', [
    { x: 2.5, y: 4.5 },
    { x: 9.5, y: 4.5 },
  ]);
  update(args, 0);
  assert.deepEqual(args.actor.pursuit.goal, { x: 9.5, y: 4.5 });
  args.players = [{ x: 10.5, y: 4.5 }];
  update(args, 96);
  assert.deepEqual(args.actor.pursuit.goal, { x: 9.5, y: 4.5 });
  assert.ok(args.actor.vx > 0);
  for (let y = 0; y < args.geometry.height; y++)
    args.geometry.cells[y * args.geometry.width + 7] = 2;
  update(args, 97);
  assert.deepEqual(args.actor.pursuit.goal, { x: 2.5, y: 4.5 });
  assert.equal(args.actor.pursuit.phase, 'warning');
  args.geometry.cells[4 * args.geometry.width + 2] = 1;
  assert.equal(
    update(args, 98),
    false,
    'No reachable authored goal returns authority to the native Runner.',
  );
  assert.equal(args.actor.pursuit.phase, 'fallback');
});

test('Switchback announces each alternate exit before committed travel and never reads queued input', () => {
  const args = fixture('switchback', [
    { x: 8.5, y: 4.5 },
    { x: 2.5, y: 4.5 },
  ]);
  Object.defineProperty(args.players[0], 'queuedDirection', {
    get() {
      throw new Error('Queued inputs are not observable by prey.');
    },
  });
  update(args, 0);
  update(args, 95);
  assert.equal(args.actor.vx, 0);
  update(args, 96);
  assert.ok(args.actor.vx > 0);
  args.actor.x = 8.5;
  update(args, 97);
  assert.equal(args.actor.pursuit.phase, 'recovering');
  update(args, 157);
  assert.equal(args.actor.pursuit.phase, 'warning');
  assert.equal(args.actor.pursuit.nextHeading, 'left');
  assert.equal(args.actor.pursuit.heading, 'right');
});

test('Rendezvous partners share a reachable meeting, wait for one another, and a survivor becomes a Runner', () => {
  const args = fixture('pair', [
    { x: 7.5, y: 5.5 },
    { x: 8.5, y: 7.5 },
  ]);
  args.policy.partnerId = 'b';
  const partner = { ...args.actor, id: 'b', x: 9.5, y: 5.5 };
  args.actors.push(partner);
  const partnerArgs = {
    ...args,
    actor: partner,
    policy: { ...args.policy, id: 'b', partnerId: 'a' },
  };
  validatePursuitGoals(
    { version, actors: [args.policy, partnerArgs.policy] },
    args.actors,
    args.geometry,
  );
  update(partnerArgs, 0);
  update(args, 0);
  assert.deepEqual(args.actor.pursuit.meetingGoal, partner.pursuit.meetingGoal);
  assert.notDeepEqual(args.actor.pursuit.goal, partner.pursuit.goal);
  Object.assign(args.actor, args.actor.pursuit.goal);
  update(args, 1);
  assert.equal(args.actor.pursuit.phase, 'waiting');
  Object.assign(partner, partner.pursuit.goal);
  update(partnerArgs, 2);
  assert.equal(args.actor.pursuit.phase, 'recovering');
  assert.equal(partner.pursuit.phaseUntil, args.actor.pursuit.phaseUntil);
  partner.alive = false;
  assert.equal(update(args, 3), false);
  assert.equal(args.actor.pursuit.behavior, 'runner');
  assert.equal(args.actor.pursuit.partnerLost, true);
  assert.equal(args.actor.nextTurnTick, 3);
  const mismatched = structuredClone(partnerArgs.policy);
  mismatched.waypoints.reverse();
  assert.throws(
    () =>
      validatePursuitGoals(
        { version, actors: [args.policy, mismatched] },
        args.actors,
        args.geometry,
      ),
    /same ordered/,
  );
});

test('new Capture records pin v2 while historical Varied still resolves v1 and rejects relabelling', () => {
  const source = JSON.parse(readFileSync(new URL('../content/campaign.json', import.meta.url)))
    .levels[0];
  const historical = prepareRunningEnemyLevel(source, { style: 'varied' });
  const level = prepareRunningEnemyLevel(source, { style: 'varied', generation: version });
  assert.equal(historical.version, 'xonix-level.v12');
  assert.equal(level.version, 'xonix-level.v14');
  assert.deepEqual(level.runningEnemies, historical.runningEnemies);
  assert.equal(validateLevel({ ...level, version: historical.version }).valid, false);
  const run = createRun(level, { seed: 17 }),
    recorder = createRecorder(level, { seed: 17 });
  for (let i = 0; i < 130; i++) {
    const input = { direction: null };
    recordInput(recorder, input);
    stepRun(run, input, FIXED_DT);
    assert.equal(
      combatView(run).valid,
      true,
      'Clamped arrival speeds remain valid presentation data.',
    );
  }
  const replay = exportReplay(recorder, run),
    proof = verifyReplay(replay);
  assert.equal(replay.version, 'xonix-replay.v16');
  assert.equal(proof.match, true);
  assert.deepEqual(
    matchReplayInstalledRules({
      campaign: { levels: [source], classRecipes: replay.options.classRecipes },
      replay,
      state: proof.state,
    }),
    source,
  );
});

test('Team Continue pins v2 warning clocks and cannot be downgraded to the v1 save format', async () => {
  const source = COOP_STARTER_PACK.levels[1],
    tuning = resolveGameplayTuning('standard');
  const level = prepareTeamRunningEnemies(applyGameplayTuning(source, tuning), {
    style: 'varied',
    generation: version,
  });
  const run = startCoop(createCoop(level, { seed: 17 }));
  const recorder = createTeamHuntRecorder({
    run,
    pack: COOP_STARTER_PACK,
    level: source,
    tuning,
    encounterLevel: source,
    encounterVariant: 'authored',
    runningEnemies: true,
    attemptId: 'successor-warning',
    gameplayId: dataIdentity({ ruleset: run.ruleset, level }),
  });
  const commands = [0, 1].map(() => ({ direction: null, boost: false, support: false }));
  for (let tick = 0; tick < 80; tick++) {
    stepCoop(run, commands);
    recorder.append(commands);
  }
  const saved = recorder.snapshot();
  assert.equal(saved.format, 'revealline-team-hunt-attempt.v4');
  assert.equal(saved.pursuitGeneration, version);
  const restored = await restoreTeamHuntAttempt(saved, { pack: COOP_STARTER_PACK, level: source });
  assert.deepEqual(restored.run, run);
  const old = { ...saved, format: 'revealline-team-hunt-attempt.v3' };
  delete old.pursuitGeneration;
  await assert.rejects(restoreTeamHuntAttempt(old, { pack: COOP_STARTER_PACK, level: source }));
});

test('Refuge retains its announced goal through prolonged temporary actor congestion', () => {
  const args = fixture('refuge', [
    { x: 2.5, y: 4.5 },
    { x: 9.5, y: 4.5 },
  ]);
  update(args, 0);
  const goal = structuredClone(args.actor.pursuit.goal);
  const blocker = { ...args.actor, id: 'blocker', x: 4.9, y: 4.5 };
  args.actors.push(blocker);
  for (const tick of [96, 200, 400]) {
    update(args, tick);
    assert.equal(args.actor.pursuit.phase, 'blocked');
    assert.deepEqual(args.actor.pursuit.goal, goal);
  }
  blocker.alive = false;
  update(args, 401);
  assert.ok(args.actor.vx > 0);
  assert.deepEqual(args.actor.pursuit.goal, goal);
});

test('Switchback warns at a route corner and consumes the warning exactly once', () => {
  const args = fixture('switchback', [
    { x: 6.5, y: 2.5 },
    { x: 8.5, y: 5.5 },
  ]);
  update(args, 0);
  assert.equal(args.actor.pursuit.nextHeading, 'up');
  update(args, 96);
  assert.ok(args.actor.vy < 0);
  args.actor.y = 2.5;
  update(args, 97);
  assert.equal(args.actor.pursuit.phase, 'warning');
  assert.equal(args.actor.pursuit.nextHeading, 'right');
  assert.equal(args.actor.pursuit.heading, 'up');
  update(args, 192);
  assert.equal(args.actor.vx, 0);
  update(args, 193);
  assert.equal(args.actor.pursuit.phase, 'committed');
  assert.equal(args.actor.pursuit.heading, 'right');
  assert.ok(args.actor.vx > 0);
  update(args, 194);
  assert.equal(args.actor.pursuit.phase, 'committed');
});

test('native Capture and Team presentation show an eliminated pair’s survivor as an ordinary Runner', () => {
  for (const team of [false, true]) {
    const source = createPursuitPilotCandidates({ team });
    const mission = source.missions[team ? 1 : 0];
    const population = structuredClone(mission.pursuit.actors);
    for (let index = 0; index < 2; index++) {
      population[index].behavior = 'pair';
      population[index].partnerId = population[1 - index].id;
      population[index].waypoints = structuredClone(population[0].waypoints);
    }
    const accepted = selectedMissionPursuitSource(source, mission.id, population);
    const level = resolveMission(compileContentProject(accepted), mission.id, {
      mode: team ? 'team' : 'solo',
      difficulty: 'standard',
    }).level;
    const run = team ? startCoop(createCoop(level)) : createRun(level);
    const actors = team ? run.combatPatrols.actors : run.classic.combatPatrols.actors;
    const survivor = actors.find((actor) => actor.id === population[0].id);
    const caught = actors.find((actor) => actor.id === population[1].id);
    if (team) {
      eliminateCoopCombat(run, caught, 'ram', [0]);
      updateCoopCombat(run);
    } else {
      eliminateCombatPatrol(run, caught, 'ram');
      updateCombatPatrols(run);
    }
    const view = team ? coopCombatView(run) : combatView(run);
    assert.equal(view.valid, true);
    assert.equal(view.actors.find((actor) => actor.id === survivor.id).pursuit.behavior, 'runner');
    assert.equal(survivor.pursuit.phase, 'fallback');
  }
});
