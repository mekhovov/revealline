import test from 'node:test';
import assert from 'node:assert/strict';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { createTeamHuntTrainingCandidates } from '../content-design/team-hunt-training-candidates.mjs';
import { createCoop, pauseCoop, resumeCoop, startCoop, stepCoop } from '../coop/core.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { createInstalledTeamAttemptSnapshot } from '../creator/team-installed.mjs';
import { dataIdentity } from '../data-json.mjs';
import {
  createTeamHuntAttemptStore,
  createTeamHuntRecorder,
  restoreTeamHuntAttempt,
  matchingTeamHuntMirror,
  TEAM_HUNT_ATTEMPT_KEY,
} from '../coop/hunt-attempts.mjs';

function attempt(id = 'hunt-first-contact') {
  const source = createTeamHuntTrainingCandidates();
  const host = createCandidateTeamHost(source, {
    corePackIds: source.packs.map((pack) => pack.id),
  });
  const row = host.rows.find(
    (candidate) => candidate.difficulty === 'standard' && candidate.level.id === id,
  );
  const tuning = resolveGameplayTuning('standard');
  const run = startCoop(createCoop(applyGameplayTuning(row.level, tuning), { seed: 47 }));
  const recorder = createTeamHuntRecorder({
    run,
    pack: row.pack,
    level: row.level,
    tuning,
    encounterLevel: row.level,
    encounterVariant: 'authored',
    attemptId: 'saved-hunt',
  });
  const tick = (direction, boost = false) => {
    const commands = [
      { direction, boost, support: false },
      { direction: null, boost: false, support: false },
    ];
    recorder.append(commands);
    stepCoop(run, commands);
  };
  return { run, recorder, row, tick };
}

test('Team Hunt Continue preserves an earned kill, contribution, runner decision and pause release', async () => {
  const { run, recorder, row, tick } = attempt();
  while (run.tick < 360 && run.hunt.kills === 0) tick('down', true);
  assert.equal(run.hunt.score, 100);
  assert.deepEqual(run.combatPatrols.eliminations[0].players, [0]);
  recorder.release();
  pauseCoop(run);
  const restored = await restoreTeamHuntAttempt(recorder.snapshot(), row);
  assert.deepEqual(restored.run.combatPatrols, run.combatPatrols);
  assert.deepEqual(restored.run.hunt, run.hunt);
  assert.deepEqual(restored.run.needsNeutral, [true, true]);
  recorder.release();
  resumeCoop(run);
  tick(null);
  const resumed = await restoreTeamHuntAttempt(recorder.snapshot(), row);
  assert.deepEqual(resumed.run, run);
});

test('Team Hunt Continue preserves fixed guard aim and rejects altered inputs or sources', async () => {
  const { run, recorder, row, tick } = attempt('hunt-break-the-aim');
  while (run.tick < 900 && !run.combatPatrols.actors.some((actor) => actor.phase === 'warning'))
    tick(run.tick < 30 ? 'right' : null);
  const guard = run.combatPatrols.actors.find((actor) => actor.phase === 'warning');
  assert.ok(guard);
  const snapshot = recorder.snapshot();
  const restored = await restoreTeamHuntAttempt(snapshot, row);
  assert.deepEqual(
    restored.run.combatPatrols.actors.find((actor) => actor.id === guard.id),
    guard,
  );
  const changed = structuredClone(snapshot);
  changed.segments[0].commands[0].direction = 'left';
  await assert.rejects(restoreTeamHuntAttempt(changed, row), /verification/);
  await assert.rejects(
    restoreTeamHuntAttempt(snapshot, { ...row, pack: { ...row.pack, revision: 'other' } }),
    /exact Team mission/,
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(restoreTeamHuntAttempt(snapshot, { ...row, signal: controller.signal }), {
    name: 'AbortError',
  });
});

test('Team Hunt slot preserves competing, future and unreadable saves and supports explicit replacement', () => {
  const { recorder } = attempt();
  const snapshot = recorder.snapshot();
  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
    removeItem: (key) => memory.delete(key),
  };
  const store = createTeamHuntAttemptStore({ getStorage: () => storage });
  const raw = store.save(snapshot);
  const other = { ...snapshot, attemptId: 'other-hunt' };
  assert.throws(() => store.save(other), /Another Team Hunt save/);
  assert.throws(() => store.save(other, raw), /different Team Hunt/);
  const replacement = store.save(other, raw, { replaceAttemptId: snapshot.attemptId });
  assert.throws(() => store.discard(raw), /another tab/);
  assert.equal(store.read().raw, replacement);
  for (const unknown of ['{"format":"future.v99"}', '{broken']) {
    storage.setItem(TEAM_HUNT_ATTEMPT_KEY, unknown);
    assert.ok(store.read().error);
    assert.throws(() => store.save(snapshot, unknown));
    assert.equal(store.read().raw, unknown);
  }
});

