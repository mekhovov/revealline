import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { audioHarness } from './helpers/soundtrack-audio.mjs';
import { fixture, memoryIndexedDB, structuralProbe } from './helpers/soundtrack-fixtures.mjs';
import { mediaFixture, libraryRecord, pngBytes, provenance } from './helpers/media-fixtures.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { createSoundtrackStore } from '../soundtrack-store.mjs';
import { prepareSoundtrackLibrary } from '../soundtrack-bundle.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { prepareStillAsset } from '../media-still.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const scenario = JSON.parse(
  await readFile(new URL('../content/scenarios/line-impact-demo.json', import.meta.url), 'utf8'),
);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function contents(db) {
  async function own(value) {
    if (value instanceof Blob)
      return {
        blobBytes: value.size,
        mime: value.type,
        sha256: hash(Buffer.from(await value.arrayBuffer())),
      };
    if (Array.isArray(value)) return Promise.all(value.map(own));
    if (value && typeof value === 'object')
      return Object.fromEntries(
        await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await own(item)])),
      );
    return value;
  }
  return Object.fromEntries(
    await Promise.all(
      [...db.contents()].map(async ([name, rows]) => [
        name,
        await Promise.all([...rows].map(async ([key, value]) => [key, await own(value)])),
      ]),
    ),
  );
}
async function seeded(version) {
  const db = memoryIndexedDB(),
    original = await fixture();
  const library = {
    ...original.library,
    selection: { playlistId: 'qa.mix' },
    playlists: [
      {
        ...original.library.playlists[0],
        trackIds: [...original.library.playlists[0].trackIds].reverse(),
      },
    ],
  };
  const manager =
    version === 1
      ? null
      : createManagedMediaStore({ indexedDB: db.indexedDB, richStillMedia: version === 3 });
  const audio = createSoundtrackStore({
    indexedDB: db.indexedDB,
    ...(manager ? { managedStore: manager } : {}),
  });
  await audio.commit(
    await prepareSoundtrackLibrary(library, original.assets, { probeMedia: structuralProbe }),
    { expectedGeneration: 0 },
  );
  if (version === 3) {
    const f = mediaFixture(true);
    const still = await prepareStillAsset(
      new Blob([pngBytes()]),
      { id: 'picture-a', provenance: provenance() },
      { decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }) },
    );
    const raw = libraryRecord(f.identity);
    raw.assets = [still.asset];
    const store = createStillMediaStore({
      managedStore: manager,
      decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }),
    });
    await store.commit(
      await store.prepare(raw, [{ sha256: still.asset.sha256, blob: still.blob }], {
        executionCatalog: f.catalog,
      }),
      { expectedGeneration: 0 },
    );
    store.close();
  }
  audio.close();
  manager?.close();
  return { db, original, before: await contents(db), puts: db.allPuts.length };
}
async function journey(t, mode, version) {
  const f = await seeded(version),
    requestedVersions = [];
  const open = f.db.indexedDB.open;
  f.db.indexedDB.open = (...args) => {
    requestedVersions.push(args[1]);
    return open(...args);
  };
  const storage = memoryStorage(),
    audio = { ...audioHarness(), durationSeconds: f.original.track.asset.durationSeconds };
  const page = await soloPage(t, {
    search:
      mode === 'practice'
        ? '?practice=1'
        : mode === 'course'
          ? '?course=first-flight&lesson=close-line'
          : '',
    previewStorage: memoryStorage({ 'revealline.playground.current': JSON.stringify(scenario) }),
    storage,
    audio,
    soundtrackIndexedDB: f.db.indexedDB,
  });
  const checkpoint = authoritativeCheckpoint(page.rendered.run);
  page.$('settings-button').click();
  page.$('soundtrack-open').click();
  await settle(
    () => /Saved library loaded|Music library ready/.test(page.$('soundtrack-status')?.textContent),
    'Current-edition practice must read shared v3 custom music instead of retrying legacy v1.',
  );
  assert.equal(page.$('soundtrack-selection').value, 'qa.mix');
  assert.equal(page.$('soundtrack-dialog').open, true);
  assert.equal(requestedVersions[0], 4, 'Every current-edition audio host adopts its v4 manager.');
  assert.ok(requestedVersions.every((value) => value === 4));
  page.$('soundtrack-play').click();
  await settle(
    () =>
      page.$('soundtrack-now').textContent.includes('Synthetic coded silence') &&
      page.$('soundtrack-now').textContent.includes('playing'),
    'Stored custom MP3 must reach the real host player.',
  );
  assert.equal(page.audioElements[0].plays, 1);
  page.$('soundtrack-pause').click();
  await settle(() => page.$('soundtrack-now').textContent.includes('paused'));
  page.$('soundtrack-close').click();
  page.$('settings-dialog').close();
  page.frame(0);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.equal(f.db.allPuts.length, f.puts, 'Opening and playing do not commit any domain row.');
  const after = await contents(f.db);
  for (const [name, rows] of Object.entries(f.before))
    assert.deepEqual(after[name], rows, `${name} retains exact original bytes and metadata`);
  for (const [name, rows] of Object.entries(after))
    if (!(name in f.before)) assert.deepEqual(rows, [], 'Schema upgrade adds empty stores only.');
  if (mode !== 'ordinary') {
    assert.equal(
      page.rendered.backdrop,
      null,
      'Practice keeps authored artwork without managed picture pins.',
    );
    assert.equal(page.$('creator-tools').hidden, true);
    assert.deepEqual(
      storage.writes,
      [],
      'Practice music playback does not claim profile/session/award ownership.',
    );
  }
  assert.deepEqual(page.errors, []);
}
for (const mode of ['ordinary', 'practice', 'course'])
  test(`${mode}: shared v3 custom music reads and plays without changing existing audio/still history`, async (t) =>
    journey(t, mode, 3));
for (const version of [1, 2])
  test(`practice: current-edition v${version} to v4 opening preserves every original and metadata row`, async (t) =>
    journey(t, 'practice', version));
