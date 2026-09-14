import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { createMediaIdentityCatalog, validateMediaLibrary } from '../media-library.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { createFlightPictures } from '../ui/flight-pictures.mjs';
import { presentationPicturePins } from '../flight-media-pins.mjs';
import { exportMediaBundle, importMediaBundle } from '../media-bundle.mjs';
import {
  createReleasePictureDefaults,
  releasePictureForIdentity,
  matchesReleasePictureBaseline,
} from '../presentation/release-pictures.mjs';
import { CURRENT_PICTURE_BASELINES } from '../presentation/current-picture-baselines.mjs';
import { CURRENT_ART_SOURCES } from '../presentation/current-art-sources.mjs';
import { CURRENT_PICTURES } from '../presentation/current-pictures.mjs';
import { FORMATS } from '../presentation/model.mjs';
import { hashPresentationBytes } from '../presentation/bundle.mjs';
import { SOURCE_EXTERNAL_CHAPTER } from '../external-chapter-source.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { pngBytes, deferred, mediaFixture, libraryRecord } from './helpers/media-fixtures.mjs';
import { encodeSpritePNG } from '../../scripts/produce-field-kit-sprites.mjs';

const json = async (name) => JSON.parse(await fs.readFile(new URL(name, import.meta.url), 'utf8'));
const [campaign, classes, themes] = await Promise.all([
  json('../content/campaign.json'),
  json('../content/classes.json'),
  json('../content/themes.json'),
]);
campaign.classRecipes = classes;
const catalog = createExecutionCatalog([
    { campaign, classRecipes: classes, themes: themes.themes, sourcePackId: null },
  ]),
  identityCatalog = createMediaIdentityCatalog(catalog),
  entry = catalog.entries.find((row) => row.difficulty === 'standard'),
  level = entry.campaign.levels[0],
  request = {
    executionKey: entry.executionKey,
    levelId: level.id,
    levelRevision: level.revision,
    themeId: 'fpv',
  },
  identity = identityCatalog.resolve(request),
  owner = CURRENT_PICTURES.find((row) => JSON.stringify(row.owner) === JSON.stringify(identity)),
  decodeImage = async () => ({ naturalWidth: 1, naturalHeight: 1 });
