import test from 'node:test';
import assert from 'node:assert/strict';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { createPursuitCampaignCandidates } from '../content-design/pursuit-campaign-candidates.mjs';
import { createCoop, startCoop, stepCoop } from '../coop/core.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import {
  createTeamHuntRecorder,
  createTeamHuntAttemptStore,
  restoreTeamHuntAttempt,
  snapshotTeamHuntPresentation,
  TEAM_PRESENTATION_ATTEMPT_FORMAT,
  TEAM_HUNT_ATTEMPT_KEY,
} from '../coop/hunt-attempts.mjs';
import {
  prepareIndustrialEnvironmentSource,
  resolveIndustrialEnvironment,
} from '../presentation/industrial-environments.mjs';
import {
  acceptAttemptAppearance,
  restoreAttemptAppearance,
} from '../presentation/attempt-appearance.mjs';
import { createCoopPainter } from '../couch/coop-view.mjs';

const project = createPursuitCampaignCandidates({ team: true });
const host = createCandidateTeamHost(project, {
  corePackIds: project.packs.map((pack) => pack.id),
});
const rows = host.rows.filter((row) => row.difficulty === 'standard');
async function environment(row) {
  const candidate = await prepareIndustrialEnvironmentSource({
    engine: 'capture',
    mode: 'team',
    source: row.level,
    origin: {
      kind: 'builtin',
      catalogueId: project.id,
      catalogueRevision: project.revision,
      sourceForm: `compiled-native-v1:${project.policyId}:${row.difficulty}`,
    },
  });
  assert.ok(candidate);
  return candidate;
}
async function fixture() {
  const row = rows[0],
    tuning = resolveGameplayTuning('standard');
  const run = startCoop(createCoop(applyGameplayTuning(row.level, tuning), { seed: 17 }));
  const recorder = createTeamHuntRecorder({
    run,
    pack: row.pack,
    level: row.level,
    tuning,
    encounterLevel: row.level,
    encounterVariant: 'authored',
    attemptId: 'p2-team',
  });
  const commands = [
    { direction: 'down', boost: false, support: false },
    { direction: null, boost: false, support: false },
  ];
  for (let i = 0; i < 4; i++) {
    recorder.append(commands);
    stepCoop(run, commands);
  }
  const candidate = await environment(row),
    appearance = acceptAttemptAppearance(candidate, {
      artRevision: 'industrial-roster-v3',
      collection: { id: 'military-field', revision: 'r1' },
    });
  const values = new Map(),
    storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    };
  const store = createTeamHuntAttemptStore({ getStorage: () => storage });
  return { row, run, recorder, candidate, appearance, store, storage };
}

test('Team save preserves native replay and source-restored artwork through later checkpoints', async () => {
  const f = await fixture(),
    native = f.recorder.snapshot();
  const raw = f.store.save(native, null, { attemptAppearance: f.appearance });
  const saved = f.store.read();
  assert.equal(saved.envelope.format, TEAM_PRESENTATION_ATTEMPT_FORMAT);
  assert.deepEqual(saved.snapshot, native);
  assert.deepEqual(saved.attemptAppearance, f.appearance);
  const restored = await restoreTeamHuntAttempt(raw, f.row);
  assert.deepEqual(restored.run, f.run);
  const accepted = restoreAttemptAppearance(restored.attemptAppearance, f.candidate);
  assert.deepEqual(
    resolveIndustrialEnvironment(accepted.environmentPin),
    resolveIndustrialEnvironment(f.appearance.environmentPin),
  );
  assert.throws(
    () => resolveIndustrialEnvironment(restored.attemptAppearance.environmentPin),
    /accepted/,
  );
  // Older checkpoint callers retain an existing same-attempt envelope rather than stripping it.
  const later = f.store.save(native, raw);
  assert.deepEqual(JSON.parse(later), saved.envelope);
  const checkpoint = JSON.stringify(f.run);
  assert.throws(() => restoreAttemptAppearance(restored.attemptAppearance, null), /authority/);
  assert.equal(JSON.stringify(f.run), checkpoint);
});

test('Team wrong-source or malformed appearance cannot replace the saved attempt or active native run', async () => {
  const f = await fixture(),
    native = f.recorder.snapshot();
  const raw = f.store.save(native, null, { attemptAppearance: f.appearance });
  const before = JSON.stringify(f.run);
  const wrong = acceptAttemptAppearance(await environment(rows[1]), {
    artRevision: 'industrial-roster-v3',
    collection: { id: 'military-field', revision: 'r1' },
  });
  const saved = f.store.read();
  const imported = { ...saved.envelope, appearance: wrong };
  const verified = await restoreTeamHuntAttempt(imported, f.row);
  assert.throws(() => restoreAttemptAppearance(verified.attemptAppearance, f.candidate), /source/);
  assert.throws(
    () =>
      f.store.save(native, raw, {
        attemptAppearance: { ...f.appearance, collection: { id: 'military-field', revision: '' } },
      }),
    /collection/,
  );
  assert.equal(f.store.read().raw, raw);
  assert.equal(JSON.stringify(f.run), before);
  assert.throws(
    () => f.store.save(native, null, { attemptAppearance: f.appearance }),
    /Another Team Hunt/,
  );
  assert.equal(f.storage.getItem(TEAM_HUNT_ATTEMPT_KEY), raw);
});

test('Team historical absence and exact empty triple stay native; each selected field keeps its envelope', async () => {
  const f = await fixture(),
    native = f.recorder.snapshot(),
    blank = { artRevision: null, collection: null, environmentPin: null };
  const raw = f.store.save(native, null, { attemptAppearance: blank });
  assert.deepEqual(JSON.parse(raw), native);
  assert.equal(snapshotTeamHuntPresentation(raw).attemptAppearance, null);
  assert.equal((await restoreTeamHuntAttempt(raw, f.row)).attemptAppearance, null);
  let previous = raw;
  for (const appearance of [
    { ...blank, artRevision: 'industrial-overhead-v2' },
    { ...blank, collection: { id: 'industrial-workshop', revision: 'r1' } },
    f.appearance,
  ]) {
    previous = f.store.save(native, previous, { attemptAppearance: appearance });
    assert.equal(JSON.parse(previous).format, TEAM_PRESENTATION_ATTEMPT_FORMAT);
    assert.deepEqual(f.store.read().attemptAppearance, appearance);
  }
});

test('Team renderer binds the original accepted object idempotently and rejects copied environment authority', async () => {
  const f = await fixture();
  const painter = createCoopPainter({ getContext: () => ({}) });
  painter.setAttemptAppearance(f.run, f.appearance);
  painter.setAttemptAppearance(f.run, f.appearance);
  assert.throws(
    () => painter.setAttemptAppearance(f.run, structuredClone(f.appearance)),
    /accepted/,
  );
  painter.setAttemptAppearance(f.run, null);
  painter.setAttemptAppearance(f.run, null);
});
