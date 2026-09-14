import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  SCREEN_STEERING_HANDS,
  DEFAULT_SCREEN_STEERING_HAND,
  resolveScreenSteeringHand,
} from '../input-presentation.mjs';
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
const withoutHand = (source) => {
  const value = structuredClone(source);
  delete value.preferences.screenSteeringHand;
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

test('screen steering hand is strict finite presentation data with Left as the new-profile default', () => {
  assert.deepEqual(SCREEN_STEERING_HANDS, ['left', 'right']);
  assert.equal(Object.isFrozen(SCREEN_STEERING_HANDS), true);
  assert.equal(DEFAULT_SCREEN_STEERING_HAND, 'left');
  assert.equal(DEFAULT_PREFERENCES.screenSteeringHand, 'left');
  assert.equal(emptyLibrary().preferences.screenSteeringHand, 'left');
  for (const value of SCREEN_STEERING_HANDS) assert.equal(resolveScreenSteeringHand(value), value);
  for (const value of [undefined, null, false, 1, '', 'Right', 'right ', [], {}])
    assert.throws(() => resolveScreenSteeringHand(value), /steering hand/i);
});

test('original raw and enveloped profiles receive only an in-memory omitted-hand Left default', () => {
  for (const source of originals) {
    assert.equal(
      createHash('sha256').update(source.profileText).digest('hex'),
      source.profileSha256,
    );
    const old = JSON.parse(source.profileText);
    assert.equal(Object.hasOwn(old.preferences, 'screenSteeringHand'), false);
    for (const raw of [
      source.profileText,
      JSON.stringify({
        format: LIBRARY_STORAGE_VERSION,
        generation: 'generation-steering-hand-original',
        library: old,
      }),
    ]) {
      const local = storage({ profile: raw }),
        loaded = loadLibrary(local, 'profile');
      assert.equal(loaded.recovery, null);
      assert.equal(loaded.library.preferences.screenSteeringHand, 'left');
      for (const key of ['campaigns', 'gallery', 'scores', 'masteries'])
        assert.deepEqual(loaded.library[key], old[key] ?? []);
      assert.equal(local.getItem('profile'), raw);
      assert.deepEqual(local.writes, []);
    }
  }
  const old = withoutHand(current()),
    snapshot = structuredClone(old),
    migrated = importLibrary(old, options);
  assert.deepEqual(withoutHand(migrated), old);
  assert.equal(migrated.preferences.screenSteeringHand, 'left');
  assert.deepEqual(old, snapshot);
});

test('malformed explicit hands reject before storage access or backup image allocation', async () => {
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
  for (const screenSteeringHand of [undefined, null, false, 1, '', 'Right', 'right ', [], {}]) {
    const candidate = emptyLibrary();
    candidate.preferences.screenSteeringHand = screenSteeringHand;
    assert.equal(validateLibrary(candidate).valid, false);
    assert.throws(() => importLibrary(candidate));
    assert.throws(() => updatePreferences(emptyLibrary(), { screenSteeringHand }));
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

test('accessors and inherited hands cannot masquerade as an omitted Left default', () => {
  let reads = 0;
  const getter = withoutHand(emptyLibrary());
  Object.defineProperty(getter.preferences, 'screenSteeringHand', {
    enumerable: true,
    get() {
      reads++;
      return 'right';
    },
  });
  const inherited = withoutHand(emptyLibrary());
  Object.setPrototypeOf(inherited.preferences, { screenSteeringHand: 'right' });
  const local = storage({ profile: retained.profileText });
  for (const candidate of [getter, inherited]) {
    assert.throws(() => importLibrary(candidate));
    assert.equal(validateLibrary(candidate).valid, false);
    assert.equal(saveLibrary(local, 'profile', candidate).ok, false);
  }
  assert.deepEqual(local.writes, []);
  assert.equal(local.getItem('profile'), retained.profileText);
  assert.equal(reads, 0);
});

test('hand changes round trip without changing other preferences or collected metadata', () => {
  const before = current(),
    bytes = exportLibrary(before);
  for (const screenSteeringHand of SCREEN_STEERING_HANDS) {
    const selected = updatePreferences(before, { screenSteeringHand }),
      restored = importLibrary(exportLibrary(selected), options);
    assert.equal(restored.preferences.screenSteeringHand, screenSteeringHand);
    assert.deepEqual(withoutHand(restored), withoutHand(before));
  }
  assert.equal(exportLibrary(before), bytes);
});

test('an unrelated stale save keeps stored Right, while a deliberate Left change is explicit', () => {
  const local = storage({ profile: retained.profileText }),
    baseline = loadLibrary(local, 'profile'),
    saveOptions = { baseline: baseline.library, generation: baseline.generation };
  const remote = saveLibrary(
    local,
    'profile',
    updatePreferences(baseline.library, { screenSteeringHand: 'right' }),
    null,
    saveOptions,
  );
  assert.equal(remote.ok, true);
  const stale = updatePreferences(baseline.library, { musicVolume: 0.17 }),
    saved = saveLibrary(local, 'profile', stale, null, saveOptions);
  assert.equal(saved.ok, true);
  assert.equal(stale.preferences.screenSteeringHand, 'left');
  assert.equal(saved.library.preferences.screenSteeringHand, 'right');
  assert.equal(saved.library.preferences.musicVolume, 0.17);
  assert.deepEqual(loadLibrary(local, 'profile').library, saved.library);
  const explicit = updatePreferences(saved.library, { screenSteeringHand: 'left' });
  assert.equal(
    mergeLibraries(explicit, saved.library, { baseline: saved.library }).preferences
      .screenSteeringHand,
    'left',
  );
  const explicitSaved = saveLibrary(local, 'profile', explicit, null, {
    baseline: saved.library,
    generation: saved.generation,
  });
  assert.equal(explicitSaved.ok, true);
  assert.equal(loadLibrary(local, 'profile').library.preferences.screenSteeringHand, 'left');
  assert.equal(loadLibrary(local, 'profile').library.preferences.musicVolume, 0.17);
});

test('full backup, replacement and Undo keep the exact retained attempt and reject stale preference resurrection', async () => {
  const before = await prepareBackup(envelope(current(), retained.session), options),
    selected = {
      ...before,
      library: updatePreferences(before.library, { screenSteeringHand: 'right' }),
    },
    ready = await prepareBackup(await exportBackup(selected, options), options);
  assert.equal(ready.library.preferences.screenSteeringHand, 'right');
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
  assert.equal(imported.profile.library.preferences.screenSteeringHand, 'right');
  assert.equal(loadLibrary(local, 'profile').library.preferences.screenSteeringHand, 'right');
  assert.equal(local.getItem('session'), JSON.stringify(retained.session));
  const undone = await commitBackup(before, adapters);
  assert.equal(undone.ok, true);
  assert.equal(undone.profile.library.preferences.screenSteeringHand, 'left');
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

test('save denial leaves old bytes exact and the session hand choice exportable', () => {
  const local = storage({ profile: retained.profileText }),
    selected = updatePreferences(current(), { screenSteeringHand: 'right' });
  local.setItem = () => {
    throw new Error('quota exhausted');
  };
  const saved = saveLibrary(local, 'profile', selected);
  assert.equal(saved.ok, false);
  assert.equal(local.getItem('profile'), retained.profileText);
  assert.deepEqual(local.writes, []);
  assert.equal(importLibrary(exportLibrary(selected)).preferences.screenSteeringHand, 'right');
});