test('installed Team Continue transfers its advanced journal into the separate Hunt slot', async () => {
  const { run, recorder, row, tick } = attempt();
  while (run.tick < 360 && run.hunt.kills === 0) tick('down', true);
  recorder.release();
  pauseCoop(run);
  resumeCoop(run);
  const snapshot = recorder.snapshot();
  const installed = createInstalledTeamAttemptSnapshot({
    editionId: 'a'.repeat(64),
    attemptId: 'installed-hunt',
    gameplayId: snapshot.gameplayId,
    presetId: 'full',
    run,
    tuning: snapshot.tuning,
    segments: snapshot.segments,
    encounterLevelIdentity: snapshot.encounterLevelIdentity,
  });
  const transferred = createTeamHuntRecorder({
    run,
    pack: row.pack,
    level: row.level,
    tuning: snapshot.tuning,
    encounterLevel: row.level,
    encounterVariant: 'authored',
    gameplayId: snapshot.gameplayId,
    restored: { snapshot: installed },
  });
  const restored = await restoreTeamHuntAttempt(transferred.snapshot(), row);
  assert.deepEqual(restored.run, run);
  assert.equal(restored.snapshot.attemptId, 'installed-hunt');
  assert.equal(restored.run.hunt.score, 100);
});

test('early initialized-level identities migrate only after the complete checkpoint verifies', async () => {
  const { run, recorder, row, tick } = attempt();
  const initializedIdentity = dataIdentity({ ruleset: run.ruleset, level: run.level });
  tick('down', true);
  const canonical = recorder.snapshot();
  const early = { ...canonical, gameplayId: initializedIdentity };
  const restored = await restoreTeamHuntAttempt(early, row);
  assert.equal(restored.snapshot.gameplayId, canonical.gameplayId);
  assert.equal(early.gameplayId, initializedIdentity);
  assert.deepEqual(restored.run, run);
  const damaged = {
    ...early,
    checkpoint: { ...early.checkpoint, stateIdentity: '0000000000000000' },
  };
  await assert.rejects(restoreTeamHuntAttempt(damaged, row), { code: 'verificationFailed' });
  await assert.rejects(restoreTeamHuntAttempt({ ...early, gameplayId: '0000000000000000' }, row), {
    code: 'rulesChanged',
  });
});

