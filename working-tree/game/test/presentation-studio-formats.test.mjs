import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { FORMATS, resolvePresentation, validateThemeBundle } from '../presentation/model.mjs';
import { exportThemeBundle, importThemeBundle } from '../presentation/bundle.mjs';
import { REFERENCE_FORMAT } from '../presentation/reference-model.mjs';
import { createStudioStore } from '../presentation/studio-store.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import {
  prepareStudioSnapshot,
  upgradeStudioDocument,
  reviseStudioDocument,
  replaceStudioDocumentCollection,
  selectStudioTheme,
  adoptStudioDocument,
  exportStudioBundle,
  importStudioBundle,
  createFormatStudioStore,
} from '../presentation/studio-formats.mjs';

const ref = ({ id, revision }) => ({ id, revision });
const bytes = async (blob) => new Uint8Array(await blob.arrayBuffer());
const legacy = () => createDefaultThemeBundle();

test('ordinary Studio v1 load, edit, save and export preserve the strict legacy format and bytes', async () => {
  const db = managedIndexedDB();
  const store = createFormatStudioStore({ indexedDB: db.indexedDB });
  const document = legacy();
  const original = await bytes(await exportThemeBundle(document));
  assert.deepEqual(await bytes(await exportStudioBundle(document, new Map())), original);
  const imported = await importStudioBundle(new Blob([original]));
  assert.deepEqual(imported.document, document);
  await store.save(document, new Map());
  const loaded = await store.load();
  assert.deepEqual(loaded.document, document);
  const next = await reviseStudioDocument(loaded.document, { tokens: { textSize: 21 } });
  await store.save(next, loaded.assets, { expectedGeneration: 1 });
  const saved = await store.load();
  assert.equal(saved.document.format, FORMATS.bundle);
  for (const key of ['slots', 'assets', 'collections'])
    assert.deepEqual(saved.document[key], document[key]);
  assert.deepEqual(
    await bytes(await exportStudioBundle(saved.document, saved.assets)),
    await bytes(await exportThemeBundle(next)),
  );
  await store.close();
});

test('explicit upgrade is a detached immutable draft; old writer rejects saved v2 and CAS retains the winner', async () => {
  const db = managedIndexedDB(),
    store = createFormatStudioStore({ indexedDB: db.indexedDB });
  const document = legacy();
  await store.save(document, new Map());
  const previous = await prepareStudioSnapshot(document, new Map());
  const upgraded = await upgradeStudioDocument(document, new Map());
  assert.equal(upgraded.document.format, REFERENCE_FORMAT);
  assert.equal(upgraded.document.revision, document.revision + 1);
  assert.deepEqual((await store.load()).document, document, 'Preparing Upgrade does not persist.');
  for (const key of ['slots', 'assets', 'themes', 'collections', 'selection'])
    assert.deepEqual(upgraded.document[key], previous.document[key]);
  assert.deepEqual(upgraded.view, previous.view);
  assert.deepEqual(upgraded.coverage, previous.coverage);
  assert.deepEqual(
    (await store.save(upgraded.document, upgraded.assets, { expectedGeneration: 1 })).document,
    upgraded.document,
  );
  const old = createStudioStore({ indexedDB: db.indexedDB });
  await assert.rejects(old.load(), /Invalid bundle identity/);
  await assert.rejects(
    old.save(document, new Map(), { expectedGeneration: 2 }),
    /Invalid bundle identity/,
  );
  await assert.rejects(
    store.save(upgraded.document, upgraded.assets, { expectedGeneration: 1 }),
    /another tab/,
  );
  assert.deepEqual((await store.load()).document, upgraded.document);
  const signal = AbortSignal.abort();
  await assert.rejects(upgradeStudioDocument(document, new Map(), { signal }), {
    name: 'AbortError',
  });
  assert.deepEqual((await store.load()).document, upgraded.document);
  await Promise.all([store.close(), old.close()]);
});

