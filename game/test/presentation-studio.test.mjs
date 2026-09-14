import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { FORMATS, resolvePresentation, validateThemeBundle } from '../presentation/model.mjs';
import { createStudioStore, STUDIO_DATABASE } from '../presentation/studio-store.mjs';
import { hashPresentationBytes } from '../presentation/bundle.mjs';
import { pngBytes } from './helpers/media-fixtures.mjs';
import {
  reviseStudioTheme,
  replaceStudioCollection,
  generateAssetPrompt,
  adoptStudioBundle,
} from '../presentation/studio-session.mjs';

const ref = (row) => ({ id: row.id, revision: row.revision });
const flush = () => new Promise((resolve) => setImmediate(resolve));
/** Real finite transaction fixture, with independently controlled open deliveries. */
function controlledOpen() {
  const fixture = memoryIndexedDB(),
    requests = [];
  const indexedDB = {
    open(name, version) {
      assert.equal(name, STUDIO_DATABASE);
      assert.equal(version, 1);
      const request = {},
        inner = fixture.indexedDB.open(name, version);
      const entry = { request, ready: false, deliver: () => request.onsuccess() };
      requests.push(entry);
      inner.onupgradeneeded = (event) => {
        request.result = inner.result;
        request.transaction = inner.transaction;
        request.onupgradeneeded?.(event);
      };
      inner.onsuccess = () => {
        request.result = inner.result;
        entry.ready = true;
      };
      inner.onerror = () => {
        request.error = inner.error;
        request.onerror?.();
      };
      return request;
    },
  };
  return { fixture, requests, indexedDB };
}

test('studio revisions preserve prior theme records and apply explicit token changes', () => {
  const original = createDefaultThemeBundle();
  const revised = reviseStudioTheme(original, { tokens: { amber: '#ffcc00' } });
  assert.equal(resolvePresentation(revised).tokens.amber, '#ffcc00');
  assert.notEqual(resolvePresentation(original).tokens.amber, '#ffcc00');
  for (const theme of original.themes)
    assert.deepEqual(
      revised.themes.find((row) => row.id === theme.id && row.revision === theme.revision),
      theme,
    );
  assert.throws(
    () => reviseStudioTheme(revised, { tokens: { ink: 'url(https://example.com)' } }),
    /Invalid/,
  );
});

test('a complete required collection can retain separate compact edit revisions', () => {
  const original = createDefaultThemeBundle();
  const source = structuredClone(original);
  const targets = source.slots.filter((slot) => slot.required);
  const bindings = resolvePresentation(original).bindings;
  // Construct a complete historical workspace, then exercise the real next edit.
  // Replaying hundreds of identical validation steps adds no boundary coverage.
  for (const slot of targets) {
    const current = source.themes.at(-1);
    const theme = {
      ...current,
      revision: current.revision + 1,
      parent: ref(current),
      tokens: {},
      bindings: { [slot.id]: bindings[slot.id] },
    };
    source.themes.push(theme);
    source.selection.theme = ref(theme);
    source.revision++;
  }
  const accepted = validateThemeBundle(source);
  const next = reviseStudioTheme(accepted, { tokens: { amber: '#ffcc00' } });
  assert.equal(next.themes.length, targets.length + original.themes.length + 1);
  assert.deepEqual(next.themes.at(-1).parent, accepted.selection.theme);
  assert.deepEqual(next.themes.at(-1).bindings, {});
  assert.deepEqual(resolvePresentation(next).bindings, bindings);
  assert.equal(resolvePresentation(next).tokens.amber, '#ffcc00');
  assert.equal(JSON.stringify(next).length < 1024 * 1024, true);
  assert.deepEqual(next.themes.slice(0, -1), accepted.themes);
});

