import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { TEXT_SIZES, DEFAULT_TEXT_SIZE, resolveTextSize } from '../text-size.mjs';
import {
  DEFAULT_PREFERENCES,
  LIBRARY_STORAGE_VERSION,
  emptyLibrary,
  importLibrary,
  exportLibrary,
  validateLibrary,
  updatePreferences,
  mergeLibraries,
  loadLibrary,
  saveLibrary,
} from '../library.mjs';
import { BACKUP_FORMAT, prepareBackup, exportBackup } from '../backup.mjs';
import { commitBackup } from '../backup-storage.mjs';
import { emptyPackLibrary } from '../packs.mjs';
import { restoreSession } from '../sessions.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const json = (name) => JSON.parse(readFileSync(new URL(name, import.meta.url)));
const originals = json('./fixtures/controller-boost-profiles.json').sources;
const retained = originals[1];
const options = { campaigns: [retained.campaign] };
const current = () => importLibrary(retained.profileText, options);
const withoutSize = (source) => {
  const value = structuredClone(source);
  delete value.preferences.textSize;
  return value;
};
const envelope = (library, session = null, packs = emptyPackLibrary()) => ({
  format: BACKUP_FORMAT,
  library,
  packs,
  session,
});
function storage(entries = {}) {
  const map = new Map(Object.entries(entries)),
    writes = [];
  return {
    map,
    writes,
    getItem: (key) => map.get(key) ?? null,
    setItem(key, value) {
      writes.push([key, value]);
      map.set(key, String(value));
    },
    removeItem(key) {
      writes.push([key, null]);
      map.delete(key);
    },
  };
}

test('text size is a strict finite presentation preference with Standard as the new-profile default', () => {
  assert.deepEqual(TEXT_SIZES, ['standard', 'large']);
  assert.equal(Object.isFrozen(TEXT_SIZES), true);
  assert.equal(DEFAULT_TEXT_SIZE, 'standard');
  assert.equal(DEFAULT_PREFERENCES.textSize, 'standard');
  assert.equal(emptyLibrary().preferences.textSize, 'standard');
  for (const value of TEXT_SIZES) assert.equal(resolveTextSize(value), value);
  for (const value of [undefined, null, false, 1, '', 'Large', 'large ', [], {}])
    assert.throws(() => resolveTextSize(value), /text size/);
});

test('original raw and enveloped profiles receive only an in-memory omitted-size default', () => {
  for (const source of originals) {
    assert.equal(
      createHash('sha256').update(source.profileText).digest('hex'),
      source.profileSha256,
    );
    const old = JSON.parse(source.profileText);
    assert.equal(Object.hasOwn(old.preferences, 'textSize'), false);
    for (const raw of [
      source.profileText,
      JSON.stringify({
        format: LIBRARY_STORAGE_VERSION,
        generation: 'generation-text-size-original',
        library: old,
      }),
    ]) {
      const local = storage({ profile: raw }),
        loaded = loadLibrary(local, 'profile');
      assert.equal(loaded.recovery, null);
      assert.equal(loaded.library.preferences.textSize, 'standard');
      for (const key of ['campaigns', 'gallery', 'scores', 'masteries'])
        assert.deepEqual(loaded.library[key], old[key] ?? []);
      assert.equal(local.getItem('profile'), raw);
      assert.deepEqual(local.writes, []);
    }
  }
  const old = withoutSize(current()),
    snapshot = structuredClone(old),
    migrated = importLibrary(old, options);
  assert.deepEqual(withoutSize(migrated), old);
  assert.equal(migrated.preferences.textSize, 'standard');
  assert.deepEqual(old, snapshot);
});

test('malformed present sizes reject before storage access or backup image allocation', async () => {
  const local = storage();
  let reads = 0,
    decodes = 0;
  local.getItem = () => {
    reads++;
    throw new Error('Unexpected storage access');
  };
  const pack = json('../content/packs/night-shift.json');
  pack.visualOverrides = {
    background: {
      dataUrl:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=',
    },
  };
  const packs = { ...emptyPackLibrary(), packs: [pack] },
    decodeImage = async () => {
      decodes++;
      return { naturalWidth: 1, naturalHeight: 1 };
    };
  for (const textSize of [undefined, null, false, 1, '', 'Large', 'large ', [], {}]) {
    const candidate = emptyLibrary();
    candidate.preferences.textSize = textSize;
    assert.equal(validateLibrary(candidate).valid, false);
    assert.throws(() => importLibrary(candidate));
    assert.throws(() => updatePreferences(emptyLibrary(), { textSize }));
    assert.throws(() => mergeLibraries(candidate, emptyLibrary()));
    assert.equal(saveLibrary(local, 'profile', candidate, 'old corrupt bytes').ok, false);
    await assert.rejects(prepareBackup(envelope(candidate, null, packs), { decodeImage }));
  }
  assert.equal(reads, 0);
  assert.deepEqual(local.writes, []);
  assert.equal(decodes, 0);
  await prepareBackup(envelope(emptyLibrary(), null, packs), { decodeImage });
  assert.ok(decodes > 0, 'The valid control reaches the same real image-preparation boundary');
});

