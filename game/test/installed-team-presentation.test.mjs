import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCreatorTeamCampaign, prepareCreatorTeamCampaign } from '../creator/team.mjs';
import {
  createInstalledTeamAttempt,
  createInstalledTeamAttemptSnapshot,
  createInstalledTeamCampaignStore,
  installedTeamGameplayId,
  withInstalledTeamAttemptAppearance,
  nativeInstalledTeamAttempt,
  snapshotInstalledTeamPresentation,
  INSTALLED_TEAM_PRESENTATION_FORMAT,
} from '../creator/team-installed.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { stepCoop } from '../coop/core.mjs';
import { resolveGameplayTuning } from '../gameplay-tuning.mjs';
import {
  restoreAttemptAppearance,
  acceptAttemptAppearance,
} from '../presentation/attempt-appearance.mjs';
import { prepareIndustrialEnvironmentSource } from '../presentation/industrial-environments.mjs';
import { createPursuitCampaignCandidates } from '../content-design/pursuit-campaign-candidates.mjs';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';

async function fixture(t) {
  const generated = generateCreatorTeamCampaign({
    id: 'presentation-installed',
    name: 'Installed artwork',
    seed: 12,
  });
  const campaign = await prepareCreatorTeamCampaign(generated.pack, generated.provenance);
  const memory = managedIndexedDB(),
    store = createInstalledTeamCampaignStore({ indexedDB: memory.indexedDB });
  t.after(() => store.close());
  const { editionId } = await store.install(campaign),
    level = campaign.pack.levels[0];
  const run = createInstalledTeamAttempt(campaign.pack, level.id, 'standard', 'full');
  const commands = [
    { direction: 'down', boost: false, support: false },
    { direction: 'down', boost: false, support: false },
  ];
  for (let i = 0; i < 4; i++) stepCoop(run, commands);
  const native = createInstalledTeamAttemptSnapshot({
    editionId,
    attemptId: 'installed-art',
    gameplayId: installedTeamGameplayId(campaign.pack, level.id, 'standard', 'full'),
    presetId: 'full',
    run,
    tuning: resolveGameplayTuning('standard'),
    segments: [{ ticks: 4, commands }],
  });
  return { store, editionId, level, run, native };
}
const appearance = {
  artRevision: 'industrial-roster-v3',
  collection: { id: 'military-field', revision: 'r1' },
  environmentPin: null,
};

test('installed Team retains its selected artwork beside the unchanged native checkpoint', async (t) => {
  const f = await fixture(t),
    wrapped = withInstalledTeamAttemptAppearance(f.native, appearance);
  assert.equal(wrapped.format, INSTALLED_TEAM_PRESENTATION_FORMAT);
  assert.deepEqual(nativeInstalledTeamAttempt(wrapped), f.native);
  const progress = await f.store.recordAttempt(wrapped, { expectedGeneration: 0 });
  assert.deepEqual(progress.attempts[f.level.id], wrapped);
  assert.deepEqual((await f.store.inventory()).editions[0].progress.attempts[f.level.id], wrapped);
  const restored = await f.store.restoreAttempt(f.editionId, f.level.id);
  assert.deepEqual(restored.snapshot, f.native);
  assert.deepEqual(restored.run, f.run);
  assert.deepEqual(restoreAttemptAppearance(restored.attemptAppearance, null), appearance);
  await assert.rejects(f.store.recordAttempt(wrapped, { expectedGeneration: 0 }), /another tab/);
  assert.equal((await f.store.recordAttempt(wrapped, { expectedGeneration: 1 })).generation, 1);
  await f.store.clearAttempt({
    editionId: f.editionId,
    levelId: f.level.id,
    attemptId: f.native.attemptId,
    expectedGeneration: 1,
  });
  await assert.rejects(f.store.restoreAttempt(f.editionId, f.level.id), /no saved attempt/);
});

test('installed Team rejects malformed selection and never adopts built-in chapter authority', async (t) => {
  const f = await fixture(t),
    wrapped = withInstalledTeamAttemptAppearance(f.native, appearance);
  await f.store.recordAttempt(wrapped, { expectedGeneration: 0 });
  const invalid = structuredClone(wrapped);
  invalid.appearance.collection.revision = '';
  await assert.rejects(f.store.recordAttempt(invalid, { expectedGeneration: 1 }), /collection/);
  const project = createPursuitCampaignCandidates({ team: true });
  const owner = createCandidateTeamHost(project, {
    corePackIds: project.packs.map((pack) => pack.id),
  });
  const row = owner.rows.find((item) => item.difficulty === 'standard');
  const candidate = await prepareIndustrialEnvironmentSource({
    engine: 'capture',
    mode: 'team',
    source: row.level,
    origin: {
      kind: 'builtin',
      catalogueId: project.id,
      catalogueRevision: project.revision,
      sourceForm: `compiled-native-v1:${project.policyId}:standard`,
    },
  });
  assert.ok(candidate);
  const stolen = structuredClone(wrapped);
  stolen.appearance = acceptAttemptAppearance(candidate, appearance);
  await assert.rejects(
    f.store.recordAttempt(stolen, { expectedGeneration: 1 }),
    /built-in chapter/,
  );
  assert.deepEqual((await f.store.inventory()).editions[0].progress.attempts[f.level.id], wrapped);
});

test('installed Team historical saves and exact empty selection remain native', async (t) => {
  const f = await fixture(t);
  for (const value of [null, { artRevision: null, collection: null, environmentPin: null }])
    assert.deepEqual(withInstalledTeamAttemptAppearance(f.native, value), f.native);
  const old = snapshotInstalledTeamPresentation(f.native, f.editionId, f.level.id);
  assert.deepEqual(old.snapshot, f.native);
  assert.equal(old.attemptAppearance, null);
  await f.store.recordAttempt(f.native, { expectedGeneration: 0 });
  assert.equal((await f.store.restoreAttempt(f.editionId, f.level.id)).attemptAppearance, null);
});
