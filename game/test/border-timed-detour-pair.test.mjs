import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dataIdentity } from '../data-json.mjs';
import {
  createBorderTimedDetourPairCandidates,
  BORDER_TIMED_DETOUR_MISSIONS,
} from '../content-design/border-timed-detour-pair.mjs';
import { createWholeErosionReviewCandidates } from '../content-design/whole-spatial-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../content-design/default-entry.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { classicEffectActive } from '../core/classic-state.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';

const source = createBorderTimedDetourPairCandidates();
const project = compileContentProject(source);
const presets = ['gentle', 'standard', 'expert'];
const controls = ['immediate', 'grid-center'];
const clearEvidence = JSON.parse(
  await readFile(new URL('./fixtures/border-timed-detour-clears.json', import.meta.url)),
);
const prepared = (id, difficulty, mode = 'solo') =>
  applyGameplayTuning(
    resolveMission(project, id, { difficulty, mode }).level,
    resolveGameplayTuning(difficulty),
  );

function play(level, segments, { seed = 1, turnPolicy = 'immediate', stopAtClosure = false } = {}) {
  const options = { seed, turnPolicy, classId: 'scout' };
  const run = createRun(level, options);
  const recorder = createRecorder(level, options);
  const events = [];
  const inputs = [];
  outer: for (const [direction, ticks] of segments)
    for (let tick = 0; tick < ticks; tick++) {
      assert.equal(run.status, 'running', 'No inputs beyond a terminal state');
      const input = { direction };
      recordInput(recorder, input);
      stepRun(run, input, FIXED_DT);
      inputs.push(input);
      events.push(...run.events);
      if (
        run.classic.livesLost ||
        (stopAtClosure && run.events.some((e) => e.type === 'cut.closed'))
      )
        break outer;
    }
  return { run, events, inputs, replay: exportReplay(recorder, run) };
}

function collectionRoute(id, difficulty) {
  return id === 'turn-the-corner'
    ? [
        [null, 2880],
        ['up', 200],
      ]
    : [
        [null, difficulty === 'standard' ? 900 : 720],
        ['right', 109],
        ['up', 110],
      ];
}

test('two optional successors preserve current geometry, actors, goals, pictures, order and untouched introduction', () => {
  const before = createWholeErosionReviewCandidates();
  assert.equal(DEFAULT_JOURNEY_ROUTES.solo, 'whole-spatial-v11');
  assert.deepEqual(source.maps, before.maps);
  assert.deepEqual(source.assets, before.assets);
  assert.equal(source.policyId, before.policyId);
  assert.equal(source.actorCatalogId, before.actorCatalogId);
  assert.equal(source.difficultyCatalogId, before.difficultyCatalogId);
  assert.deepEqual(
    source.missions.map((m) => m.id),
    before.missions.map((m) => m.id),
  );
  for (const old of before.missions) {
    const current = source.missions.find((m) => m.id === old.id);
    if (!BORDER_TIMED_DETOUR_MISSIONS.includes(old.id)) assert.deepEqual(current, old);
    else {
      const { revision, design, timedBonuses, ...untouched } = current;
      const { revision: priorRevision, design: priorDesign, ...prior } = old;
      assert.notEqual(revision, priorRevision);
      assert.deepEqual(untouched, prior);
      assert.deepEqual(design.difficulty, priorDesign.difficulty);
      assert.deepEqual(design.introduces, priorDesign.introduces);
      assert.equal(timedBonuses.version, 'timed-bonuses.v2');
      assert.equal(timedBonuses.schedules.length, 1);
      assert.equal(timedBonuses.schedules[0].maxCollections, 1);
      assert.equal(timedBonuses.schedules[0].maxAppearances, 3);
    }
  }
  for (const collection of ['campaigns', 'packs'])
    assert.deepEqual(
      source[collection].map(({ revision, ...item }) => item),
      before[collection].map(({ revision, ...item }) => item),
    );
  const pictured = createBorderTimedDetourPairCandidates({ artwork: true });
  const priorPictures = createWholeErosionReviewCandidates({ artwork: true });
  assert.deepEqual(pictured.assets, priorPictures.assets);
  assert.deepEqual(
    pictured.missions.map((m) => m.presentation),
    priorPictures.missions.map((m) => m.presentation),
  );
});