assert.ok(owner, 'Fixture must use an exact code-owned campaign/map/world.');
async function art(bytes = pngBytes(), [width, height] = [1, 1]) {
  const asset = {
    format: FORMATS.asset,
    id: 'test.release.picture',
    revision: 1,
    kind: 'image',
    description: 'Injected original-byte fixture; no production art claim.',
    provenance: {
      creator: 'Test',
      source: 'Owned fixture',
      license: 'Test only',
      prompt: '',
      parent: null,
    },
    file: {
      sha256: await hashPresentationBytes(bytes),
      bytes: bytes.length,
      mime: 'image/png',
      width,
      height,
    },
    recipe: null,
    geometry: {
      frame: { x: 0, y: 0, width, height },
      pivot: { x: 0.5, y: 0.5 },
      occupiedBounds: null,
      rotorAnchors: [],
      nineSlice: null,
    },
    quality: { stage: 'produced', evidence: [] },
  };
  return { asset, blob: new Blob([bytes]) };
}
async function fixture(t, options = {}) {
  const memory = managedIndexedDB(),
    manager = createManagedMediaStore({ indexedDB: memory.indexedDB, storyMedia: true }),
    store = createStillMediaStore({
      managedStore: manager,
      decodeImage: options.decodeImage ?? decodeImage,
    });
  let currentArt = options.art ?? (await art()),
    snapshot = { resolved: { assets: { [options.slot ?? owner.id]: currentArt.asset } } },
    reads = 0;
  const host = {
    current: () => snapshot,
    async readPicture(slot, { snapshot: expected, signal }) {
      assert.equal(snapshot.resolved.assets[slot], currentArt.asset);
      assert.equal(expected, snapshot);
      reads++;
      const replacement = await options.onRead?.(signal, currentArt);
      return replacement ?? currentArt;
    },
  };
  const readMedia = async (options) => ({
    store,
    ...(await store.readPresentationMetadata(options)),
  });
  const defaults = createReleasePictureDefaults({
    getHost: () => host,
    executionCatalog: () => catalog,
    readMedia,
    ...(options.commit ? { commit: options.commit } : {}),
  });
  const flight = (overrides = {}) =>
    createFlightPictures({
      context: { runId: 'new-attempt', ...request },
      level,
      themeIds: ['fpv', 'ukraine'],
      identityCatalog,
      readMedia,
      prepareSelection: (args) => defaults.prepareSelection(args),
      acquire: async ({ pin, metadata, store }, { signal }) => {
        const original = await store.readAsset(metadata, pin.assetId, { signal });
        assert.equal(original.asset.sha256, pin.sha256);
        return { image: {}, pin, fit: 'contain', release() {} };
      },
      ...overrides,
    });
  t.after(() => {
    store.close();
    manager.close();
  });
  return {
    store,
    readMedia,
    defaults,
    host,
    flight,
    reads: () => reads,
    async replace(bytes) {
      currentArt = await art(bytes);
      snapshot = { resolved: { assets: { [owner.id]: currentArt.asset } } };
    },
  };
}
test('new attempts durably pin an exact release original without changing assignments or campaign identity', async (t) => {
  const f = await fixture(t),
    before = JSON.stringify(catalog),
    flight = f.flight();
  assert.equal(f.reads(), 0);
  await flight.ensure();
  const pins = presentationPicturePins(flight.pins()),
    pin = pins.choices[0],
    saved = await f.store.read();
  assert.equal(pin.kind, 'still');
  assert.deepEqual(pin.identity, identity);
  assert.equal(pins.choices[1].kind, 'legacy');
  assert.equal(saved.document.library.assignments.length, 0);
  assert.equal(saved.document.library.presentations.length, 1);
  assert.equal(f.reads(), 1);
  assert.equal(JSON.stringify(catalog), before);
  const transfer = await exportMediaBundle(saved.document, saved.assets, { decodeImage });
  const restored = await importMediaBundle(transfer, { decodeImage });
  assert.deepEqual(restored.document, saved.document);
  assert.deepEqual(
    new Uint8Array(await restored.assets[0].blob.arrayBuffer()),
    new Uint8Array(pngBytes()),
  );
  flight.dispose();
});
test('a newer release appends history while an existing saved pin and restored attempt keep exact bytes', async (t) => {
  const f = await fixture(t),
    first = f.flight();
  await first.ensure();
  const oldPins = first.pins(),
    old = presentationPicturePins(oldPins).choices[0];
  first.dispose();
  await f.replace(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
  );
  const next = f.flight();
  await next.ensure();
  const newer = presentationPicturePins(next.pins()).choices[0];
  assert.notEqual(newer.sha256, old.sha256);
  assert.notEqual(newer.presentationId, old.presentationId);
  const restored = f.flight({
    pins: oldPins,
    prepareSelection: () => assert.fail('Existing pins cannot choose defaults.'),
  });
  await restored.ensure();
  assert.deepEqual(restored.current().pin, old);
  assert.equal((await f.store.read()).document.library.presentations.length, 2);
  assert.equal(f.reads(), 2);
  next.dispose();
  restored.dispose();
});
test('explicit assignments win and old unpinned, practice, and explicit legacy attempts never mint defaults', async (t) => {
  const f = await fixture(t),
    first = f.flight();
  await first.ensure();
  const saved = await f.store.read(),
    p = saved.document.library.presentations[0];
  const prepared = await f.store.prepare(
    { ...saved.document.library, assignments: [{ identity, presentationId: p.id, revision: 1 }] },
    saved.assets,
    { previous: saved.document, executionCatalog: catalog },
  );
  await f.store.commit(prepared, { expectedGeneration: saved.generation });
  const manual = f.flight();
  await manual.ensure();
  assert.equal(f.reads(), 1);
  for (const flags of [{ legacy: true }, { explicitLegacy: true }]) {
    const previous = f.flight({
      ...flags,
      readMedia: () => assert.fail('Legacy must not read storage.'),
      prepareSelection: () => assert.fail('Legacy must not prepare defaults.'),
    });
    await previous.ensure();
    previous.dispose();
  }
  assert.deepEqual((await f.store.read()).document.library.assignments, [
    { identity, presentationId: p.id, revision: 1 },
  ]);
  first.dispose();
  manual.dispose();
});
test('cancelled original download cannot mint a pin or persist provisional history', async (t) => {
  const gate = deferred(),
    started = deferred(),
    f = await fixture(t, {
      onRead: async () => {
        started.resolve();
        await gate.promise;
      },
    }),
    flight = f.flight(),
    loading = flight.ensure();
  await started.promise;
  flight.cancel();
  gate.resolve();
  await assert.rejects(loading, { name: 'AbortError' });
  assert.equal(flight.pins(), undefined);
  assert.equal((await f.store.read()).document.library.assets.length, 0);
  flight.dispose();
});
test('a concurrent media writer defeats CAS atomically and preserves its accepted library', async (t) => {
  let injected = false;
  const f = await fixture(t, {
      commit: async (store, prepared, options) => {
        if (!injected) {
          injected = true;
          const before = await store.read(),
            competing = await store.prepare(before.document.library, before.assets, {
              previous: before.document,
              executionCatalog: catalog,
            });
          await store.commit(competing, { expectedGeneration: before.generation });
        }
        return store.commit(prepared, options);
      },
    }),
    flight = f.flight();
  await assert.rejects(flight.ensure(), /changed|generation|stale/i);
  const saved = await f.store.read();
  assert.equal(saved.generation, 1);
  assert.equal(saved.document.library.assets.length, 0);
  assert.equal(flight.pins(), undefined);
  flight.dispose();
});
test('unknown owners, other themes, and recipes never become inferred picture defaults', async (t) => {
  const f = await fixture(t);
  assert.equal(
    releasePictureForIdentity(f.host.current(), { ...identity, levelRevision: 'changed' }),
    null,
  );
  assert.equal(
    releasePictureForIdentity(f.host.current(), { ...identity, themeId: 'ukraine' }),
    null,
  );
  assert.equal(
    releasePictureForIdentity(
      { resolved: { assets: { [owner.id]: { kind: 'recipe' } } } },
      identity,
    ),
    null,
  );
  const bad = structuredClone(f.host.current());
  bad.resolved.assets[owner.id].file.width = 2;
  assert.throws(() => releasePictureForIdentity(bad, identity), /complete bounded/);
});
test('transient default selection remains a validated immutable library without publishing assignments', async (t) => {
  const f = await fixture(t),
    media = await f.readMedia();
  const result = await f.defaults.prepareSelection({
    media,
    selection: {
      ...request,
      themeIds: ['fpv'],
      identityCatalog,
      library: media.metadata.document.library,
    },
  });
  assert.equal(validateMediaLibrary(result.library, { identityCatalog }).assignments.length, 1);
  assert.equal(result.media.metadata.document.library.assignments.length, 0);
  const again = await f.defaults.prepareSelection({
    media: result.media,
    selection: {
      ...request,
      themeIds: ['fpv'],
      identityCatalog,
      library: result.media.metadata.document.library,
    },
  });
  assert.equal(again.media.metadata.generation, result.media.metadata.generation);
  assert.equal(f.reads(), 1);
});

