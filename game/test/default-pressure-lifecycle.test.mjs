import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createAuthoredJourneyRoute, createCandidateSequence } from '../content-design/route.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../content-design/default-entry.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { resolveContentJourney } from '../content-design/journey.mjs';
import { createJourneyCatalog } from '../journey/catalog.mjs';
import { emptyJourneyProfile, applyJourneyEvent } from '../journey/profile.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { createRun, stepRun, FIXED_DT, CLASSES } from '../core/index.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import { dataIdentity } from '../data-json.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';

const fixture = JSON.parse(
  await readFile(new URL('./fixtures/default-pressure-lifecycle.json', import.meta.url)),
);
const route = createAuthoredJourneyRoute(DEFAULT_JOURNEY_ROUTES.solo);
const project = compileContentProject(route.source);
const baseRosters = {
  'return-in-reserve': ['carrier', 'keeper', 'outer', 'lower-keeper'],
  'crossed-bands': ['carrier', 'keeper', 'frontier'],
};
const options = (turnPolicy = 'immediate', seed = fixture.seed) => ({
  seed,
  turnPolicy,
  classId: 'scout',
  classRecipes: CLASSES,
});
function resolved(id, difficulty = 'standard', mode = 'solo') {
  const manifest = resolveMission(project, id, { difficulty, mode });
  const tuning = resolveGameplayTuning(difficulty);
  assert.equal(tuning.version, fixture.tuning);
  assert.equal(tuning.adminOverride, false);
  return { manifest, level: applyGameplayTuning(manifest.level, tuning) };
}

// No player, enemy, timer, cell, status or win-state injection. The recorder sees
// every public command; only observation snapshots are cloned for assertions.
function recording(level, turnPolicy) {
  const run = createRun(level, options(turnPolicy));
  const recorder = createRecorder(level, options(turnPolicy));
  const events = [];
  let turnedAfterWarning = false;
  function step(direction) {
    const actor = run.enemies.find((enemy) => enemy.id === 'carrier');
    const before = structuredClone(actor.classic.pressure);
    const previousDirection = run.player.direction;
    recordInput(recorder, { direction });
    stepRun(run, { direction }, FIXED_DT);
    events.push(...run.events.map((event) => structuredClone(event)));
    const after = run.enemies.find((enemy) => enemy.id === 'carrier').classic.pressure;
    if (['warning', 'committed'].includes(before.phase)) {
      if (run.player.direction !== previousDirection) turnedAfterWarning = true;
      if (['warning', 'committed'].includes(after.phase))
        assert.deepEqual(after.target, before.target, 'a live lock cannot retarget on a turn');
    }
  }
  return {
    run,
    events,
    step,
    play(segments) {
      for (const [direction, ticks] of segments)
        for (let tick = 0; tick < ticks; tick++) step(direction);
    },
    turned: () => turnedAfterWarning,
    replay: () => exportReplay(recorder, run),
  };
}

test('the lifecycle evidence targets the actual default, not a historical encounter study', () => {
  assert.equal(fixture.format, 'DefaultPressureLifecycleV1');
  assert.equal(route.id, fixture.route);
  assert.equal(DEFAULT_JOURNEY_ROUTES.versus, fixture.route);
  assert.equal(route.profileKey, 'journey-whole-spatial-v11');
  const historical = createAuthoredJourneyRoute('whole-spatial-v6');
  assert.notEqual(historical.profileKey, route.profileKey);
  for (const id of Object.keys(baseRosters))
    assert.equal(
      historical.source.missions
        .find((mission) => mission.id === id)
        .actors.some((actor) => ['trail-pursuer', 'heading-interceptor'].includes(actor.role)),
      false,
    );
});

for (const id of Object.keys(baseRosters))
  for (const difficulty of ['gentle', 'standard', 'expert'])
    test(`${id}/${difficulty}: effective roster and protected opening agree in Solo and both race boards`, () => {
      const { level } = resolved(id, difficulty);
      assert.deepEqual(resolved(id, difficulty, 'versus').level, level);
      const extras = difficulty === 'expert' ? (id === 'return-in-reserve' ? 2 : 1) : 0;
      assert.deepEqual(
        level.enemies.map((enemy) => enemy.id),
        [
          ...baseRosters[id],
          ...Array.from({ length: extras }, (_, index) => `pressure-extra-${index + 1}`),
        ],
      );
      const [pressure] = level.classic.enemyPressure.actors;
      assert.equal(level.classic.enemyPressure.actors.length, 1);
      assert.equal(pressure.id, 'carrier', 'density must not silently clone a pressure role');
      assert.equal(pressure.warningTicks, 90);
      assert.equal(pressure.commitTicks, 144);
      assert.equal(pressure.cooldownTicks, { gentle: 441, standard: 300, expert: 229 }[difficulty]);
      for (const turnPolicy of ['immediate', 'grid-center'])
        for (const seed of [1, 2]) {
          const run = createRun(level, options(turnPolicy, seed));
          const match = createDuel(level, options(turnPolicy, seed), {
            protocol: UNTIMED_DUEL_PROTOCOL,
            seconds: 0,
          });
          resumeDuel(match);
          for (let tick = 0; tick < 600; tick++) {
            stepRun(run, { direction: null }, FIXED_DT);
            stepDuel(match, [{ direction: null }, { direction: null }]);
            for (const board of [run, ...match.runs]) {
              assert.equal(board.status, 'running');
              assert.equal(board.classic.livesLost, 0);
              assert.equal(board.player.cutting, false);
              assert.equal(
                board.events.some((event) => event.type.startsWith('pressure.')),
                false,
              );
            }
          }
          for (const board of match.runs)
            assert.deepEqual(authoritativeCheckpoint(board), authoritativeCheckpoint(run));
          assert.notEqual(
            match.runs[0].enemies[0].classic.pressure,
            match.runs[1].enemies[0].classic.pressure,
          );
        }
    });