test('current gp4 schedules do not scale with presets or turn styles; actual enemy pressure still does', () => {
  const historical = compileContentProject(createWholeErosionReviewCandidates());
  for (const id of BORDER_TIMED_DETOUR_MISSIONS) {
    const levels = presets.map((difficulty) => prepared(id, difficulty));
    for (const [index, level] of levels.entries()) {
      assert.deepEqual(level.classic.timedBonuses, levels[1].classic.timedBonuses);
      assert.deepEqual(level.goal, levels[1].goal);
      assert.deepEqual(level.objectives, levels[1].objectives);
      const difficulty = presets[index];
      const original = applyGameplayTuning(
        resolveMission(historical, id, { difficulty }).level,
        resolveGameplayTuning(difficulty),
      );
      assert.deepEqual(level.classic.lineImpact, original.classic.lineImpact);
      assert.deepEqual(level.enemies, original.enemies);
      assert.deepEqual(level.rules, original.rules);
    }
    assert(levels[2].enemies.length > levels[1].enemies.length);
    assert.notEqual(levels[0].enemies[0].vx, levels[1].enemies[0].vx);
  }
});

for (const difficulty of presets)
  test(`${difficulty}: safe early returns, collection and missed-window relocation use real commands`, () => {
    for (const id of BORDER_TIMED_DETOUR_MISSIONS)
      for (const turnPolicy of controls) {
        const level = prepared(id, difficulty);
        const definition = level.classic.timedBonuses.schedules[0];
        for (const seed of [1, 2]) {
          const opening = play(level, [['up', 360]], { seed, turnPolicy, stopAtClosure: true });
          assert.equal(opening.run.classic.livesLost, 0, `${id}/${seed}/${turnPolicy}`);
          assert(opening.events.some((e) => e.type === 'cut.closed'));
          assert(opening.run.tick < definition.initialDelayTicks);
          assert.equal(opening.run.classic.timedBonuses.schedules[0].collections, 0);
          assert.equal(verifyReplay(opening.replay).match, true);
        }

        const missed = play(level, [[null, definition.initialDelayTicks + 2400]], { turnPolicy });
        assert.equal(missed.run.classic.livesLost, 0);
        assert.equal(missed.run.classic.timedBonuses.schedules[0].collections, 0);
        const announced = missed.events.filter((e) => e.type === 'bonus.announced');
        const appearances = missed.events.filter((e) => e.type === 'bonus.appeared');
        const expiries = missed.events.filter((e) => e.type === 'bonus.expired');
        assert.equal(appearances.length, 2);
        assert.equal(expiries.length, 1);
        assert.equal(announced[0].tick, definition.initialDelayTicks);
        assert.equal(appearances[0].tick - announced[0].tick, definition.announcementTicks);
        assert.equal(expiries[0].tick - appearances[0].tick, definition.availableTicks);
        assert.equal(announced[1].tick - expiries[0].tick, definition.cooldownTicks);
        assert.notDeepEqual(
          [appearances[0].x, appearances[0].y],
          [appearances[1].x, appearances[1].y],
        );
        assert.equal(verifyReplay(missed.replay).match, true);

        const taken = play(level, collectionRoute(id, difficulty), {
          turnPolicy,
          stopAtClosure: true,
        });
        assert.equal(taken.run.classic.livesLost, 0);
        assert(taken.events.some((e) => e.type === 'cut.closed'));
        const collected = taken.events.filter(
          (e) => e.type === 'powerup.collected' && e.id === definition.id,
        );
        assert.equal(collected.length, 1);
        assert.equal(taken.run.classic.timedBonuses.schedules[0].phase, 'exhausted');
        assert.equal(classicEffectActive(taken.run, definition.kind), true);
        const appeared = taken.events.filter((e) => e.type === 'bonus.appeared').at(-1);
        assert.deepEqual([collected[0].x, collected[0].y], [appeared.x, appeared.y]);
        assert(collected[0].tick >= appeared.tick);
        assert(collected[0].tick < appeared.tick + definition.availableTicks);
        assert.equal(collected[0].activationTick, collected[0].tick + 1);
        assert.equal(verifyReplay(taken.replay).match, true);
      }
  });

