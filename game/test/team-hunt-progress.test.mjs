import test from 'node:test';
import assert from 'node:assert/strict';
import { createTeamAttemptIdentity } from '../coop/attempt-identity.mjs';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { createTeamHuntTrainingCandidates } from '../content-design/team-hunt-training-candidates.mjs';
import { createTeamJourneyProgress } from '../content-design/team-progress.mjs';
import { createCoop, startCoop, stepCoop } from '../coop/core.mjs';
import { createTeamHuntRecorder, restoreTeamHuntAttempt } from '../coop/hunt-attempts.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { deriveEncounterLevel } from '../hunt/variants.mjs';
import { applyJourneyEvent, emptyJourneyProfile } from '../journey/profile.mjs';

function memory() {
  let saved = emptyJourneyProfile();
  return {
    read: async () => structuredClone(saved),
    commit: async (events) => {
      saved = events.reduce(applyJourneyEvent, saved);
      return structuredClone(saved);
    },
  };
}
function fixture({ variant = 'authored', overrides } = {}) {
  const source = createTeamHuntTrainingCandidates();
  // A small command-completable chapter fixture keeps the real core and source
  // admission, with the first reachable contact as its sole required goal.
  source.missions[0].hunt.mode = 'hunt';
  source.missions[0].hunt.quota = 1;
  source.missions[0].hunt.targets = source.missions[0].hunt.targets.filter(
    (target) => target.id === 'near-runner',
  );
  source.missions[0].actors = source.missions[0].actors.filter(
    (actor) => actor.id !== 'far-runner',
  );
  const journey = createCandidateTeamHost(source, {
    corePackIds: source.packs.map((pack) => pack.id),
  });
  const row = journey.rows.find((candidate) => candidate.difficulty === 'standard');
  const tuning = resolveGameplayTuning('standard', overrides);
  const encounterLevel = deriveEncounterLevel(row.level, variant, { mode: 'team' });
  const run = startCoop(createCoop(applyGameplayTuning(encounterLevel, tuning), { seed: 47 }));
  const recorder = createTeamHuntRecorder({
    run,
    pack: row.pack,
    level: row.level,
    tuning,
    encounterLevel,
    encounterVariant: variant,
    attemptId: 'continued-attempt',
  });
  const commands = [
    { direction: 'down', boost: true, support: false },
    { direction: null, boost: false, support: false },
  ];
  for (let i = 0; i < 100; i++) {
    recorder.append(commands);
    stepCoop(run, commands);
  }
  return { journey, row, run, recorder, commands };
}

test('Team Retry gets a fresh persistence identity while both stores and Continue share one ID', () => {
  const identity = createTeamAttemptIdentity('visit'),
    first = {},
    retry = {},
    continued = {};
  const firstId = identity(first);
  assert.equal(identity(first), firstId);
  assert.notEqual(identity(retry), firstId);
  assert.equal(identity(continued, { snapshot: { attemptId: firstId } }), firstId);
  assert.equal(identity(continued), firstId);
  assert.throws(() => identity(continued, { snapshot: { attemptId: 'different' } }), /changed/);
  const historical = {};
  assert.equal(
    identity(historical, { snapshot: { attemptId: 'old-picture-lease-id' } }),
    'old-picture-lease-id',
  );
});

test('an exact verified Team Hunt Continue can earn its owned Journey clear once with the retained ID', async () => {
  const { journey, row, recorder, commands } = fixture();
  const restored = await restoreTeamHuntAttempt(recorder.snapshot(), row);
  const backend = memory();
  const progress = createTeamJourneyProgress(journey, { backend, sessionId: 'new-visit' });
  await progress.load();
  assert.equal(progress.started(row, restored.run), false);
  assert.equal(
    progress.resumed(row, restored.run, { gameplayId: restored.snapshot.gameplayId }),
    true,
  );
  assert.equal(progress.resumed(row, restored.run), false);
  while (restored.run.status === 'running' && restored.run.tick < 240)
    stepCoop(restored.run, commands);
  assert.equal(restored.run.status, 'won');
  assert.equal(restored.run.hunt.touchKills, 1);
  assert.equal(progress.complete(restored.run), true);
  assert.equal(progress.complete(restored.run), false);
  await progress.retry();
  assert.deepEqual((await backend.read()).clears.team[row.mission.id], {
    runId: 'continued-attempt',
    gameplayId: restored.snapshot.gameplayId,
    difficulty: 'standard',
  });
  progress.dispose();
});

test('Team resume admission rejects unverified copies, different ownership, changed cores and recipe mismatches', async () => {
  const { journey, row, run, recorder } = fixture();
  const progress = createTeamJourneyProgress(journey, { backend: memory() });
  const restored = await restoreTeamHuntAttempt(recorder.snapshot(), row);
  assert.equal(progress.resumed(row, run), false);
  assert.equal(progress.resumed(row, structuredClone(restored.run)), false);
  assert.equal(progress.resumed({ ...row }, restored.run), false);
  assert.equal(
    progress.resumed(
      journey.rows.find((candidate) => candidate.level.id !== row.level.id),
      restored.run,
    ),
    false,
  );
  assert.equal(progress.resumed(row, restored.run, { gameplayId: '0000000000000000' }), false);
  assert.equal(progress.resumed(row, restored.run, { adminOverride: true }), false);
  restored.run.hunt.score++;
  assert.equal(progress.resumed(row, restored.run), false);
  assert.equal(progress.snapshot().generation, 0);
  progress.dispose();
});

test('verified optional variants and admin tuning cannot gain authored Team Journey receipts', async () => {
  for (const options of [{ variant: 'bonus' }, { overrides: { playerSpeed: 1.1 } }]) {
    const { journey, row, recorder } = fixture(options);
    const restored = await restoreTeamHuntAttempt(recorder.snapshot(), row);
    const progress = createTeamJourneyProgress(journey, { backend: memory() });
    assert.equal(progress.resumed(row, restored.run), false);
    assert.equal(progress.snapshot().generation, 0);
    progress.dispose();
  }
});
