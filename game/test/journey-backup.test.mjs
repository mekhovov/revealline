import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyJourneyEvent,
  createJourneyBackend,
  createJourneyProfileStore,
  emptyJourneyProfile,
  inspectJourneyBackup,
  mergeJourneyBackup,
  JOURNEY_BACKUP_VERSION,
  validateJourneyProfile,
} from '../journey/profile.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { SoloElement } from './helpers/solo-dom.mjs';
import { attachJourneyBackup } from '../ui/journey-backup.mjs';

const receipt = (runId = 'old-run') => ({
  runId,
  gameplayId: 'edition-simulation-1',
  difficulty: 'expert',
});
const backup = () => {
  const profile = emptyJourneyProfile();
  profile.generation = 400;
  for (const mode of ['solo', 'versus', 'team']) {
    profile.cursors[mode] = `future/${mode}/next`;
    profile.clears[mode]['shared'] = receipt();
    profile.clears[mode]['missing'] = receipt('missing-run');
    profile.skipped[mode] = ['shared', 'skip-me'];
  }
  return { format: JOURNEY_BACKUP_VERSION, profile };
};

test('Journey restore merges missing progress for every mode while current receipts and cursors win', () => {
  const current = emptyJourneyProfile(),
    incoming = backup();
  current.clears.solo.shared = receipt('newer-run');
  current.cursors.solo = 'current-flight';
  current.skipped.solo = ['missing', 'old-skip'];
  const original = structuredClone(current),
    before = structuredClone(incoming);
  const merged = mergeJourneyBackup(current, incoming);
  assert.equal(merged.generation, 1, 'Never import a remote generation number');
  assert.equal(merged.clears.solo.shared.runId, 'newer-run');
  assert.equal(merged.clears.solo.missing.runId, 'missing-run');
  assert.equal(merged.cursors.solo, 'current-flight');
  assert.equal(merged.cursors.team, 'future/team/next');
  assert.deepEqual(merged.skipped.solo, ['old-skip', 'skip-me']);
  assert.deepEqual(merged.skipped.versus, ['skip-me']);
  assert.deepEqual(mergeJourneyBackup(merged, incoming), merged, 'Restore is idempotent');
  assert.deepEqual(current, original);
  assert.deepEqual(incoming, before);
  assert.deepEqual(Object.keys(merged), ['format', 'generation', 'cursors', 'skipped', 'clears']);
  assert.deepEqual(
    validateJourneyProfile(merged),
    merged,
    'Preserve the v1 record shape for rollback',
  );
});

test('malformed, oversized, prototype and invented receipt backups cannot modify state', () => {
  const badReceipt = backup();
  badReceipt.profile.clears.solo.shared.difficulty = 'impossible';
  const invalid = [
    null,
    {},
    { ...backup(), format: 'future' },
    { ...backup(), executable: 'code' },
    badReceipt,
    '{"format":"revealline-journey-backup.v1","__proto__":{}}',
    ' '.repeat(8 * 1024 * 1024 + 1),
  ];
  const store = createJourneyProfileStore({ backend: { read: async () => emptyJourneyProfile() } });
  for (const candidate of invalid) {
    assert.throws(() => inspectJourneyBackup(candidate));
    assert.throws(() => store.restore(candidate));
    assert.deepEqual(store.snapshot(), emptyJourneyProfile());
    assert.equal(store.status().pending, 0);
  }
  assert.throws(
    () =>
      inspectJourneyBackup({
        get format() {
          throw Error('Getter invoked');
        },
      }),
    /accessors/,
  );
});

test('restoration and live progress merge atomically across tabs in either transaction order', async () => {
  for (const restoreFirst of [true, false]) {
    const memory = managedIndexedDB();
    const a = createJourneyProfileStore({ backend: createJourneyBackend(memory) });
    const b = createJourneyProfileStore({ backend: createJourneyBackend(memory) });
    await Promise.all([a.load(), b.load()]);
    const live = () => {
      b.record({ type: 'complete', mode: 'solo', missionId: 'shared', ...receipt('live-run') });
      b.record({ type: 'select', mode: 'solo', missionId: 'live-flight' });
    };
    if (restoreFirst) {
      a.restore(backup());
      live();
    } else {
      live();
      a.restore(backup());
    }
    await Promise.all([a.flush(), b.flush()]);
    const persisted = await createJourneyBackend(memory).read();
    assert.equal(persisted.clears.solo.shared.runId, 'live-run');
    assert.equal(persisted.cursors.solo, 'live-flight');
    assert.equal(persisted.clears.team.missing.runId, 'missing-run');
    assert.deepEqual(persisted.skipped.solo, ['skip-me']);
  }
});