test('an available pickup is optional, not a promise that the same departure timing is safe in every preset', () => {
  for (const turnPolicy of controls) {
    // Preserve the first observed Standard route failure rather than silently
    // presenting the Gentle/Expert timing as universally safe.
    const failed = play(
      prepared('return-pocket', 'standard'),
      [
        [null, 720],
        ['right', 109],
        ['up', 110],
      ],
      { turnPolicy },
    );
    assert.equal(failed.run.classic.livesLost, 1);
    assert.equal(failed.run.tick, 815);
    assert.equal(failed.run.classic.timedBonuses.schedules[0].collections, 0);
    assert.equal(failed.events.find((e) => e.type === 'player.failed').actorId, 'frontier');
    assert.equal(verifyReplay(failed.replay).match, true);
  }
});

test('crossing an announced outline before appearance grants nothing; ignored schedules exhaust their finite budget', () => {
  const outline = play(prepared('return-pocket', 'standard'), [
    [null, 600],
    ['right', 109],
  ]);
  assert.equal(outline.run.classic.livesLost, 0);
  assert.equal(outline.run.tick, 709);
  const announced = outline.events.find((event) => event.type === 'bonus.announced');
  assert(Math.hypot(outline.run.player.x - announced.x, outline.run.player.y - announced.y) < 0.04);
  assert.equal(outline.run.classic.timedBonuses.schedules[0].phase, 'announce');
  assert.equal(outline.run.classic.timedBonuses.schedules[0].collections, 0);
  assert(!outline.events.some((event) => event.type === 'powerup.collected'));
  assert.equal(verifyReplay(outline.replay).match, true);
  for (const id of BORDER_TIMED_DETOUR_MISSIONS) {
    const ignored = play(prepared(id, 'standard'), [[null, 7000]]);
    const schedule = ignored.run.classic.timedBonuses.schedules[0];
    assert.equal(ignored.run.classic.livesLost, 0);
    assert.equal(schedule.appearances, 3);
    assert.equal(schedule.collections, 0);
    assert.equal(schedule.phase, 'exhausted');
    assert.equal(ignored.events.filter((event) => event.type === 'bonus.expired').length, 3);
    assert.equal(verifyReplay(ignored.replay).match, true);
  }
});

test('Standard paired boards receive independent schedules and equal actual collection/return histories', () => {
  for (const id of BORDER_TIMED_DETOUR_MISSIONS) {
    const level = prepared(id, 'standard', 'versus');
    const expected = play(level, collectionRoute(id, 'standard'), { stopAtClosure: true });
    const match = createDuel(
      level,
      { seed: 1, classId: 'scout', turnPolicy: 'immediate' },
      { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 },
    );
    assert.notEqual(match.runs[0].classic.timedBonuses, match.runs[1].classic.timedBonuses);
    resumeDuel(match);
    for (const input of expected.inputs) stepDuel(match, [input, input]);
    assert(match.runs.every((run) => run.classic.livesLost === 0));
    assert(match.runs.every((run) => run.classic.timedBonuses.schedules[0].collections === 1));
    assert.deepEqual(
      authoritativeCheckpoint(match.runs[0]),
      authoritativeCheckpoint(match.runs[1]),
    );
    assert.deepEqual(authoritativeCheckpoint(match.runs[0]), authoritativeCheckpoint(expected.run));
  }
});

test('both Standard missions earn actual no-loss clears and exact replays without any bonus collection', () => {
  assert.equal(clearEvidence.format, 'BorderTimedDetourClearEvidenceV1');
  assert.deepEqual(
    clearEvidence.rows.map((row) => row.id),
    BORDER_TIMED_DETOUR_MISSIONS,
  );
  for (const row of clearEvidence.rows) {
    const level = prepared(row.id, row.difficulty);
    assert.equal(
      dataIdentity({ level, gameplayTuning: resolveGameplayTuning(row.difficulty) }),
      row.simulationIdentity,
    );
    const { run, events, replay } = play(level, row.segments, row);
    assert.equal(run.status, 'won');
    assert.equal(run.classic.livesLost, 0);
    assert.equal(run.tick, row.ticks);
    assert.equal(run.coverage, row.coverage);
    assert.equal(authoritativeCheckpoint(run).hash, row.checkpoint);
    assert.equal(events.filter((e) => e.type === 'cut.closed').length, row.cuts);
    assert.equal(events.filter((e) => e.type === 'powerup.collected').length, 0);
    assert.equal(run.classic.timedBonuses.schedules[0].collections, 0);
    assert(events.some((e) => e.type === 'bonus.expired'));
    const verified = verifyReplay(replay);
    assert.equal(verified.match, true);
    assert.equal(verified.state.status, 'won');
  }
});
