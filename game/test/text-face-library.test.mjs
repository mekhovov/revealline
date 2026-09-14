import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  emptyLibrary,
  importLibrary,
  exportLibrary,
  updatePreferences,
  loadLibrary,
  saveLibrary,
} from '../library.mjs';
import { prepareBackup, exportBackup } from '../backup.mjs';
import { emptyPackLibrary } from '../packs.mjs';
import { restoreSession } from '../sessions.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const retained = JSON.parse(
  readFileSync(new URL('./fixtures/controller-boost-profiles.json', import.meta.url)),
).sources[1];
const options = { campaigns: [retained.campaign] };

test('old profiles gain Pixel in memory without rewriting stored bytes or collected records', () => {
  let writes = 0;
  const storage = { getItem: () => retained.profileText, setItem: () => writes++ };
  const loaded = loadLibrary(storage, 'profile', options);
  assert.equal(loaded.recovery, null);
  assert.equal(loaded.library.preferences.textFace, 'pixel');
  const old = JSON.parse(retained.profileText);
  assert.equal(Object.hasOwn(old.preferences, 'textFace'), false);
  for (const key of ['campaigns', 'gallery', 'scores', 'masteries'])
    assert.deepEqual(loaded.library[key], old[key] ?? []);
  assert.equal(storage.getItem('profile'), retained.profileText);
  assert.equal(writes, 0);
});

test('Plain and Large travel together through a complete backup without changing a saved flight', async () => {
  const before = importLibrary(retained.profileText, options);
  const selected = updatePreferences(before, { textFace: 'plain', textSize: 'large' });
  const serialized = exportLibrary(selected);
  assert.deepEqual(importLibrary(serialized, options), selected);
  const restored = await prepareBackup(
    await exportBackup(
      {
        library: selected,
        packs: emptyPackLibrary(),
        session: retained.session,
      },
      options,
    ),
    options,
  );
  assert.deepEqual(restored.library, selected);
  assert.deepEqual(restored.session, retained.session);
  const flight = await restoreSession(restored.session, {
    campaign: retained.campaign,
    campaignKey: retained.session.campaignKey,
  });
  assert.deepEqual(authoritativeCheckpoint(flight.run), retained.session.replay.checkpoint);
  const reverted = updatePreferences(restored.library, {
    textFace: 'pixel',
    textSize: before.preferences.textSize,
  });
  assert.deepEqual(reverted, before);
});

test('unknown or malformed text styles refuse before storage access; an accessor is never invoked', () => {
  let reads = 0,
    writes = 0,
    getters = 0;
  const storage = {
    getItem: () => {
      reads++;
      return null;
    },
    setItem: () => writes++,
  };
  for (const textFace of [undefined, null, false, 1, '', 'Plain', 'plain ', [], {}]) {
    const candidate = emptyLibrary();
    candidate.preferences.textFace = textFace;
    assert.throws(() => importLibrary(candidate));
    assert.throws(() => updatePreferences(emptyLibrary(), { textFace }));
    assert.equal(saveLibrary(storage, 'profile', candidate).ok, false);
  }
  const accessor = emptyLibrary();
  Object.defineProperty(accessor.preferences, 'textFace', {
    enumerable: true,
    get() {
      getters++;
      return 'plain';
    },
  });
  assert.throws(() => importLibrary(accessor));
  assert.equal(getters, 0);
  assert.equal(reads, 0);
  assert.equal(writes, 0);
});
