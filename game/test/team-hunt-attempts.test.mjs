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