test('failed restore stays exportable in-session, retries and survives recreation without replacing saved history', async () => {
  let saved = emptyJourneyProfile(),
    failing = true;
  const backend = {
    async read() {
      if (failing) throw new Error('Offline storage');
      return saved;
    },
    async commit(events) {
      if (failing) throw new Error('Quota');
      saved = events.reduce(applyJourneyEvent, saved);
      return saved;
    },
  };
  const store = createJourneyProfileStore({ backend });
  store.restore(backup());
  assert.equal(await store.flush(), false);
  assert.equal(Object.keys(saved.clears.solo).length, 0);
  const exported = inspectJourneyBackup(store.export());
  assert.equal(exported.profile.clears.solo.missing.runId, 'missing-run');
  failing = false;
  assert.equal(await store.flush(), true);
  const recreated = createJourneyProfileStore({ backend });
  assert.deepEqual(await recreated.load(), store.snapshot());
  const generation = saved.generation;
  recreated.restore(store.export());
  await recreated.flush();
  assert.equal(saved.generation, generation);
});

test('corrupt durable data is not replaced by a valid imported backup', async () => {
  let writes = 0;
  const store = createJourneyProfileStore({
    backend: {
      read: async () => ({ ...emptyJourneyProfile(), format: 'damaged' }),
      commit: async () => {
        writes++;
        return emptyJourneyProfile();
      },
    },
  });
  store.restore(backup());
  assert.equal(await store.flush(), false);
  assert.equal(writes, 0);
  assert.equal(store.snapshot().clears.team.missing.runId, 'missing-run');
});

function dialogFixture() {
  const document = new Document();
  document.createElement = (tag) => new SoloElement(document, tag);
  const memory = managedIndexedDB(),
    profile = createJourneyProfileStore({ backend: createJourneyBackend(memory) });
  let restored = 0,
    exported = null;
  const api = attachJourneyBackup({
    document,
    profile,
    onRestore: () => restored++,
    exportFile: async (value) => {
      exported = value;
      return { message: 'Exported fixture' };
    },
  });
  return {
    api,
    profile,
    $: (id) => document.getElementById(id),
    restored: () => restored,
    exported: () => exported,
  };
}

test('backup dialog inspects without mutation, restores only on Apply, and exports the resulting profile', async () => {
  const { api, profile, $, restored, exported } = dialogFixture();
  await profile.load();
  api.open();
  $('journey-backup-file').files = [{ size: 1000, text: async () => JSON.stringify(backup()) }];
  await $('journey-backup-file').onchange();
  assert.equal(profile.snapshot().generation, 0);
  assert.equal($('journey-backup-apply').disabled, false);
  assert.match($('journey-backup-status').textContent, /solo: 2 missing clears/);
  await $('journey-backup-apply').onclick();
  assert.equal(restored(), 1);
  assert.equal(profile.snapshot().clears.solo.shared.runId, 'old-run');
  assert.match($('journey-backup-status').textContent, /saved locally/);
  await $('journey-backup-export').onclick();
  assert.deepEqual(exported().profile, profile.snapshot());
  api.close();
  assert.equal($('journey-backup').open, false);
});

test('closed dialogs and later file choices invalidate in-flight inspection; failed imports leave no Apply', async () => {
  const { api, profile, $ } = dialogFixture();
  api.open();
  let finish;
  $('journey-backup-file').files = [
    {
      size: 100,
      text: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    },
  ];
  const reading = $('journey-backup-file').onchange();
  api.close();
  finish(JSON.stringify(backup()));
  await reading;
  assert.equal($('journey-backup-apply').disabled, true);
  assert.equal(profile.snapshot().generation, 0);
  api.open();
  $('journey-backup-file').files = [{ size: 100, text: async () => JSON.stringify(backup()) }];
  await $('journey-backup-file').onchange();
  $('journey-backup-file').files = [{ size: 100, text: async () => '{bad-json' }];
  await $('journey-backup-file').onchange();
  assert.equal($('journey-backup-apply').disabled, true);
  assert.match($('journey-backup-status').textContent, /Cannot inspect/);
  await $('journey-backup-apply').onclick();
  assert.equal(profile.snapshot().generation, 0);
});
