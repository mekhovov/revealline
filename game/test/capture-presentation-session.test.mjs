import test from 'node:test';
import assert from 'node:assert/strict';
import { createContentExecutionCatalog } from '../content-design/execution.mjs';
import { createPursuitCampaignCandidates } from '../content-design/pursuit-campaign-candidates.mjs';
import { prepareIndustrialEnvironmentSource } from '../presentation/industrial-environments.mjs';
import {
  acceptAttemptAppearance,
  restoreAttemptAppearance,
} from '../presentation/attempt-appearance.mjs';
import { createRun, CLASSES, stepRun, FIXED_DT } from '../core/index.mjs';
import { createRecorder, recordInput, authoritativeCheckpoint } from '../replay.mjs';
import { campaignKey, emptyLibrary } from '../library.mjs';
import { emptyPackLibrary } from '../packs.mjs';
import { suspendSession, snapshotSession } from '../sessions.mjs';
import {
  snapshotCaptureSession,
  withCaptureSessionAppearance,
  restoreCaptureSession,
  saveCaptureSession,
  nativeCaptureSession,
  captureSessionAppearance,
} from '../capture-presentation-session.mjs';
import { prepareAttemptExport } from '../attempt-export.mjs';
import { prepareBackup, exportBackup, BACKUP_FORMAT } from '../backup.mjs';
import { savedFlightPreview } from '../continuation.mjs';

const project = createPursuitCampaignCandidates();
const entry = createContentExecutionCatalog(project, { mode: 'solo' }).entries.find(
  (item) => item.difficulty === 'standard',
);
const campaign = { ...entry.campaign, classRecipes: CLASSES };
const origin = {
  kind: 'builtin',
  catalogueId: project.id,
  catalogueRevision: project.revision,
  sourceForm: `compiled-native-v1:${entry.policyVersion}:standard`,
};
async function environment(level = campaign.levels[0]) {
  const candidate = await prepareIndustrialEnvironmentSource({
    engine: 'capture',
    mode: 'solo',
    source: level,
    origin,
  });
  assert.ok(candidate);
  return candidate;
}
async function fixture() {
  const level = campaign.levels[0],
    options = { seed: 17, classId: 'scout', classRecipes: CLASSES };
  const run = createRun(level, options),
    recorder = createRecorder(level, options, 'test');
  const input = { direction: 'down' };
  for (let n = 0; n < 4; n++) {
    stepRun(run, input, FIXED_DT);
    recordInput(recorder, input);
  }
  const native = suspendSession({
    run,
    recorder,
    campaignKey: campaignKey(campaign),
    themeId: 'fpv',
    bodyId: 'fpv-body',
    runId: 'p2-capture-save',
    continuation: { direction: 'down' },
  });
  const appearance = acceptAttemptAppearance(await environment(), {
    artRevision: 'industrial-roster-v3',
    collection: { id: 'military-field', revision: 'r1' },
  });
  return { run, native, appearance, saved: withCaptureSessionAppearance(native, appearance) };
}
async function resolver(session, appearance, { signal } = {}) {
  const level = campaign.levels.find((item) => item.id === session.replay.level.id);
  const candidate = await prepareIndustrialEnvironmentSource({
    engine: 'capture',
    mode: 'solo',
    source: level,
    origin,
    signal,
  });
  return restoreAttemptAppearance(appearance, candidate);
}

test('Capture outer envelope preserves native replay and exact artwork through save/restore/export', async () => {
  const f = await fixture();
  assert.deepEqual(nativeCaptureSession(f.saved), f.native);
  assert.deepEqual(snapshotSession(nativeCaptureSession(f.saved)), f.native);
  assert.deepEqual(snapshotCaptureSession(f.native), f.native);
  assert.equal(captureSessionAppearance(f.native), null);
  let raw = 'prior';
  assert.equal(
    saveCaptureSession(
      {
        setItem: (_, value) => {
          raw = value;
        },
      },
      'slot',
      f.saved,
    ).ok,
    true,
  );
  assert.deepEqual(JSON.parse(raw), f.saved);
  const restored = await restoreCaptureSession(raw, {
    campaign,
    campaignKey: campaignKey(campaign),
  });
  assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(f.run));
  assert.deepEqual(await resolver(f.native, restored.attemptAppearance), f.appearance);
  const exported = await prepareAttemptExport(raw, {
    campaign,
    resolveAttemptAppearance: resolver,
  });
  assert.equal(exported.context, 'installed-campaign');
  assert.deepEqual(exported.session, f.saved);
  assert.deepEqual(
    savedFlightPreview(f.saved, [{ campaign, key: campaignKey(campaign) }]),
    savedFlightPreview(f.native, [{ campaign, key: campaignKey(campaign) }]),
  );
});

test('replay-only rescue preserves untrusted metadata without minting render authority', async () => {
  const f = await fixture();
  const result = await prepareAttemptExport(f.saved);
  assert.equal(result.context, 'replay-only');
  assert.deepEqual(result.session, f.saved);
  await assert.rejects(
    prepareAttemptExport(f.saved, { campaign }),
    /original mission artwork owner/,
  );
});

test('backup exact-source validation rejects another registered source pin without changing current state', async () => {
  const f = await fixture(),
    before = authoritativeCheckpoint(f.run);
  const data = {
    format: BACKUP_FORMAT,
    library: emptyLibrary(),
    packs: emptyPackLibrary(),
    session: f.saved,
  };
  const options = { campaigns: [campaign], resolveAttemptAppearance: resolver };
  const good = await prepareBackup(data, options);
  const roundtrip = await prepareBackup(await exportBackup(good, options), options);
  assert.deepEqual(roundtrip.session, f.saved);
  const wrong = acceptAttemptAppearance(await environment(campaign.levels[1]), {
    artRevision: 'industrial-roster-v3',
    collection: { id: 'military-field', revision: 'r1' },
  });
  const changed = structuredClone(data);
  changed.session.appearance = wrong;
  await assert.rejects(prepareBackup(changed, options), /native source/);
  await assert.rejects(
    prepareBackup(data, { campaigns: [campaign] }),
    /original mission artwork owner/,
  );
  assert.deepEqual(authoritativeCheckpoint(f.run), before);
  assert.deepEqual(good.session, f.saved);
});

test('invalid presentation never replaces the save slot; historical sessions remain unwrapped', async () => {
  const f = await fixture();
  let raw = JSON.stringify(f.native),
    writes = 0;
  const storage = {
    setItem: (_, value) => {
      raw = value;
      writes++;
    },
  };
  const broken = structuredClone(f.saved);
  broken.appearance.collection.revision = '';
  assert.equal(saveCaptureSession(storage, 'slot', broken).ok, false);
  assert.equal(writes, 0);
  assert.deepEqual(JSON.parse(raw), f.native);
  assert.deepEqual(withCaptureSessionAppearance(f.native, null), f.native);
});

test('only the exact empty accepted triple keeps native serialization; every selected artwork field is retained', async () => {
  const f = await fixture();
  const blank = { artRevision: null, collection: null, environmentPin: null };
  assert.deepEqual(withCaptureSessionAppearance(f.native, blank), f.native);
  for (const selected of [
    { ...blank, artRevision: 'industrial-overhead-v2' },
    { ...blank, collection: { id: 'industrial-workshop', revision: 'r1' } },
    f.appearance,
  ]) {
    const wrapped = withCaptureSessionAppearance(f.native, selected);
    assert.equal(wrapped.format, 'revealline-capture-presentation-session.v1');
    assert.deepEqual(captureSessionAppearance(wrapped), selected);
    assert.deepEqual(nativeCaptureSession(wrapped), f.native);
  }
});