test('adding a default retains archived media owners that are absent from the current playable catalog', async (t) => {
  const f = await fixture(t),
    archived = mediaFixture(true),
    original = await art(),
    prior = libraryRecord(archived.identity);
  prior.assets[0] = {
    ...prior.assets[0],
    sha256: original.asset.file.sha256,
    bytes: original.blob.size,
  };
  const combined = createExecutionCatalog([
    ...catalog.entries.filter((row) => row.difficulty === 'standard'),
    ...archived.catalog.entries.filter((row) => row.difficulty === 'standard'),
  ]);
  const before = await f.store.read();
  const prepared = await f.store.prepare(
    prior,
    [{ sha256: original.asset.file.sha256, blob: original.blob }],
    { executionCatalog: combined, previous: before.document },
  );
  await f.store.commit(prepared, { expectedGeneration: before.generation });
  const flight = f.flight();
  await flight.ensure();
  const saved = await f.store.read();
  assert.deepEqual(
    saved.document.library.presentations.find((row) => row.id === 'map-picture'),
    prior.presentations[0],
  );
  assert.equal(saved.document.library.presentations.length, 2);
  assert.deepEqual(saved.document.library.assignments, prior.assignments);
  flight.dispose();
});

test('invalid original bytes and stale fresh-install proof cannot publish assets or assignments', async (t) => {
  const f = await fixture(t, {
      onRead: async (_signal, original) => ({ ...original, blob: new Blob(['invalid']) }),
    }),
    flight = f.flight();
  await assert.rejects(flight.ensure(), /bytes|hash|PNG|length|image/i);
  assert.equal(flight.pins(), undefined);
  await assert.rejects(
    f.defaults.assignFreshChapter({
      descriptor: SOURCE_EXTERNAL_CHAPTER,
      mediaGeneration: 10,
      identityCatalog,
    }),
    /generation changed/,
  );
  await assert.rejects(
    f.defaults.assignFreshChapter({
      descriptor: SOURCE_EXTERNAL_CHAPTER,
      mediaGeneration: 0,
      identityCatalog,
    }),
    /assignment changed/,
  );
  const saved = await f.store.read();
  assert.equal(saved.generation, 0);
  assert.equal(saved.document.library.assets.length, 0);
  assert.equal(saved.document.library.assignments.length, 0);
  flight.dispose();
});