test('v2 Studio edits retain encoded history while views, complete collections and historical provenance resolve', async () => {
  const original = legacy(),
    upgraded = await upgradeStudioDocument(original, new Map());
  const selected = Object.keys(upgraded.view.assets)[0],
    current = upgraded.view.assets[selected];
  const asset = {
    ...structuredClone(current),
    revision: current.revision + 1,
    provenance: { ...structuredClone(current.provenance), parent: ref(current) },
    quality: { stage: 'reviewed', evidence: ['Actual local fixture review only.'] },
  };
  let next = await reviseStudioDocument(upgraded.document, {
    assets: [asset],
    bindings: { [selected]: ref(asset) },
    tokens: { textSize: 22 },
  });
  const encoded = next.assets.at(-1);
  assert.equal(encoded.format, 'revealline-asset-revision.v2');
  assert.equal(encoded.provenance.creator, undefined);
  let snapshot = await prepareStudioSnapshot(next, new Map());
  assert.deepEqual(snapshot.asset(encoded), asset);
  assert.equal(snapshot.view.assets[selected].provenance.prompt, current.provenance.prompt);
  assert.equal(snapshot.coverage.rows.find((row) => row.slotId === selected).stage, 'reviewed');
  next = await replaceStudioDocumentCollection(next, {
    id: 'studio-test-collection',
    name: 'Fixture',
    requiredSlots: [selected],
    bindings: { [selected]: ref(asset) },
  });
  snapshot = await prepareStudioSnapshot(next, new Map());
  assert.equal(snapshot.view.collection.id, 'studio-test-collection');
  await assert.rejects(
    replaceStudioDocumentCollection(next, {
      id: 'invalid-collection',
      name: 'Missing selected binding',
      requiredSlots: [selected],
      bindings: {},
    }),
    /binding|slot/i,
  );
  next = await reviseStudioDocument(next, { bindings: { [selected]: ref(current) } });
  next = await selectStudioTheme(next, next.selection.theme.id);
  snapshot = await prepareStudioSnapshot(next, new Map());
  assert.deepEqual(ref(snapshot.view.assets[selected]), ref(current));
  for (const key of ['slots', 'assets', 'themes', 'collections'])
    assert.deepEqual(next[key].slice(0, original[key].length), original[key]);
  assert.throws(() => validateThemeBundle(next), /Invalid bundle identity/);
});

test('Studio transfer and adoption matrix is explicit, complete and fail-closed', async () => {
  const one = legacy(),
    two = (await upgradeStudioDocument(one, new Map())).document;
  const file = await exportStudioBundle(two, new Map());
  await assert.rejects(importThemeBundle(file), /Unsupported/);
  const incoming = await importStudioBundle(file);
  assert.deepEqual(incoming.document, two);
  await assert.rejects(adoptStudioDocument(one, incoming.document), /explicitly Upgrade/);
  for (const foreign of [one, two]) {
    const adopted = await adoptStudioDocument(two, foreign);
    assert.equal(adopted.format, REFERENCE_FORMAT);
    assert.deepEqual(adopted.assets.slice(0, two.assets.length), two.assets);
    const snapshot = await prepareStudioSnapshot(adopted, new Map());
    assert.deepEqual(snapshot.view.tokens, resolvePresentation(one).tokens);
    assert.ok(snapshot.view.collection);
  }
  const before = structuredClone(two);
  const malformed = structuredClone(two);
  malformed.format = 'revealline-theme-bundle.v99';
  await assert.rejects(prepareStudioSnapshot(malformed, new Map()), /Unsupported/);
  await assert.rejects(importStudioBundle(new Blob(['RLTHM9\r\n1234'])), /Unsupported/);
  const broken = new Uint8Array(await file.arrayBuffer());
  broken[8] = 255;
  await assert.rejects(importStudioBundle(new Blob([broken])), /manifest/);
  assert.deepEqual(two, before);
});

test('format dispatch does not evaluate an untrusted format accessor', async () => {
  let reads = 0;
  const malicious = Object.defineProperty({}, 'format', {
    enumerable: true,
    get() {
      reads++;
      return FORMATS.bundle;
    },
  });
  assert.throws(() => exportStudioBundle(malicious, new Map()), /Unsupported/);
  assert.throws(() => reviseStudioDocument(malicious, {}), /Unsupported/);
  await assert.rejects(prepareStudioSnapshot(malicious, new Map()), /getter|accessor|data|JSON/i);
  await assert.rejects(selectStudioTheme(malicious, 'fpv'), /getter|accessor|data|JSON/i);
  assert.equal(reads, 0);
});