test('collection replacement rejects incomplete members and missing dependencies atomically', () => {
  const original = createDefaultThemeBundle();
  const bindings = resolvePresentation(original).bindings;
  const before = JSON.stringify(original);
  assert.throws(
    () =>
      replaceStudioCollection(original, {
        id: 'kit',
        name: 'Kit',
        requiredSlots: ['ui.panel', 'ui.dialog'],
        bindings: { 'ui.panel': bindings['ui.panel'] },
      }),
    /missing a required binding/,
  );
  assert.equal(JSON.stringify(original), before);
  const next = replaceStudioCollection(original, {
    id: 'kit',
    name: 'Kit',
    requiredSlots: ['ui.panel', 'ui.dialog'],
    bindings: { 'ui.panel': bindings['ui.panel'], 'ui.dialog': bindings['ui.dialog'] },
  });
  assert.equal(resolvePresentation(next).collection.id, 'kit');
  assert.equal(original.collections.length, 0);
});

test('studio database compare-and-swap rejects stale tabs and preserves data on write failure', async () => {
  const fixture = memoryIndexedDB();
  const store = createStudioStore({ indexedDB: fixture.indexedDB });
  assert.equal(await store.load(), null);
  const document = createDefaultThemeBundle();
  const first = await store.save(document, new Map());
  assert.equal(first.generation, 1);
  await assert.rejects(store.save(document, new Map()), /changed in another tab/);
  fixture.failAnyPutAt = 1;
  await assert.rejects(
    store.save(reviseStudioTheme(document, { tokens: { cyan: '#eeeeff' } }), new Map(), {
      expectedGeneration: 1,
    }),
    /write failure/,
  );
  const restored = await store.load();
  assert.equal(restored.generation, 1);
  assert.deepEqual(restored.document, document);
  await store.close();
  await assert.rejects(store.load(), /closed/);
});

test('generated prompts carry real slot, theme, states and release limitations', () => {
  const bundle = createDefaultThemeBundle();
  const slot = bundle.slots.find((row) => row.id === 'player.scout.detailed');
  const prompt = generateAssetPrompt(slot, resolvePresentation(bundle), 'edit');
  for (const fragment of [
    'Edit the attached',
    'player.scout.detailed',
    '64×64',
    'FPV Field Kit',
    'not an approved release',
    'rotorAnchors',
  ])
    assert.ok(prompt.includes(fragment), fragment);
});

test('saved lineage allows a batch of staged actions and reset, but refuses rewritten history', async () => {
  const fixture = memoryIndexedDB(),
    store = createStudioStore({ indexedDB: fixture.indexedDB });
  const original = createDefaultThemeBundle();
  await store.save(original, new Map());
  const one = reviseStudioTheme(original, { tokens: { amber: '#ffcc00' } });
  const two = reviseStudioTheme(one, { tokens: { cyan: '#eeeeff' } });
  const saved = await store.save(two, new Map(), { expectedGeneration: 1 });
  assert.equal(saved.generation, 2);
  assert.deepEqual((await store.load()).document, two);
  // Reset to saved does not create a new document revision; saving it is harmless.
  await store.save(two, new Map(), { expectedGeneration: 2 });
  for (const mutate of [
    (next) => {
      next.id = 'different-workspace';
    },
    (next) => {
      next.assets[0].description = 'rewritten original';
    },
    (next) => {
      next.themes = next.themes.filter((theme) => theme.id !== 'fpv' || theme.revision !== 2);
    },
    (next) => {
      next.collections.push({
        format: FORMATS.collection,
        id: 'gap',
        revision: 2,
        name: 'Missing r1',
        themeId: 'fpv',
        requiredSlots: ['ui.panel'],
        bindings: { 'ui.panel': resolvePresentation(two).bindings['ui.panel'] },
      });
    },
  ]) {
    const next = structuredClone(two);
    next.revision++;
    mutate(next);
    await assert.rejects(
      store.save(next, new Map(), { expectedGeneration: 3 }),
      /same studio|history|Missing parent theme/,
    );
    assert.equal((await store.load()).generation, 3);
  }
  const sameRevision = structuredClone(two);
  sameRevision.themes.at(-1).tokens.amber = '#ffffff';
  await assert.rejects(
    store.save(sameRevision, new Map(), { expectedGeneration: 3 }),
    /advance its revision/,
  );
  await assert.rejects(
    store.save(original, new Map(), { expectedGeneration: 3 }),
    /immutable history/,
  );
  await assert.rejects(
    store.save(two, new Map(), { expectedGeneration: Number.MAX_SAFE_INTEGER }),
    /expected studio generation/,
  );
  assert.deepEqual((await store.load()).document, two);
  assert.ok(fixture.allPuts.every(([name]) => name === 'drafts'));
  await store.close();
});