for (const row of fixture.lifecycle)
  test(`${row.id}/${row.turnPolicy}: actual warning, fixed commitment, capture-stop and finite recovery`, () => {
    const { level } = resolved(row.id);
    const played = recording(level, row.turnPolicy);
    played.play(row.segments);
    const { run, events } = played;
    assert.equal(run.tick, row.captureTick);
    assert.equal(run.status, 'running');
    assert.equal(run.classic.livesLost, 0);
    assert.equal(run.player.cutting, false);
    assert(run.claimedCount > 0);
    const warning = events.find((event) => event.type === 'pressure.warning');
    const committed = events.find((event) => event.type === 'pressure.committed');
    const cancelled = events.find((event) => event.type === 'pressure.cancelled');
    assert.equal(warning.tick, row.warningTick);
    assert.equal(committed.tick, row.commitTick);
    assert.equal(committed.actorTick - warning.actorTick, 90);
    assert.equal(committed.commitUntil - committed.actorTick, 144);
    assert.deepEqual(committed.target, warning.target);
    assert.equal(cancelled.tick, row.captureTick);
    assert.equal(cancelled.reason, 'trail-closed');
    assert.deepEqual(cancelled.target, warning.target);
    assert.equal(cancelled.cooldownUntil - cancelled.actorTick, 300);
    assert.equal(played.turned(), row.turnsAfterWarning);
    const pressure = () => run.enemies.find((enemy) => enemy.id === 'carrier').classic.pressure;
    assert.equal(pressure().phase, 'cooldown');
    assert.equal(pressure().target, null);
    assert.deepEqual(pressure().path, []);
    assert(events.some((event) => event.type === 'capture.stopped'));
    const stopped = { x: run.player.x, y: run.player.y };
    for (let tick = 0; tick < 10; tick++) {
      played.step(null);
      assert.deepEqual({ x: run.player.x, y: run.player.y }, stopped);
      assert.equal(run.classic.livesLost, 0);
    }
    for (let tick = 10; tick < 299; tick++) {
      played.step(null);
      assert.equal(pressure().phase, 'cooldown');
    }
    played.step(null);
    assert.equal(pressure().phase, 'patrol');
    assert.equal(pressure().cooldownUntil, null);
    assert.equal(events.filter((event) => event.type === 'pressure.warning').length, 1);
    const failures = events.filter((event) => event.type === 'player.failed');
    if (row.idleFrontierLossTick === null) assert.deepEqual(failures, []);
    else {
      // Reclaimed ground is not invulnerability: this deliberately idle craft
      // is reached by its existing frontier patrol, not a retargeted interceptor.
      assert.equal(failures.length, 1);
      assert.equal(failures[0].tick, row.idleFrontierLossTick);
      assert.equal(failures[0].actorId, 'frontier');
      assert.equal(failures[0].cause, 'enemy-player');
    }
    assert.equal(verifyReplay(played.replay()).match, true);
  });

for (const row of fixture.clears)
  test(`${row.id}: an earned clear retains its exact receipt and resolves the authored Next`, () => {
    const { manifest, level } = resolved(row.id);
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    const played = recording(level, row.turnPolicy);
    played.play(row.segments);
    const { run, events } = played;
    assert.equal(run.status, 'won');
    assert.equal(run.classic.livesLost, 0);
    assert.equal(run.tick, row.ticks);
    assert.equal(events.filter((event) => event.type === 'cut.closed').length, row.captures);
    assert(run.coverage >= level.goal.coverage);
    assert.equal(verifyReplay(played.replay()).match, true);

    // Exercise the same sequence, exact execution and local receipt contracts
    // consumed by hosts. This is not a native Next-button or persisted-IDB test.
    const journey = resolveContentJourney(project, { mode: 'solo', difficulty: 'standard' });
    const catalog = createJourneyCatalog(
      journey.campaigns.map(({ packId, runtime }) => ({
        ...runtime,
        packId,
        source: 'candidate',
        modes: ['solo'],
      })),
    );
    const sequence = createCandidateSequence(catalog, route.corePackIds, route.optionalCampaignIds);
    const mission = catalog.missions.find((item) => item.levelId === row.id);
    const next = sequence.next(mission.id);
    assert.equal(next.levelId, row.next);
    assert.equal(next.packId, mission.packId);
    assert.equal(next.campaignId, mission.campaignId);
    const gameplayId = dataIdentity({
      ruleset: run.ruleset,
      level: run.level,
      classes: run.classRecipes,
    });
    const completion = {
      type: 'complete',
      mode: 'solo',
      missionId: mission.id,
      runId: `pressure-${row.id}-${run.tick}`,
      gameplayId,
      difficulty: 'standard',
    };
    const completed = applyJourneyEvent(emptyJourneyProfile(), completion);
    const selected = applyJourneyEvent(completed, {
      type: 'select',
      mode: 'solo',
      missionId: next.id,
    });
    assert.deepEqual(selected.clears, completed.clears);
    assert.equal(selected.cursors.solo, next.id);
    assert.equal(selected.clears.solo[mission.id].gameplayId, gameplayId);
    assert.equal(Object.hasOwn(selected.clears.solo, next.id), false);
    const successor = resolved(next.levelId).level;
    assert.equal(createRun(successor, options()).levelId, row.next);
    assert.deepEqual(resolveMission(project, row.id).level, manifest.level);
  });
