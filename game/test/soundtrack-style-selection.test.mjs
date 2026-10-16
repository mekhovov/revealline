import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createSoundtrackStore } from '../soundtrack-store.mjs';
import { prepareSoundtrackLibrary } from '../soundtrack-bundle.mjs';
import {
  emptySoundtrackLibrary,
  upgradeSoundtrackLibrary,
  SOUNDTRACK_GENRES,
} from '../soundtrack.mjs';
import {
  SOUNDTRACK_STYLE_SELECTION_KEY,
  soundtrackStyleSelection,
  validateSoundtrackStyleSelection,
} from '../soundtrack-style-selection.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

const oldBytes = await readFile(
  new URL('./fixtures/managed-media-store-pr779.mjs.txt', import.meta.url),
);
assert.equal(
  createHash('sha256').update(oldBytes).digest('hex'),
  '65d9249677045e7d7aad1d99003aeeac5adc9b72ea0b045be7a08b8480219885',
);
// Preserve the exact historical reader/writer; only resolve its original imports.
const oldSource = oldBytes
  .toString()
  .replace(
    /((?:from\s*|import\()['"])(\.[^'"]+)(['"])/g,
    (_match, before, path, after) =>
      `${before}${new URL(path, new URL('../managed-media-store.mjs', import.meta.url))}${after}`,
  );
const previous = await import(
  `data:text/javascript;base64,${Buffer.from(oldSource).toString('base64')}`
);
const prepare = (library = emptySoundtrackLibrary({ catalogue: true })) =>
  prepareSoundtrackLibrary(library, []);
function setup(t) {
  const memory = managedIndexedDB();
  const store = createSoundtrackStore({ indexedDB: memory.indexedDB, soundtrackCatalogue: true });
  const old = previous.createManagedMediaStore({
    indexedDB: memory.indexedDB,
    soundtrackCatalogue: true,
  });
  t.after(() => {
    store.close();
    old.close();
  });
  return { memory, store, old };
}

test('exact public choices use a bounded independent record and reject invalid style identities', () => {
  assert.deepEqual(soundtrackStyleSelection(['fpv', 'fusion'], 2).styles, ['fusion', 'fpv']);
  for (const styles of [[], ['fpv', 'fpv'], ['invalid'], Array(11).fill('synth'), null])
    assert.throws(() => soundtrackStyleSelection(styles, 2));
  assert.throws(() =>
    validateSoundtrackStyleSelection({ ...soundtrackStyleSelection(['fpv'], 1), extra: true }),
  );
  assert.throws(() => soundtrackStyleSelection(['fpv'], -1));
});

test('historical reader accepts new saved styles and an old writer invalidates only the optional selection', async (t) => {
  const { memory, store, old } = setup(t);
  const prepared = await prepare();
  const saved = await store.commit(prepared, {
    expectedGeneration: 0,
    publicStyles: ['fusion', 'fpv'],
  });
  assert.deepEqual(saved.publicStyles, ['fusion', 'fpv']);
  const historical = await old.readDomain('audio');
  assert.deepEqual(historical.library, saved.library);
  assert.equal(historical.publicStyles, undefined);
  assert.deepEqual(Object.keys(memory.contents().get('metadata').get('library')).sort(), [
    'generation',
    'library',
  ]);
  assert.deepEqual((await store.read()).publicStyles, ['fusion', 'fpv']);
  // An older unrelated write is indistinguishable from an explicit old choice.
  // Its generation advance conservatively invalidates exact public metadata.
  await old.commitDomain('audio', prepared, { expectedGeneration: saved.generation });
  assert.equal((await store.read()).publicStyles, undefined);
  assert.equal(memory.contents().get('metadata').get(SOUNDTRACK_STYLE_SELECTION_KEY).generation, 1);
  await store.commit(prepared, { expectedGeneration: 2 });
  assert.equal((await store.read()).publicStyles, undefined);
  assert.equal(memory.contents().get('metadata').has(SOUNDTRACK_STYLE_SELECTION_KEY), false);
});

test('new unrelated commits preserve exact public styles but explicit equivalent choices clear them', async (t) => {
  const { store } = setup(t);
  const prepared = await prepare();
  await store.commit(prepared, { expectedGeneration: 0, publicStyles: ['fpv'] });
  await store.commit(prepared, { expectedGeneration: 1 });
  assert.deepEqual((await store.read()).publicStyles, ['fpv']);
  await store.commit(prepared, { expectedGeneration: 2, publicStyles: null });
  assert.equal((await store.read()).publicStyles, undefined);
  await store.commit(prepared, { expectedGeneration: 3, publicStyles: ['fusion'] });
  const changed = structuredClone(prepared.library);
  changed.listening.mode = 'metal';
  await store.commit(await prepare(changed), { expectedGeneration: 4 });
  assert.equal((await store.read()).publicStyles, undefined);
});

test('old explicit All cannot resurrect a prior exact FPV selection', async (t) => {
  const { store, old } = setup(t);
  const all = structuredClone(emptySoundtrackLibrary({ catalogue: true }));
  all.listening.mode = 'mix';
  all.listening.genres = [...SOUNDTRACK_GENRES];
  const prepared = await prepare(all);
  await store.commit(prepared, { expectedGeneration: 0, publicStyles: ['fpv'] });
  await old.commitDomain('audio', prepared, { expectedGeneration: 1 });
  const current = await store.read();
  assert.equal(current.publicStyles, undefined);
  assert.equal(current.library.listening.mode, 'mix');
  assert.deepEqual(current.library.listening.genres, SOUNDTRACK_GENRES);
});

test('a failed sidecar write rolls back the entire preference commit and a retry succeeds', async (t) => {
  const { memory, store } = setup(t);
  const prepared = await prepare();
  await store.commit(prepared, { expectedGeneration: 0, publicStyles: ['synth'] });
  const before = await store.read();
  memory.onAnyPut = ({ name, key, tx }) => {
    if (name === 'metadata' && key === SOUNDTRACK_STYLE_SELECTION_KEY) tx.abort();
  };
  await assert.rejects(store.commit(prepared, { expectedGeneration: 1, publicStyles: ['fpv'] }));
  memory.onAnyPut = null;
  assert.deepEqual(await store.read(), before);
  await store.commit(prepared, { expectedGeneration: 1, publicStyles: ['fpv'] });
  assert.deepEqual((await store.read()).publicStyles, ['fpv']);
});

test('factory defaults and explicit historical listening preferences are not migrated by inference', async (t) => {
  const { store, old } = setup(t);
  assert.equal(upgradeSoundtrackLibrary((await store.read()).library).listening.mode, 'ukrainian');
  const explicit = structuredClone(emptySoundtrackLibrary({ catalogue: true }));
  explicit.listening.mode = 'synth90s';
  await old.commitDomain('audio', await prepare(explicit), { expectedGeneration: 0 });
  assert.equal((await store.read()).library.listening.mode, 'synth90s');
  assert.equal((await store.read()).publicStyles, undefined);
  const legacy = emptySoundtrackLibrary({ catalogue: true, version: 2 });
  assert.equal(upgradeSoundtrackLibrary(legacy).listening.mode, 'auto');
});