test('installed Continue adopts only a replay-verified older Hunt mirror from its exact history', async () => {
  const { run, recorder, row, tick } = attempt();
  while (run.tick < 100) tick('down', true);
  const earlier = recorder.snapshot();
  while (run.tick < 120) tick('down', true);
  const current = recorder.snapshot();
  const installed = createInstalledTeamAttemptSnapshot({
    editionId: 'a'.repeat(64),
    attemptId: current.attemptId,
    gameplayId: current.gameplayId,
    presetId: 'full',
    run,
    tuning: current.tuning,
    segments: current.segments,
    encounterLevelIdentity: current.encounterLevelIdentity,
  });
  const restored = { run: (await restoreTeamHuntAttempt(current, row)).run, snapshot: installed };
  const saved = { snapshot: earlier, raw: JSON.stringify(earlier) };
  assert.equal((await matchingTeamHuntMirror(restored, { ...row, saved }))?.raw, saved.raw);
  assert.equal(
    await matchingTeamHuntMirror(restored, {
      ...row,
      saved: { ...saved, snapshot: { ...earlier, attemptId: 'foreign' } },
    }),
    null,
  );
  const damaged = {
    ...earlier,
    checkpoint: { ...earlier.checkpoint, stateIdentity: '0000000000000000' },
  };
  assert.equal(
    await matchingTeamHuntMirror(restored, {
      ...row,
      saved: { snapshot: damaged, raw: JSON.stringify(damaged) },
    }),
    null,
  );
  while (run.tick < 140) tick('down', true);
  const newer = recorder.snapshot();
  assert.equal(
    await matchingTeamHuntMirror(restored, {
      ...row,
      saved: { snapshot: newer, raw: JSON.stringify(newer) },
    }),
    null,
  );
  assert.equal(
    await matchingTeamHuntMirror(restored, {
      ...row,
      saved: { snapshot: null, raw: '{future}' },
    }),
    null,
  );
  const memory = new Map([[TEAM_HUNT_ATTEMPT_KEY, saved.raw]]);
  const store = createTeamHuntAttemptStore({
    getStorage: () => ({
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => memory.set(key, value),
      removeItem: (key) => memory.delete(key),
    }),
  });
  const adopted = (await matchingTeamHuntMirror(restored, { ...row, saved: store.read() }))?.raw;
  const foreign = JSON.stringify({ ...earlier, attemptId: 'another-tab' });
  memory.set(TEAM_HUNT_ATTEMPT_KEY, foreign);
  assert.throws(() => store.save(current, adopted), /Another Team Hunt save/);
  assert.throws(() => store.discard(adopted), /another tab/);
  assert.equal(store.read().raw, foreign);
});

test('installed Continue promotes only an exactly verified same-tick pause release into both journals', async () => {
  const { run, recorder, row, tick } = attempt();
  while (run.tick < 100) tick('down', true);
  const before = recorder.snapshot();
  const installed = createInstalledTeamAttemptSnapshot({
    editionId: 'a'.repeat(64),
    attemptId: before.attemptId,
    gameplayId: before.gameplayId,
    presetId: 'full',
    run,
    tuning: before.tuning,
    segments: before.segments,
    encounterLevelIdentity: before.encounterLevelIdentity,
  });
  const restored = {
    run: (await restoreTeamHuntAttempt(before, row)).run,
    snapshot: installed,
    generation: 8,
  };
  recorder.release();
  pauseCoop(run);
  const paused = recorder.snapshot(),
    saved = { snapshot: paused, raw: JSON.stringify(paused) };
  const mirror = await matchingTeamHuntMirror(restored, { ...row, saved });
  assert.equal(mirror.raw, saved.raw);
  assert.ok(mirror.promotion);
  assert.deepEqual(mirror.promotion.run.needsNeutral, [true, true]);
  const promoted = {
    ...restored,
    raw: mirror.raw,
    run: mirror.promotion.run,
    snapshot: createInstalledTeamAttemptSnapshot({
      ...installed,
      run: mirror.promotion.run,
      segments: mirror.promotion.snapshot.segments,
      encounterVariant: mirror.promotion.snapshot.encounterVariant,
      encounterLevelIdentity: mirror.promotion.snapshot.encounterLevelIdentity,
    }),
  };
  assert.equal(promoted.generation, 8);
  assert.equal(promoted.snapshot.attemptId, installed.attemptId);
  assert.equal(promoted.snapshot.format, 'revealline-installed-team-attempt.v3');
  assert.deepEqual(promoted.snapshot.segments, paused.segments);
  const continued = createTeamHuntRecorder({
    run: promoted.run,
    pack: row.pack,
    level: row.level,
    tuning: before.tuning,
    encounterLevel: row.level,
    encounterVariant: 'authored',
    gameplayId: before.gameplayId,
    restored: promoted,
  });
  assert.deepEqual((await restoreTeamHuntAttempt(continued.snapshot(), row)).run, promoted.run);
  const corrupt = {
    ...paused,
    checkpoint: { ...paused.checkpoint, stateIdentity: '0000000000000000' },
  };
  assert.equal(
    await matchingTeamHuntMirror(restored, {
      ...row,
      saved: { raw: JSON.stringify(corrupt), snapshot: corrupt },
    }),
    null,
  );
});