test('two independent studio tabs serialize compare-and-swap without dropping the winning save', async () => {
  const fixture = memoryIndexedDB();
  const first = createStudioStore({ indexedDB: fixture.indexedDB });
  const second = createStudioStore({ indexedDB: fixture.indexedDB });
  const original = createDefaultThemeBundle();
  await first.save(original, new Map());
  const a = reviseStudioTheme(original, { tokens: { amber: '#eeeeaa' } });
  const b = reviseStudioTheme(original, { tokens: { cyan: '#aaffff' } });
  const outcomes = await Promise.allSettled([
    first.save(a, new Map(), { expectedGeneration: 1 }),
    second.save(b, new Map(), { expectedGeneration: 1 }),
  ]);
  assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1);
  assert.match(
    outcomes.find((result) => result.status === 'rejected').reason.message,
    /another tab/,
  );
  const winner = outcomes.find((result) => result.status === 'fulfilled').value;
  assert.deepEqual((await second.load()).document, winner.document);
  await Promise.all([first.close(), second.close()]);
});

test('a failed save of new bytes and invalid geometry both retain the saved workspace', async () => {
  const fixture = memoryIndexedDB(),
    store = createStudioStore({ indexedDB: fixture.indexedDB });
  const original = createDefaultThemeBundle();
  await store.save(original, new Map());
  const bytes = pngBytes(),
    sha256 = await hashPresentationBytes(bytes);
  const asset = {
    ...structuredClone(original.assets[0]),
    id: 'test.pixel',
    revision: 1,
    kind: 'image',
    file: { sha256, bytes: bytes.length, mime: 'image/png', width: 1, height: 1 },
    recipe: null,
    geometry: {
      frame: { x: 0, y: 0, width: 1, height: 1 },
      pivot: { x: 0.5, y: 0.5 },
      occupiedBounds: null,
      rotorAnchors: [],
      nineSlice: null,
    },
  };
  const assets = new Map([[sha256, new Blob([bytes])]]);
  const next = reviseStudioTheme(original, { assets: [asset] });
  fixture.failAnyPutAt = 1;
  await assert.rejects(store.save(next, assets, { expectedGeneration: 1 }), /write failure/);
  let loaded = await store.load();
  assert.deepEqual(loaded.document, original);
  assert.equal(loaded.assets.size, 0);
  const broken = structuredClone(next);
  broken.assets.at(-1).geometry.pivot.x = 2;
  await assert.rejects(store.save(broken, assets, { expectedGeneration: 1 }), /pivot/);
  await assert.rejects(
    store.save(next, new Map([[sha256, new Blob(['corrupt'])]]), { expectedGeneration: 1 }),
    /bytes\/hash/,
  );
  loaded = await store.load();
  assert.equal(loaded.generation, 1);
  assert.deepEqual(loaded.document, original);
  await store.close();
});

test('imports reserve unoccupied asset and collection identities and retain derivative links', () => {
  const original = structuredClone(createDefaultThemeBundle());
  original.assets.push({ ...structuredClone(original.assets[0]), id: 'import-2-0' });
  original.collections.push({
    format: FORMATS.collection,
    id: 'import-2-1',
    revision: 1,
    name: 'Already used',
    themeId: 'fpv',
    requiredSlots: ['ui.panel'],
    bindings: { 'ui.panel': original.themes[0].bindings['ui.panel'] },
  });
  const incoming = structuredClone(createDefaultThemeBundle());
  incoming.themes[1].name = 'A'.repeat(120);
  incoming.assets[1].provenance.parent = ref(incoming.assets[0]);
  const before = JSON.stringify(original),
    input = JSON.stringify(incoming);
  const next = adoptStudioBundle(original, incoming);
  assert.equal(next.selection.collection.id, 'import-2-2');
  const added = next.assets.slice(original.assets.length);
  assert.deepEqual(added[1].provenance.parent, ref(added[0]));
  const selected = resolvePresentation(next);
  for (const [slot, target] of Object.entries(resolvePresentation(incoming).bindings)) {
    const index = incoming.assets.findIndex(
      (asset) => asset.id === target.id && asset.revision === target.revision,
    );
    assert.deepEqual(selected.bindings[slot], ref(added[index]));
  }
  assert.equal(next.collections.at(-1).name.length, 120);
  assert.equal(JSON.stringify(original), before);
  assert.equal(JSON.stringify(incoming), input);
});