test('accessors and inherited values cannot masquerade as an omitted size', () => {
  let reads = 0;
  const getter = withoutSize(emptyLibrary());
  Object.defineProperty(getter.preferences, 'textSize', {
    enumerable: true,
    get() {
      reads++;
      return 'large';
    },
  });
  const inherited = withoutSize(emptyLibrary());
  Object.setPrototypeOf(inherited.preferences, { textSize: 'large' });
  assert.throws(() => importLibrary(getter));
  assert.throws(() => importLibrary(inherited));
  assert.equal(reads, 0);
});

test('size changes round trip without changing any other preference or collected metadata', () => {
  const before = current(),
    bytes = exportLibrary(before);
  for (const textSize of TEXT_SIZES) {
    const selected = updatePreferences(before, { textSize }),
      restored = importLibrary(exportLibrary(selected), options);
    assert.equal(restored.preferences.textSize, textSize);
    assert.deepEqual(withoutSize(restored), withoutSize(before));
  }
  assert.equal(exportLibrary(before), bytes);
});

test('an unrelated stale save adopts the stored size, while a deliberate Standard change remains explicit', () => {
  const local = storage({ profile: retained.profileText }),
    baseline = loadLibrary(local, 'profile'),
    saveOptions = { baseline: baseline.library, generation: baseline.generation };
  const remote = saveLibrary(
    local,
    'profile',
    updatePreferences(baseline.library, { textSize: 'large' }),
    null,
    saveOptions,
  );
  assert.equal(remote.ok, true);
  const stale = updatePreferences(baseline.library, { musicVolume: 0.17 }),
    saved = saveLibrary(local, 'profile', stale, null, saveOptions);
  assert.equal(saved.ok, true);
  assert.equal(stale.preferences.textSize, 'standard');
  assert.equal(saved.library.preferences.textSize, 'large');
  assert.equal(saved.library.preferences.musicVolume, 0.17);
  assert.deepEqual(loadLibrary(local, 'profile').library, saved.library);
  const explicit = updatePreferences(saved.library, { textSize: 'standard' });
  assert.equal(
    mergeLibraries(explicit, saved.library, { baseline: saved.library }).preferences.textSize,
    'standard',
  );
});

test('full backup, replacement and Undo keep the exact retained attempt and reject stale preference resurrection', async () => {
  const before = await prepareBackup(envelope(current(), retained.session), options),
    selected = { ...before, library: updatePreferences(before.library, { textSize: 'large' }) },
    ready = await prepareBackup(await exportBackup(selected, options), options);
  assert.equal(ready.library.preferences.textSize, 'large');
  assert.deepEqual(ready.session, retained.session);
  const restored = await restoreSession(ready.session, {
    campaign: retained.campaign,
    campaignKey: retained.session.campaignKey,
  });
  assert.deepEqual(authoritativeCheckpoint(restored.run), retained.session.replay.checkpoint);
  const local = storage({
      profile: exportLibrary(before.library),
      session: JSON.stringify(before.session),
    }),
    assets = new Map([['packs', JSON.stringify(before.packs)]]),
    adapters = {
      storage: local,
      profileKey: 'profile',
      sessionKey: 'session',
      packsKey: 'packs',
      journalKey: 'journal',
      lockKey: 'backup-lock',
      withLock: (work) => work(),
      readAsset: async (key) => structuredClone(assets.get(key) ?? null),
      writeAsset: async (key, value) => assets.set(key, structuredClone(value)),
      commitProfile: (library, settings) => saveLibrary(local, 'profile', library, null, settings),
    };
  const imported = await commitBackup(ready, adapters);
  assert.equal(imported.ok, true);
  assert.equal(imported.profile.library.preferences.textSize, 'large');
  assert.equal(loadLibrary(local, 'profile').library.preferences.textSize, 'large');
  assert.equal(local.getItem('session'), JSON.stringify(retained.session));
  const undone = await commitBackup(before, adapters);
  assert.equal(undone.ok, true);
  assert.equal(undone.profile.library.preferences.textSize, 'standard');
  assert.deepEqual(undone.profile.library, before.library);
  assert.equal(local.getItem('session'), JSON.stringify(retained.session));
  assert.notEqual(undone.profile.generation, imported.profile.generation);
  const afterUndo = local.getItem('profile');
  assert.equal(
    saveLibrary(local, 'profile', imported.profile.library, null, {
      baseline: imported.profile.library,
      generation: imported.profile.generation,
    }).ok,
    false,
  );
  assert.equal(local.getItem('profile'), afterUndo);
});

test('save failure leaves the old bytes exact and the selected session size exportable', () => {
  const local = storage({ profile: retained.profileText }),
    selected = updatePreferences(current(), { textSize: 'large' });
  local.setItem = () => {
    throw new Error('quota exhausted');
  };
  const saved = saveLibrary(local, 'profile', selected);
  assert.equal(saved.ok, false);
  assert.equal(local.getItem('profile'), retained.profileText);
  assert.deepEqual(local.writes, []);
  assert.equal(importLibrary(exportLibrary(selected)).preferences.textSize, 'large');
});