test('source fingerprints stay exact and manually replaced embedded pictures or fitting keep priority', async (t) => {
  assert.deepEqual(
    CURRENT_PICTURE_BASELINES,
    CURRENT_ART_SOURCES.filter((row) => row.owner.themeId === 'fpv').map(
      ({ id, kind, fit, image }) => ({ id, kind, fit, image }),
    ),
  );
  const embedded = CURRENT_ART_SOURCES.find(
      (row) => row.kind === 'embedded' && row.owner.themeId === 'fpv',
    ),
    bytes = await fs.readFile(new URL(`../../${embedded.sourceImagePath}`, import.meta.url)),
    background = {
      dataUrl: `data:image/png;base64,${bytes.toString('base64')}`,
      fit: embedded.fit,
    };
  assert.equal(await matchesReleasePictureBaseline(embedded.owner, background), true);
  assert.equal(
    await matchesReleasePictureBaseline(embedded.owner, {
      ...background,
      fit: embedded.fit === 'cover' ? 'contain' : 'cover',
    }),
    false,
  );
  assert.equal(
    await matchesReleasePictureBaseline(embedded.owner, {
      ...background,
      dataUrl: `data:image/png;base64,${pngBytes().toString('base64')}`,
    }),
    false,
  );
  assert.equal(await matchesReleasePictureBaseline(embedded.owner, null), false);
  const f = await fixture(t),
    media = await f.readMedia(),
    selection = {
      ...request,
      themeIds: ['fpv'],
      identityCatalog,
      library: media.metadata.document.library,
    };
  const result = await f.defaults.prepareSelection({
    media,
    selection,
    authoredBackground: background,
  });
  assert.equal(result.library, selection.library);
  assert.equal(f.reads(), 0);
  assert.equal((await f.store.read()).generation, 0);
});

test('generic reveal defaults are dimension-matched and exact FPV owners always take precedence', async () => {
  const generic = await art(pngBytes(), owner.dimensions),
    exact = await art(),
    slot = 'scene.reveal.legacy',
    assets = { [slot]: generic.asset };
  assert.deepEqual(owner.dimensions, [768, 576]);
  let snapshot = { resolved: { assets } };
  assert.equal(releasePictureForIdentity(snapshot, identity).slotId, slot);
  assets[owner.id] = { kind: 'recipe' };
  assert.equal(releasePictureForIdentity(snapshot, identity).slotId, slot);
  assets[owner.id] = exact.asset;
  assert.deepEqual(releasePictureForIdentity(snapshot, identity).asset, exact.asset);
  delete assets[owner.id];
  assets[slot] = exact.asset;
  assert.equal(
    releasePictureForIdentity(snapshot, identity),
    null,
    'Wrong dimensions do not stretch.',
  );
  assets[slot] = generic.asset;
  const wide = CURRENT_PICTURES.find(
      (row) =>
        row.owner.themeId === 'fpv' && row.dimensions[0] === 1152 && row.dimensions[1] === 576,
    ),
    wideArt = await art(pngBytes(), wide.dimensions);
  snapshot = { resolved: { assets: { ...assets, 'scene.reveal.wide': wideArt.asset } } };
  assert.equal(releasePictureForIdentity(snapshot, wide.owner).slotId, 'scene.reveal.wide');
  const otherSize = CURRENT_PICTURES.find(
    (row) => row.owner.themeId === 'fpv' && row.dimensions[1] !== 576,
  );
  assert.equal(releasePictureForIdentity(snapshot, otherSize.owner), null);
  assert.equal(releasePictureForIdentity(snapshot, { ...identity, themeId: 'ukraine' }), null);
});

test('a generic original uses the same durable new-attempt pins and preserves manual and saved choices', async (t) => {
  const [width, height] = owner.dimensions,
    original = await art(
      encodeSpritePNG({ width, height, rgba: new Uint8ClampedArray(width * height * 4) }),
      owner.dimensions,
    ),
    f = await fixture(t, {
      slot: 'scene.reveal.legacy',
      art: original,
      decodeImage: async () => ({ naturalWidth: width, naturalHeight: height }),
    }),
    first = f.flight();
  await first.ensure();
  const savedPins = first.pins(),
    saved = await f.store.read(),
    pin = presentationPicturePins(savedPins).choices[0],
    presentation = saved.document.library.presentations[0];
  assert.equal(pin.kind, 'still');
  assert.equal(pin.sha256, original.asset.file.sha256);
  assert.deepEqual(pin.identity, identity);
  assert.equal(saved.document.library.assignments.length, 0);
  const prepared = await f.store.prepare(
    {
      ...saved.document.library,
      assignments: [{ identity, presentationId: presentation.id, revision: 1 }],
    },
    saved.assets,
    { previous: saved.document, executionCatalog: catalog },
  );
  await f.store.commit(prepared, { expectedGeneration: saved.generation });
  await f.replace(pngBytes());
  const manual = f.flight(),
    restored = f.flight({
      pins: savedPins,
      prepareSelection: () => assert.fail('Saved pins cannot choose a generic default.'),
    });
  await manual.ensure();
  await restored.ensure();
  assert.equal(f.reads(), 1);
  assert.equal(manual.current().pin.sha256, pin.sha256);
  assert.equal(restored.current().pin.sha256, pin.sha256);
  for (const flight of [first, manual, restored]) flight.dispose();
});