test('incompatible imported slots fail atomically and replaced collections retain history', () => {
  const original = createDefaultThemeBundle(),
    incoming = structuredClone(original);
  // A valid incoming semantic family that does not exist in the current registry.
  incoming.slots.push({ ...structuredClone(incoming.slots[0]), id: 'foreign.only' });
  incoming.themes[1].bindings['foreign.only'] = incoming.themes[0].bindings[incoming.slots[0].id];
  validateThemeBundle(incoming);
  const before = JSON.stringify(original);
  assert.throws(() => adoptStudioBundle(original, incoming), /slot/);
  assert.equal(JSON.stringify(original), before);
  const first = replaceStudioCollection(original, {
    id: 'kit',
    name: 'Kit',
    requiredSlots: ['ui.panel'],
    bindings: { 'ui.panel': resolvePresentation(original).bindings['ui.panel'] },
  });
  const second = replaceStudioCollection(first, {
    id: 'kit',
    name: 'New Kit',
    requiredSlots: ['ui.panel'],
    bindings: { 'ui.panel': resolvePresentation(first).bindings['ui.panel'] },
  });
  assert.equal(second.collections.at(-1).revision, 2);
  assert.deepEqual(second.collections[0], first.collections[0]);
  const edited = reviseStudioTheme(second, { tokens: { amber: '#ffffff' } });
  assert.equal(edited.selection.collection, null);
  assert.deepEqual(resolvePresentation(edited).bindings, resolvePresentation(second).bindings);
  assert.deepEqual(edited.collections, second.collections);
});

test('closing a pending open rejects its caller promptly and closes a late database', async () => {
  const driver = controlledOpen(),
    store = createStudioStore({ indexedDB: driver.indexedDB });
  const pending = assert.rejects(store.load(), /closed/);
  await flush();
  assert.equal(driver.requests[0].ready, true);
  await store.close();
  await pending;
  driver.requests[0].deliver();
  assert.equal(driver.fixture.closed, 1);
  await store.close();
  await assert.rejects(store.load(), /closed/);
  assert.equal(driver.requests.length, 1);
});

test('closing before a pending upgrade aborts that upgrade without creating a workspace', async () => {
  const driver = controlledOpen(),
    store = createStudioStore({ indexedDB: driver.indexedDB });
  const pending = assert.rejects(store.load(), /closed/);
  await store.close();
  await pending;
  await flush();
  assert.equal(driver.fixture.contents().size, 0);
  assert.equal(driver.fixture.closed, 1);
});

test('a blocked open that succeeds late cannot invalidate the newer studio connection', async () => {
  const driver = controlledOpen(),
    store = createStudioStore({ indexedDB: driver.indexedDB });
  const blocked = assert.rejects(store.load(), /other asset studio tab/);
  await flush();
  driver.requests[0].request.onblocked();
  await blocked;
  const loaded = store.load();
  await flush();
  driver.requests[1].deliver();
  assert.equal(await loaded, null);
  driver.requests[0].deliver();
  driver.requests[0].request.error = new Error('Late open error');
  driver.requests[0].request.onerror();
  assert.equal(await store.load(), null);
  assert.equal(driver.requests.length, 2);
  await store.close();
  assert.equal(driver.fixture.closed, 2);
});

test('a retired database close callback does not detach a newer owned handle', async () => {
  const driver = controlledOpen(),
    store = createStudioStore({ indexedDB: driver.indexedDB });
  const first = store.load();
  await flush();
  driver.requests[0].deliver();
  await first;
  const old = driver.requests[0].request.result;
  old.onversionchange();
  const second = store.load();
  await flush();
  driver.requests[1].deliver();
  await second;
  old.onclose();
  assert.equal(await store.load(), null);
  assert.equal(driver.requests.length, 2);
  await store.close();
  assert.equal(driver.fixture.closed, 2);
});
